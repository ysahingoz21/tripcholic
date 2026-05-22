"""
Realistic test scenarios for the optimizer robustness updates.

Each scenario reads like an actual user request — a tourist with a budget,
some preferences, a time window, and a weather forecast — and the test
verifies the optimizer returns a sensible, constraint-satisfying route
along with the right metadata (status, solver_status, routing_source,
diagnostics).

Run from apps/optimizer:
    source venv/bin/activate && python test_robustness.py
"""

import math
import time

from app.schemas.common import BudgetRange, Location, OpeningHours, POICategory
from app.schemas.optimize import OptimizeRequest, OptimizeStatus, SolverStatus
from app.schemas.poi import POI
from app.schemas.preferences import UserPreferences
from app.services.optimizer_service import generate_route


# ── POI factory ───────────────────────────────────────────────────────────────

def poi(
    pid, name, lat, lng, category, op, cl, lo, hi, dur, *, is_outdoor=None,
    destination_relevance=None,
) -> POI:
    return POI(
        poi_id=pid,
        name=name,
        location=Location(lat=lat, lng=lng),
        category=POICategory(category),
        opening_hours=OpeningHours(open=op, close=cl),
        budget=BudgetRange(min_tl=lo, max_tl=hi),
        visit_duration_minutes=dur,
        is_outdoor=is_outdoor,
        destination_relevance=destination_relevance,
    )


# ── Realistic Istanbul POI pool ───────────────────────────────────────────────
# Names match the curated _OUTDOOR_NAME_OVERRIDES in optimizer_service.py.

ISTANBUL_POIS: list[POI] = [
    # Historical
    poi("h1",  "Hagia Sophia",         41.0086, 28.9802, "historical",   "09:00", "19:00",   0,    0,  90),
    poi("h2",  "Topkapi Palace",       41.0115, 28.9833, "historical",   "09:00", "18:00", 500, 1000, 120),
    poi("h3",  "Blue Mosque",          41.0055, 28.9769, "historical",   "08:30", "19:30",   0,    0,  60),
    poi("h4",  "Galata Tower",         41.0256, 28.9744, "historical",   "08:00", "22:00", 350,  350,  45),
    poi("h5",  "Basilica Cistern",     41.0084, 28.9778, "historical",   "09:00", "18:30", 300,  300,  45),
    poi("h6",  "Dolmabahce Palace",    41.0392, 29.0003, "historical",   "09:00", "16:00", 900,  900,  90),
    poi("h7",  "Rumeli Fortress",      41.0847, 29.0559, "historical",   "09:00", "17:00", 100,  100,  60),  # outdoor (override)
    poi("h8",  "Chora Church",         41.0316, 28.9393, "historical",   "09:00", "18:00", 150,  150,  45),
    # Scenic / outdoor by category
    poi("s1",  "Bosphorus Viewpoint",  41.0480, 29.0300, "scenic",       "00:00", "23:59",   0,    0,  30),
    poi("s2",  "Galata Bridge",        41.0186, 28.9742, "scenic",       "00:00", "23:59",   0,    0,  20),
    poi("s3",  "Maiden's Tower",       41.0212, 29.0041, "scenic",       "09:00", "22:00", 150,  150,  45),
    # Food
    poi("f1",  "Karakoy Lokantasi",    41.0228, 28.9755, "food",         "12:00", "22:00", 400,  800,  60),
    poi("f2",  "Hafiz Mustafa",        41.0095, 28.9800, "food",         "08:00", "23:00", 150,  300,  30),
    poi("f3",  "Mikla Restaurant",     41.0335, 28.9773, "food",         "18:00", "23:00", 800, 1500,  90),
    # Shopping
    poi("sh1", "Grand Bazaar",         41.0108, 28.9681, "shopping",     "09:00", "19:00",   0,  500,  90),
    poi("sh2", "Spice Bazaar",         41.0163, 28.9704, "shopping",     "08:30", "19:30",   0,  300,  45),
    poi("sh3", "Istiklal Street",      41.0335, 28.9773, "shopping",     "09:00", "23:00",   0,  200,  60),  # outdoor (override)
    # Entertainment
    poi("e1",  "Pera Museum",          41.0314, 28.9750, "entertainment","10:00", "19:00", 200,  200,  75),
    poi("e2",  "Istanbul Modern",      41.0255, 28.9811, "entertainment","10:00", "18:00", 250,  250,  90),
    poi("e3",  "Miniaturk",            41.0598, 28.9466, "entertainment","09:00", "19:00", 180,  180,  90),  # outdoor (override)
    # Nature / outdoor by category
    poi("n1",  "Gulhane Park",         41.0125, 28.9810, "nature",       "07:00", "22:00",   0,    0,  30),
    poi("n2",  "Emirgan Park",         41.0969, 29.0517, "nature",       "07:00", "21:00",   0,    0,  60),
    # Neighborhood (outdoor walking tours via override)
    poi("nb1", "Balat",                41.0295, 28.9487, "neighborhood", "00:00", "23:59",   0,    0,  60),
    poi("nb2", "Karakoy",              41.0228, 28.9741, "neighborhood", "00:00", "23:59",   0,    0,  45),
    poi("nb3", "Cihangir",             41.0290, 28.9830, "neighborhood", "00:00", "23:59",   0,    0,  45),
]

