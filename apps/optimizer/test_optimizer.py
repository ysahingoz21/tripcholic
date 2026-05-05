"""
Optimizer test script — mirrors the production path.

Replicates what trips.service.ts does:
  1. Build a list of candidate POIs (as if fetched from the DB and mapped)
  2. Pass them directly to optimizer_service.generate_route

Before running ensure that venv is activated and dependencies are installed. # source venv/bin/activate && pip install -r requirements.txt 
Run from the optimizer directory:
    python test_optimizer.py
"""

from app.schemas.common import BudgetRange, Location, OpeningHours, POICategory
from app.schemas.optimize import OptimizeRequest
from app.schemas.poi import POI
from app.schemas.preferences import UserPreferences
from app.services.optimizer_service import generate_route


# ── Shared POI dataset (mirrors what the DB would return) ────────────────────

def _poi(poi_id, name, lat, lng, category, open_t, close_t, min_tl, max_tl, duration_min) -> POI:
    return POI(
        poi_id=poi_id,
        name=name,
        location=Location(lat=lat, lng=lng),
        category=POICategory(category),
        opening_hours=OpeningHours(open=open_t, close=close_t),
        budget=BudgetRange(min_tl=min_tl, max_tl=max_tl),
        visit_duration_minutes=duration_min,
    )


ALL_POIS: list[POI] = [
    # Historical
    _poi("h1",  "Hagia Sophia",              41.0086, 28.9802, "historical", "09:00", "19:00",    0,    0,  90),
    _poi("h2",  "Topkapi Palace",            41.0115, 28.9833, "historical", "09:00", "18:00",  500, 1000, 120),
    _poi("h3",  "Blue Mosque",               41.0055, 28.9769, "historical", "08:30", "19:30",    0,    0,  60),
    _poi("h4",  "Galata Tower",              41.0256, 28.9744, "historical", "08:00", "22:00",  350,  350,  45),
    _poi("h5",  "Basilica Cistern",          41.0084, 28.9778, "historical", "09:00", "18:30",  300,  300,  45),
    _poi("h6",  "Dolmabahce Palace",         41.0392, 29.0003, "historical", "09:00", "16:00",  900,  900,  90),
    _poi("h7",  "Rumeli Fortress",           41.0847, 29.0559, "historical", "09:00", "17:00",  100,  100,  60),
    _poi("h8",  "Chora Church",              41.0316, 28.9393, "historical", "09:00", "18:00",  150,  150,  45),
    _poi("h9",  "Istanbul Archaeology Museum", 41.0123, 28.9818, "historical", "09:00", "19:00", 200, 200,  90),
    _poi("h10", "Yildiz Palace",             41.0503, 29.0128, "historical", "09:00", "17:00",  100,  100,  60),
    # Scenic
    _poi("s1",  "Bosphorus Viewpoint",       41.0480, 29.0300, "scenic",     "00:00", "23:59",    0,    0,  30),
    _poi("s2",  "Pierre Loti Hill",          41.0558, 28.9344, "scenic",     "08:00", "22:00",    0,    0,  45),
    _poi("s3",  "Camlica Hill",              41.0276, 29.0689, "scenic",     "08:00", "22:00",    0,    0,  40),
    _poi("s4",  "Galata Bridge",             41.0186, 28.9742, "scenic",     "00:00", "23:59",    0,    0,  20),
    _poi("s5",  "Maiden's Tower",            41.0212, 29.0041, "scenic",     "09:00", "22:00",  150,  150,  45),
    # Food
    _poi("f1",  "Karakoy Lokantasi",         41.0228, 28.9755, "food",       "12:00", "22:00",  400,  800,  60),
    _poi("f2",  "Ciya Sofrasi",              41.0018, 29.0261, "food",       "11:00", "21:00",  300,  600,  60),
    _poi("f3",  "Hafiz Mustafa",             41.0095, 28.9800, "food",       "08:00", "23:00",  150,  300,  30),
    _poi("f4",  "Balıkçı Sabahattin",        41.0070, 28.9780, "food",       "12:00", "23:00",  600, 1200,  75),
    _poi("f5",  "Pandeli Restaurant",        41.0163, 28.9704, "food",       "12:00", "16:00",  500,  900,  60),
    _poi("f6",  "Mikla Restaurant",          41.0335, 28.9773, "food",       "18:00", "23:00",  800, 1500,  90),
    _poi("f7",  "Bab-i Hayat",               41.0090, 28.9810, "food",       "09:00", "23:00",  200,  500,  45),
    # Shopping
    _poi("sh1", "Grand Bazaar",              41.0108, 28.9681, "shopping",   "09:00", "19:00",    0,  500,  90),
    _poi("sh2", "Spice Bazaar",              41.0163, 28.9704, "shopping",   "08:30", "19:30",    0,  300,  45),
    _poi("sh3", "Istiklal Street",           41.0335, 28.9773, "shopping",   "09:00", "23:00",    0,  200,  60),
    _poi("sh4", "Arasta Bazaar",             41.0053, 28.9786, "shopping",   "09:00", "18:00",    0,  200,  30),
    _poi("sh5", "Kanyon Mall",               41.0796, 29.0107, "shopping",   "10:00", "22:00",    0,  300,  60),
    # Entertainment
    _poi("e1",  "Istanbul Modern",           41.0255, 28.9811, "entertainment", "10:00", "18:00", 250, 250,  90),
    _poi("e2",  "Miniaturk",                 41.0598, 28.9466, "entertainment", "09:00", "19:00", 180, 180,  90),
    _poi("e3",  "Rahmi Koc Museum",          41.0437, 28.9498, "entertainment", "10:00", "17:00", 200, 200,  90),
    _poi("e4",  "Pera Museum",               41.0323, 28.9762, "entertainment", "10:00", "19:00", 200, 200,  75),
    _poi("e5",  "Istanbul Aquarium",         41.0634, 28.8064, "entertainment", "10:00", "21:00", 350, 350, 120),
    # Nature
    _poi("n1",  "Emirgan Park",              41.0969, 29.0517, "nature",     "07:00", "21:00",    0,    0,  60),
    _poi("n2",  "Belgrad Forest",            41.1730, 28.9690, "nature",     "08:00", "20:00",    0,    0, 120),
    _poi("n3",  "Gülhane Park",              41.0130, 28.9842, "nature",     "07:00", "22:00",    0,    0,  30),
    # Neighborhood
    _poi("nb1", "Balat",                     41.0295, 28.9487, "neighborhood","00:00","23:59",    0,    0,  60),
    _poi("nb2", "Karakoy",                   41.0228, 28.9741, "neighborhood","00:00","23:59",    0,    0,  45),
    _poi("nb3", "Moda",                      40.9870, 29.0325, "neighborhood","00:00","23:59",    0,    0,  45),
    _poi("nb4", "Cihangir",                  41.0290, 28.9830, "neighborhood","00:00","23:59",    0,    0,  45),
    _poi("nb5", "Bebek",                     41.0776, 29.0435, "neighborhood","00:00","23:59",    0,    0,  40),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def filter_candidates(
    pois: list[POI],
    categories: list[POICategory],
    budget_tl: float,
    weather: str | None = None,
) -> list[POI]:
    """
    Mirrors affordableBudgetLevels + pointOfInterest.findMany in trips.service.ts.
    Filters by category, max affordable cost, and weather (rainy excludes outdoor).
    """
    outdoor = {POICategory.SCENIC, POICategory.NATURE, POICategory.NEIGHBORHOOD}
    result = []
    for poi in pois:
        if poi.category not in categories:
            continue
        if poi.budget.min_tl > budget_tl:
            continue
        if weather == "rainy" and poi.category in outdoor:
            continue
        result.append(poi)
    return result[:50]


def build_request(
    trip_id: str,
    categories: list[str],
    time_start: str,
    time_end: str,
    budget_tl: float,
    walking_km: float = 3.0,
    max_pois: int = 6,
    weather: str | None = None,
) -> tuple[OptimizeRequest, list[POI]]:
    cat_enums = [POICategory(c) for c in categories]
    candidates = filter_candidates(ALL_POIS, cat_enums, budget_tl, weather)
    request = OptimizeRequest(
        trip_id=trip_id,
        date="2026-04-08",
        preferences=UserPreferences(
            categories=cat_enums,
            time_start=time_start,
            time_end=time_end,
            budget_tl=budget_tl,
            walking_tolerance_km=walking_km,
            max_pois=max_pois,
            weather=weather,
        ),
        candidate_pois=candidates,
    )
    return request, candidates


def run(label: str, request: OptimizeRequest, candidates: list[POI]):
    import time
    print(f"{'='*60}")
    print(f"TEST: {label}")
    print(f"  Candidates sent to optimizer: {len(candidates)}")
    print(f"{'='*60}")

    t0 = time.perf_counter()
    resp = generate_route(request)
    elapsed = time.perf_counter() - t0

    stops = resp.route.stops
    is_greedy = "greedy" in resp.algorithm_used
    solver_tag = "⚠️  GREEDY FALLBACK" if is_greedy else "✓  CP-SAT"

    if not stops:
        print(f"  Solver    : {solver_tag}")
        print(f"  Time      : {elapsed:.3f}s")
        print("  Result : NO ROUTE GENERATED\n")
        return resp

    print(f"  Solver    : {solver_tag}")
    print(f"  Time      : {elapsed:.3f}s")
    print(f"  Algorithm : {resp.algorithm_used}")
    print(f"  Stops     : {len(stops)}")
    print(f"  Total cost: {resp.route.total_cost_tl} TL")
    print(f"  Duration  : {resp.route.total_duration_minutes} min")
    print(f"  Distance  : {resp.route.total_distance_km} km")
    print()
    for s in stops:
        travel = f" +{s.travel_time_to_next_minutes}min →" if s.travel_time_to_next_minutes else "  [last]"
        print(f"  {s.arrival_time}–{s.departure_time}  {s.name:<35} {s.estimated_cost_tl:>6.0f} TL  {travel}")
    print()
    return resp


def check(label: str, condition: bool, detail: str = ""):
    status = "✓ PASS" if condition else "✗ FAIL"
    print(f"  [{status}] {label}" + (f"  ({detail})" if detail else ""))
    if not condition:
        raise AssertionError(f"Constraint failed: {label} — {detail}")


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_historical_food():
    """Standard day trip — most common use case."""
    req, candidates = build_request(
        trip_id="t1",
        categories=["historical", "food"],
        time_start="09:00", time_end="18:00",
        budget_tl=3000, max_pois=5,
    )
    resp = run("Historical + food, 3000 TL, max 5 stops", req, candidates)

    check("Candidates are historical+food only",
          all(p.category in {POICategory.HISTORICAL, POICategory.FOOD} for p in candidates))
    check("At least 1 stop", len(resp.route.stops) >= 1)
    check("Max 5 stops", len(resp.route.stops) <= 5)
    check("Budget respected", resp.route.total_cost_tl <= 3000,
          f"{resp.route.total_cost_tl} TL")
    check("Algorithm is CP-SAT", "cpsat" in resp.algorithm_used)

    stops = resp.route.stops
    for i in range(1, len(stops)):
        prev_dep = sum(int(x) * m for x, m in zip(stops[i-1].departure_time.split(":"), [60, 1]))
        curr_arr = sum(int(x) * m for x, m in zip(stops[i].arrival_time.split(":"), [60, 1]))
        check(f"Stop {i} arrives after stop {i-1} departs",
              curr_arr >= prev_dep,
              f"{stops[i].arrival_time} >= {stops[i-1].departure_time}")


def test_tight_budget():
    """Low budget should still find free/cheap POIs."""
    req, candidates = build_request(
        trip_id="t2",
        categories=["historical", "scenic"],
        time_start="09:00", time_end="18:00",
        budget_tl=500, max_pois=6,
    )
    resp = run("Tight budget (500 TL)", req, candidates)

    check("Budget respected", resp.route.total_cost_tl <= 500,
          f"{resp.route.total_cost_tl} TL")
    # Free POIs (Hagia Sophia, Blue Mosque, scenic) should still be selectable
    check("At least 1 stop found", len(resp.route.stops) >= 1)


def test_short_window():
    """Only 2 hours — should return fewer stops."""
    req, candidates = build_request(
        trip_id="t3",
        categories=["historical", "food", "shopping"],
        time_start="15:00", time_end="17:00",
        budget_tl=5000, max_pois=6,
    )
    resp = run("Short time window (15:00–17:00)", req, candidates)

    end_min = 17 * 60
    for s in resp.route.stops:
        h, m = map(int, s.departure_time.split(":"))
        check(f"{s.name} departs by 17:00", h * 60 + m <= end_min, s.departure_time)


def test_rainy_weather():
    """Rainy day — scenic/nature/neighborhood must be excluded before optimizer sees them."""
    outdoor = {POICategory.SCENIC, POICategory.NATURE, POICategory.NEIGHBORHOOD}
    req, candidates = build_request(
        trip_id="t4",
        categories=["historical", "scenic", "food"],
        time_start="09:00", time_end="18:00",
        budget_tl=4000, max_pois=5,
        weather="rainy",
    )
    resp = run("Rainy weather (outdoor filtered before optimizer)", req, candidates)

    check("No outdoor POIs in candidates",
          all(p.category not in outdoor for p in candidates),
          f"found: {[p.name for p in candidates if p.category in outdoor]}")
    for s in resp.route.stops:
        poi = next(p for p in candidates if p.poi_id == s.poi_id)
        check(f"{s.name} not outdoor", poi.category not in outdoor, poi.category.value)


def test_entertainment():
    """Entertainment + food afternoon/evening."""
    req, candidates = build_request(
        trip_id="t5",
        categories=["entertainment", "food"],
        time_start="12:00", time_end="22:00",
        budget_tl=5000, max_pois=4,
    )
    resp = run("Entertainment + food, afternoon/evening", req, candidates)

    check("Candidates are entertainment+food only",
          all(p.category in {POICategory.ENTERTAINMENT, POICategory.FOOD} for p in candidates))
    check("Budget respected", resp.route.total_cost_tl <= 5000,
          f"{resp.route.total_cost_tl} TL")


def test_zero_budget():
    """Budget of effectively 0 TL — only free POIs should be selected."""
    req, candidates = build_request(
        trip_id="t6",
        categories=["historical", "scenic", "nature"],
        time_start="09:00", time_end="18:00",
        budget_tl=0.01,
    )
    resp = run("Zero budget — only free POIs", req, candidates)

    check("All candidates are free", all(p.budget.min_tl == 0 for p in candidates))
    check("Total cost is 0", resp.route.total_cost_tl == 0.0,
          f"{resp.route.total_cost_tl} TL")
    for s in resp.route.stops:
        check(f"{s.name} is free", s.estimated_cost_tl == 0.0, f"{s.estimated_cost_tl} TL")


def test_full_day_all_categories():
    """Full day, all categories, generous budget — should fill up to max_pois."""
    req, candidates = build_request(
        trip_id="t7",
        categories=["historical", "scenic", "food", "shopping", "entertainment", "neighborhood"],
        time_start="08:00", time_end="21:00",
        budget_tl=10000, max_pois=6, walking_km=5.0,
    )
    resp = run("Full day, all categories, 10000 TL, max 6 stops", req, candidates)

    check("At least 4 stops for a full day", len(resp.route.stops) >= 4)
    check("Max 6 stops", len(resp.route.stops) <= 6)
    check("Budget respected", resp.route.total_cost_tl <= 10000,
          f"{resp.route.total_cost_tl} TL")


def test_large_candidate_pool():
    """40+ candidate POIs — stress test to confirm CP-SAT still wins over greedy."""
    req, candidates = build_request(
        trip_id="t9",
        categories=["historical", "scenic", "food", "shopping", "entertainment", "nature", "neighborhood"],
        time_start="08:00", time_end="22:00",
        budget_tl=15000, max_pois=8, walking_km=10.0,
    )
    resp = run(f"Large pool ({len(candidates)} candidates), max 8 stops", req, candidates)

    check("CP-SAT used (not greedy fallback)", "cpsat" in resp.algorithm_used)
    check("At least 5 stops", len(resp.route.stops) >= 5)
    check("Max 8 stops", len(resp.route.stops) <= 8)
    check("Budget respected", resp.route.total_cost_tl <= 15000,
          f"{resp.route.total_cost_tl} TL")


def test_opening_hours_respected():
    """All scheduled stops must be visited within their opening hours."""
    req, candidates = build_request(
        trip_id="t8",
        categories=["historical", "entertainment", "food"],
        time_start="09:00", time_end="20:00",
        budget_tl=5000, max_pois=6,
    )
    resp = run("Opening hours respected for all stops", req, candidates)

    poi_map = {p.poi_id: p for p in candidates}
    for s in resp.route.stops:
        poi = poi_map[s.poi_id]
        open_min  = sum(int(x) * m for x, m in zip(poi.opening_hours.open.split(":"),  [60, 1]))
        close_min = sum(int(x) * m for x, m in zip(poi.opening_hours.close.split(":"), [60, 1]))
        arr_min   = sum(int(x) * m for x, m in zip(s.arrival_time.split(":"),          [60, 1]))
        dep_min   = sum(int(x) * m for x, m in zip(s.departure_time.split(":"),        [60, 1]))
        check(f"{s.name} arrives after opening",  arr_min >= open_min,
              f"arrival {s.arrival_time} < open {poi.opening_hours.open}")
        check(f"{s.name} departs before closing", dep_min <= close_min,
              f"departure {s.departure_time} > close {poi.opening_hours.close}")


# ── Run all ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    tests = [
        test_historical_food,
        test_tight_budget,
        test_short_window,
        test_rainy_weather,
        test_entertainment,
        test_zero_budget,
        test_full_day_all_categories,
        test_large_candidate_pool,
        test_opening_hours_respected,
    ]

    import time
    passed, failed = 0, 0
    test_times: list[tuple[str, float]] = []
    for test in tests:
        t0 = time.perf_counter()
        try:
            test()
            elapsed = time.perf_counter() - t0
            test_times.append((test.__name__, elapsed))
            passed += 1
        except AssertionError as e:
            elapsed = time.perf_counter() - t0
            test_times.append((test.__name__, elapsed))
            print(f"  ✗ {e}\n")
            failed += 1
        except Exception as e:
            elapsed = time.perf_counter() - t0
            test_times.append((test.__name__, elapsed))
            import traceback
            print(f"  ✗ Unexpected error: {e}")
            traceback.print_exc()
            failed += 1

    print(f"{'='*60}")
    print(f"Results: {passed}/{len(tests)} passed {'✓' if failed == 0 else '✗'}")
    print(f"{'='*60}")
    print("Test durations:")
    for name, t in test_times:
        print(f"  {name:<40} {t:.3f}s")
    total = sum(t for _, t in test_times)
    print(f"  {'TOTAL':<40} {total:.3f}s")
    print(f"{'='*60}")