CATEGORY_INDEX: dict[POICategory, list[POI]] = {}
for p in ISTANBUL_POIS:
    CATEGORY_INDEX.setdefault(p.category, []).append(p)


def candidates_for(categories: list[POICategory], budget_tl: float, limit: int = 20) -> list[POI]:
    """Mirrors what the backend Prisma query would return: filter by category +
    affordability, order deterministically, cap at `limit`."""
    pool = [p for p in ISTANBUL_POIS if p.category in categories and p.budget.min_tl <= budget_tl]
    pool.sort(key=lambda p: (p.category.value, p.visit_duration_minutes, p.name))
    return pool[:limit]


# ── Pretty printer ────────────────────────────────────────────────────────────

def _print_scenario_header(label: str, profile: str):
    print()
    print("─" * 78)
    print(f"▶ {label}")
    print(f"  profile: {profile}")
    print("─" * 78)


def _print_response(elapsed: float, resp, candidates: list[POI]):
    print(f"  candidates sent : {len(candidates)} ({', '.join(p.name for p in candidates)})")
    print(f"  wall-time       : {elapsed * 1000:7.1f} ms")
    print(f"  status          : {resp.status.value}")
    print(f"  solver_status   : {resp.solver_status.value}")
    print(f"  routing_source  : {resp.routing_source.value}")
    print(f"  algorithm_used  : {resp.algorithm_used}")
    print(f"  stops           : {len(resp.route.stops)}")
    if resp.route.stops:
        print(f"  total_cost      : {resp.route.total_cost_tl:.0f} TL")
        print(f"  total_duration  : {resp.route.total_duration_minutes} min")
        print(f"  total_distance  : {resp.route.total_distance_km} km")
        print()
        print("  ROUTE:")
        for i, s in enumerate(resp.route.stops, 1):
            travel = (
                f"  → +{s.travel_time_to_next_minutes} min {s.travel_mode_to_next or 'travel'}"
                if s.travel_time_to_next_minutes
                else "  [last stop]"
            )
            print(
                f"    {i}. {s.arrival_time}–{s.departure_time}  "
                f"{s.name:<28} {s.estimated_cost_tl:>5.0f} TL{travel}"
            )
    if resp.diagnostics:
        print()
        print("  DIAGNOSTICS:")
        for d in resp.diagnostics:
            print(f"    • {d}")


def _expect(label: str, ok: bool, detail: str = ""):
    tag = "PASS" if ok else "FAIL"
    line = f"    [{tag}] {label}"
    if detail:
        line += f"  ({detail})"
    print(line)
    return ok


def _distance_km(a: POI, b: POI) -> float:
    r = 6371.0
    p1, p2 = math.radians(a.location.lat), math.radians(b.location.lat)
    dp = math.radians(b.location.lat - a.location.lat)
    dl = math.radians(b.location.lng - a.location.lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _route_distance_from_candidates(resp, candidates: list[POI]) -> float:
    by_id = {p.poi_id: p for p in candidates}
    total = 0.0
    for left, right in zip(resp.route.stops, resp.route.stops[1:]):
        total += _distance_km(by_id[left.poi_id], by_id[right.poi_id])
    return total


# ── Realistic scenarios ───────────────────────────────────────────────────────

def scenario_first_time_tourist():
    """
    A first-time visitor wants the iconic Sultanahmet circuit on a clear day:
    historical sights + a sit-down meal, mid-range budget, full day.
    """
    cats = [POICategory.HISTORICAL, POICategory.FOOD]
    candidates = candidates_for(cats, budget_tl=4000)
    req = OptimizeRequest(
        trip_id="tourist1",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=cats,
            time_start="09:00", time_end="19:00",
            budget_tl=4000, max_pois=6,
            weather="clear",
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "FIRST-TIME TOURIST — Sultanahmet historical + lunch",
        "9am–7pm · 4000 TL · max 6 stops · clear weather",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    ok = [
        _expect("status is ok or partial", resp.status in {OptimizeStatus.OK, OptimizeStatus.PARTIAL}),
        _expect("solver returned a valid solution",
                resp.solver_status in {SolverStatus.OPTIMAL, SolverStatus.FEASIBLE}),
        _expect("budget respected", resp.route.total_cost_tl <= 4000,
                f"{resp.route.total_cost_tl} TL"),
        _expect("max_pois respected", len(resp.route.stops) <= 6),
        _expect("route has at least one historical POI",
                any(any(p.poi_id == s.poi_id and p.category == POICategory.HISTORICAL
                        for p in candidates) for s in resp.route.stops)),
        _expect("route has at least one food POI when feasible",
                any(any(p.poi_id == s.poi_id and p.category == POICategory.FOOD
                        for p in candidates) for s in resp.route.stops)),
    ]
    return all(ok)


def scenario_budget_backpacker():
    """
    A backpacker with a tight 600 TL budget — should find free mosques, parks,
    bridges, and skip paid museums.
    """
    cats = [POICategory.HISTORICAL, POICategory.SCENIC, POICategory.NATURE]
    candidates = candidates_for(cats, budget_tl=600)
    req = OptimizeRequest(
        trip_id="backpacker",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=cats,
            time_start="10:00", time_end="18:00",
            budget_tl=600, max_pois=5, walking_tolerance_km=4.0,
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "BUDGET BACKPACKER — free sights + parks + bridges",
        "10am–6pm · 600 TL · max 5 stops · 4 km walking",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    ok = [
        _expect("status is ok or partial", resp.status in {OptimizeStatus.OK, OptimizeStatus.PARTIAL}),
        _expect("budget respected", resp.route.total_cost_tl <= 600,
                f"{resp.route.total_cost_tl} TL"),
        _expect("at least 2 stops on a full day",
                len(resp.route.stops) >= 2, f"{len(resp.route.stops)} stops"),
    ]
    return all(ok)


def scenario_rainy_day_visitor():
    """
    Same person as scenario 1 but it's pouring rain. Backend hasn't filtered
    outdoor POIs, so the optimizer's safety-net filter should drop them and
    leave indoor stops only.
    """
    cats = [POICategory.HISTORICAL, POICategory.SCENIC, POICategory.SHOPPING, POICategory.ENTERTAINMENT]
    candidates = candidates_for(cats, budget_tl=4000)
    req = OptimizeRequest(
        trip_id="rainy_visitor",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=cats,
            time_start="10:00", time_end="18:00",
            budget_tl=4000, max_pois=5,
            weather="rainy",
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "RAINY-DAY VISITOR — outdoor POIs auto-dropped",
        "10am–6pm · 4000 TL · max 5 stops · RAINY",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    outdoor_names = {"Rumeli Fortress", "Bosphorus Viewpoint", "Galata Bridge", "Maiden's Tower",
                     "Istiklal Street", "Miniaturk", "Gulhane Park", "Emirgan Park",
                     "Balat", "Karakoy", "Cihangir"}
    stop_names = {s.name for s in resp.route.stops}
    ok = [
        _expect("status is ok or partial", resp.status in {OptimizeStatus.OK, OptimizeStatus.PARTIAL}),
        _expect("weather diagnostic surfaced",
                any("rainy" in d.lower() and "excluded" in d.lower() for d in resp.diagnostics)),
        _expect("no outdoor POIs ended up in the route",
                not (stop_names & outdoor_names),
                f"intersect: {sorted(stop_names & outdoor_names)}"),
    ]
    return all(ok)


def scenario_local_neighborhood_walk():
    """
    A local wants a relaxed neighborhood walking day — Balat, Karakoy, Cihangir.
    These are all NEIGHBORHOOD category, treated as outdoor by override.
    """
    cats = [POICategory.NEIGHBORHOOD, POICategory.FOOD]
    candidates = candidates_for(cats, budget_tl=1500)
    req = OptimizeRequest(
        trip_id="local_walk",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=cats,
            time_start="11:00", time_end="18:00",
            budget_tl=1500, max_pois=4, walking_tolerance_km=5.0,
            weather="clear",
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "LOCAL NEIGHBORHOOD WALK — Balat / Karakoy / Cihangir + a meal",
        "11am–6pm · 1500 TL · max 4 stops · 5 km walking · clear",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    ok = [
        _expect("status is ok or partial", resp.status in {OptimizeStatus.OK, OptimizeStatus.PARTIAL}),
        _expect("at least one neighborhood stop",
                any(any(p.poi_id == s.poi_id and p.category == POICategory.NEIGHBORHOOD
                        for p in candidates) for s in resp.route.stops)),
    ]
    return all(ok)


def scenario_local_neighborhood_walk_rainy():
    """
    Same local walking trip, but it starts raining. Neighborhoods are now
    classified outdoor (override list), so all candidates become outdoor →
    the optimizer must self-bypass the weather filter rather than empty
    the candidate list and return INFEASIBLE.
    """
    cats = [POICategory.NEIGHBORHOOD]
    candidates = candidates_for(cats, budget_tl=1500)
    req = OptimizeRequest(
        trip_id="local_walk_rainy",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=cats,
            time_start="11:00", time_end="18:00",
            budget_tl=1500, max_pois=3, walking_tolerance_km=5.0,
            weather="rainy",
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "RAINY NEIGHBORHOOD WALK — all-outdoor candidates trigger filter bypass",
        "11am–6pm · 1500 TL · max 3 stops · neighborhoods only · RAINY",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    ok = [
        _expect("route still produced", len(resp.route.stops) > 0),
        _expect("bypass diagnostic surfaced",
                any("filter bypassed" in d for d in resp.diagnostics)),
    ]
    return all(ok)


def scenario_overconstrained_budget():
    """
    Budget so low that no candidate fits → infeasible. Backend hasn't filtered
    out paid POIs (e.g. user said budget=50 TL but selected categories where
    every POI costs ≥150). Pre-flight should catch this.
    """
    cats = [POICategory.ENTERTAINMENT]  # all paid
    candidates = candidates_for(cats, budget_tl=10000)  # backend over-permissive
    req = OptimizeRequest(
        trip_id="bad_budget",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=cats,
            time_start="10:00", time_end="17:00",
            budget_tl=50, max_pois=3,
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "OVER-CONSTRAINED — 50 TL budget vs ≥180 TL museum entries",
        "10am–5pm · 50 TL · max 3 stops",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    ok = [
        _expect("status is infeasible", resp.status == OptimizeStatus.INFEASIBLE),
        _expect("solver_status is infeasible", resp.solver_status == SolverStatus.INFEASIBLE),
        _expect("no stops returned", len(resp.route.stops) == 0),
        _expect("pre-flight caught budget conflict",
                any("Budget" in d and "below the cheapest" in d for d in resp.diagnostics)),
        _expect("no greedy fallback wording",
                not any("greedy" in d.lower() for d in resp.diagnostics)),
    ]
    return all(ok)


def scenario_quick_lunch_window():
    """
    A 90-minute lunch window — should still fit one short food stop. Catches
    any over-aggressive pre-flight rejection of short windows.
    """
    cats = [POICategory.FOOD]
    candidates = candidates_for(cats, budget_tl=1000)
    req = OptimizeRequest(
        trip_id="lunch",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=cats,
            time_start="13:00", time_end="14:30",
            budget_tl=1000, max_pois=1,
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "QUICK LUNCH — 90-minute window for one food stop",
        "1pm–2:30pm · 1000 TL · max 1 stop",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    ok = [
        _expect("exactly 1 stop", len(resp.route.stops) == 1),
        _expect("solver returned a valid solution",
                resp.solver_status in {SolverStatus.OPTIMAL, SolverStatus.FEASIBLE}),
    ]
    return all(ok)


def scenario_full_day_marathon():
    """
    A full 14-hour day, generous budget, all categories — exercises the
    largest realistic input the backend would send (capped at 20 candidates).
    Verifies CP-SAT still returns under the wall-clock limit.
    """
    cats = list(POICategory)
    candidates = candidates_for(cats, budget_tl=15000, limit=20)
    req = OptimizeRequest(
        trip_id="marathon",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=cats,
            time_start="08:00", time_end="22:00",
            budget_tl=15000, max_pois=8, walking_tolerance_km=10.0,
            weather="clear",
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        f"FULL-DAY MARATHON — {len(candidates)} candidates, all categories",
        "8am–10pm · 15000 TL · max 8 stops · 10 km walking · clear",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    elapsed = time.perf_counter() - t0
    _print_response(elapsed, resp, candidates)
    print()
    print("  CHECKS:")
    ok = [
        _expect("under 3.5s wall-time (3s solver cap + overhead)",
                elapsed < 3.5, f"{elapsed:.3f}s"),
        _expect("solver returned a valid solution",
                resp.solver_status in {SolverStatus.OPTIMAL, SolverStatus.FEASIBLE}),
        _expect("at least 5 stops on a 14-hour day",
                len(resp.route.stops) >= 5, f"{len(resp.route.stops)} stops"),
        _expect("max_pois respected", len(resp.route.stops) <= 8),
        _expect("budget respected", resp.route.total_cost_tl <= 15000,
                f"{resp.route.total_cost_tl} TL"),
    ]
    return all(ok)


def scenario_picky_walker():
    """
    User has a foot injury — 500 m walking tolerance. Solver may still find
    a compact cluster, but each leg must stay within the walking limit.
    """
    cats = [POICategory.HISTORICAL, POICategory.FOOD]
    candidates = candidates_for(cats, budget_tl=3000)
    req = OptimizeRequest(
        trip_id="picky_walker",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=cats,
            time_start="10:00", time_end="17:00",
            budget_tl=3000, max_pois=4, walking_tolerance_km=0.5,
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "LIMITED MOBILITY — 500 m walking tolerance",
        "10am–5pm · 3000 TL · max 4 stops · 0.5 km walking",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    max_walk_leg_min = int(0.5 / 5.0 * 60)
    walking_legs = [
        s for s in resp.route.stops
        if s.travel_time_to_next_minutes and s.travel_mode_to_next == "walk"
    ]
    ok = [
        _expect("status is ok or partial", resp.status in {OptimizeStatus.OK, OptimizeStatus.PARTIAL}),
        _expect("max_pois respected", len(resp.route.stops) <= 4),
        _expect("each local walking leg respects 500 m tolerance",
                all(
                    (s.travel_time_to_next_minutes or 0) <= max_walk_leg_min
                    for s in walking_legs
                ),
                f"limit {max_walk_leg_min} min at 5 km/h"),
    ]
    return all(ok)


def scenario_compact_ordering():
    """
    Candidate order is deliberately shuffled. The route should still visit the
    line of POIs in geographic order, not bounce A → D → B → C just because
    that was the incoming candidate order.
    """
    candidates = [
        poi("line_a", "Line A", 41.0000, 29.0000, "historical", "09:00", "20:00", 0, 0, 20),
        poi("line_d", "Line D", 41.0000, 29.0300, "historical", "09:00", "20:00", 0, 0, 20),
        poi("line_b", "Line B", 41.0000, 29.0100, "historical", "09:00", "20:00", 0, 0, 20),
        poi("line_c", "Line C", 41.0000, 29.0200, "historical", "09:00", "20:00", 0, 0, 20),
    ]
    req = OptimizeRequest(
        trip_id="compact_order",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=[POICategory.HISTORICAL],
            time_start="09:00", time_end="14:00",
            budget_tl=1000, max_pois=4, walking_tolerance_km=5.0,
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "COMPACT ORDERING — shuffled candidates should not zigzag",
        "9am–2pm · same category/score · max 4 stops",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    positions = {"Line A": 0, "Line B": 1, "Line C": 2, "Line D": 3}
    names = [s.name for s in resp.route.stops]
    position_steps = [
        abs(positions[right] - positions[left])
        for left, right in zip(names, names[1:])
    ]
    total_distance = _route_distance_from_candidates(resp, candidates)
    ok = [
        _expect("all four line POIs selected", len(resp.route.stops) == 4, f"{names}"),
        _expect("route moves to adjacent POIs instead of zigzagging",
                all(step == 1 for step in position_steps),
                f"order: {names}"),
        _expect("route distance stays compact",
                total_distance < 3.0,
                f"{total_distance:.2f} km"),
    ]
    return all(ok)


def scenario_implicit_max_allows_ten_stops():
    """
    When the user did not set max_pois, the optimizer should not silently cap
    the route at six stops. The solver can still stop earlier if time, budget,
    opening hours, or travel make more stops infeasible.
    """
    candidates = [
        poi(
            f"ten_{i}",
            f"Ten Stop {i + 1}",
            41.0000,
            29.0000 + i * 0.001,
            "historical",
            "09:00",
            "20:00",
            0,
            0,
            20,
        )
        for i in range(10)
    ]
    req = OptimizeRequest(
        trip_id="implicit_max_ten",
        date="2026-05-06",
        preferences=UserPreferences(
            categories=[POICategory.HISTORICAL],
            time_start="09:00", time_end="15:00",
            budget_tl=1000, walking_tolerance_km=5.0,
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "IMPLICIT MAX — no hidden 6-stop cap",
        "9am–3pm · 10 nearby stops · max_pois omitted",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    ok = [
        _expect("all ten POIs can be selected", len(resp.route.stops) == 10),
        _expect("max_pois remained omitted", req.preferences.max_pois is None),
    ]
    return all(ok)


def scenario_primary_destination_preferred():
    """
    Nearby expansion POIs should not beat primary-destination POIs just because
    they appear earlier in the candidate list or are similarly close.
    """
    candidates = [
        poi(
            "nearby_gallery",
            "Nearby Gallery",
            41.0005,
            29.0005,
            "historical",
            "09:00",
            "20:00",
            0,
            0,
            45,
            destination_relevance="nearby",
        ),
        poi(
            "primary_museum",
            "Primary Museum",
            41.0000,
            29.0000,
            "historical",
            "09:00",
            "20:00",
            0,
            0,
            45,
            destination_relevance="primary",
        ),
    ]
    req = OptimizeRequest(
        trip_id="primary_destination_preferred",
        date="2026-05-06",
        destination_anchor={"lat": 41.0000, "lng": 29.0000},
        preferences=UserPreferences(
            categories=[POICategory.HISTORICAL],
            time_start="09:00", time_end="12:00",
            budget_tl=1000, max_pois=1, walking_tolerance_km=5.0,
        ),
        candidate_pois=candidates,
    )
    _print_scenario_header(
        "PRIMARY DESTINATION — nearby expansion should not win too early",
        "9am–12pm · max 1 stop · primary and nearby candidates both feasible",
    )
    t0 = time.perf_counter()
    resp = generate_route(req)
    _print_response(time.perf_counter() - t0, resp, candidates)
    print()
    print("  CHECKS:")
    selected_names = [stop.name for stop in resp.route.stops]
    ok = [
        _expect("selected the primary destination POI",
                selected_names == ["Primary Museum"],
                f"{selected_names}"),
    ]
    return all(ok)


def scenario_backend_oversized_request():
    """
    Backend bug: sends 25 candidates instead of capping at 20. Schema must
    reject the request with a validation error.
    """
    print()
    print("─" * 78)
    print("▶ BACKEND OVERSIZED REQUEST — schema must reject >20 candidates")
    print("─" * 78)
    too_many = (ISTANBUL_POIS * 2)[:25]
    print(f"  attempting to send {len(too_many)} candidates...")
    try:
        OptimizeRequest(
            trip_id="oversized",
            date="2026-05-06",
            preferences=UserPreferences(time_start="09:00", time_end="18:00", budget_tl=1000),
            candidate_pois=too_many,
        )
        print("    [FAIL] schema accepted >20 candidates")
        return False
    except Exception as e:
        print(f"    [PASS] rejected: {type(e).__name__}")
        return True


# ── Driver ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    scenarios = [
        scenario_first_time_tourist,
        scenario_budget_backpacker,
        scenario_rainy_day_visitor,
        scenario_local_neighborhood_walk,
        scenario_local_neighborhood_walk_rainy,
        scenario_overconstrained_budget,
        scenario_quick_lunch_window,
        scenario_full_day_marathon,
        scenario_picky_walker,
        scenario_compact_ordering,
        scenario_implicit_max_allows_ten_stops,
        scenario_primary_destination_preferred,
        scenario_backend_oversized_request,
    ]

    print("=" * 78)
    print("OPTIMIZER ROBUSTNESS — REALISTIC SCENARIO SUITE")
    print(f"POI pool: {len(ISTANBUL_POIS)} Istanbul POIs across {len(CATEGORY_INDEX)} categories")
    print("=" * 78)

    results: list[tuple[str, float, bool]] = []
    for fn in scenarios:
        t0 = time.perf_counter()
        try:
            ok = fn()
        except Exception as e:
            import traceback
            print(f"  ✗ {fn.__name__} crashed: {e}")
            traceback.print_exc()
            ok = False
        results.append((fn.__name__, time.perf_counter() - t0, ok))

    print()
    print("=" * 78)
    print("SUMMARY")
    print("=" * 78)
    print(f"{'Scenario':<48} {'Time':>10} {'Result':>10}")
    print("-" * 78)
    for name, t, ok in results:
        print(f"{name:<48} {t * 1000:>8.1f} ms {'PASS' if ok else 'FAIL':>10}")
    print("-" * 78)
    total = sum(t for _, t, _ in results)
    passed = sum(1 for _, _, ok in results if ok)
    print(f"{'TOTAL':<48} {total * 1000:>8.1f} ms {f'{passed}/{len(results)}':>10}")
    print("=" * 78)
