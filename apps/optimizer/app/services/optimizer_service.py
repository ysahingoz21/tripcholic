from datetime import datetime, timezone

from ortools.sat.python import cp_model

from app.schemas.optimize import (
    DailyRoute,
    OptimizeRequest,
    OptimizeResponse,
    OptimizeStatus,
    RoutingSource,
    ScheduledPOI,
    SolverStatus,
)
from app.schemas.common import POICategory
from app.schemas.poi import POI
from app.services.routing_service import build_travel_matrix

ALGORITHM_VERSION = "ortools_cpsat_v1"

# Categories treated as outdoor when POI.is_outdoor is not explicitly set.
_OUTDOOR_CATEGORIES = {POICategory.SCENIC, POICategory.NATURE}

# Curated overrides for POIs the category heuristic gets wrong.
# Matched by exact poi.name. Add or remove entries as the dataset evolves.
_OUTDOOR_NAME_OVERRIDES: set[str] = {
    "Rumeli Fortress",   # historical → open-air castle ruins
    "Istiklal Street",   # shopping → pedestrian street
    "Miniaturk",         # entertainment → open-air miniature park
    "Balat",             # neighborhood → walking tour
    "Karakoy",           # neighborhood → walking tour
    "Moda",              # neighborhood → walking tour
    "Cihangir",          # neighborhood → walking tour
    "Bebek",             # neighborhood → walking tour
}
_INDOOR_NAME_OVERRIDES: set[str] = set()


def _is_outdoor(poi: POI) -> bool:
    """
    Authoritative POI.is_outdoor flag if set; otherwise consult curated name
    overrides; otherwise fall back to a category heuristic.
    """
    if poi.is_outdoor is not None:
        return poi.is_outdoor
    if poi.name in _OUTDOOR_NAME_OVERRIDES:
        return True
    if poi.name in _INDOOR_NAME_OVERRIDES:
        return False
    return poi.category in _OUTDOOR_CATEGORIES

# OR-Tools works with integers — we scale minutes to this resolution.
_TIME_SCALE = 1          # 1 unit = 1 minute (no scaling needed here)
_COST_SCALE = 100        # 1 unit = 0.01 TL  (keeps integers manageable)
_SOLVER_TIMEOUT_SEC = 3  # wall-clock limit; INFEASIBLE on timeout (no fallback)
_CATEGORY_COVERAGE_BONUS = 10_000


def generate_route(request: OptimizeRequest) -> OptimizeResponse:
    """
    Constraint-aware route optimizer using OR-Tools CP-SAT.

    Models the single-day itinerary as a Time-Windowed Orienteering Problem:
      - Each POI has a time window [open, close], visit duration, and cost.
      - An optional arc connects consecutive stops with a travel-time penalty.
      - Objective: maximise a weighted score (preference match + visit value)
        subject to time-window, budget, walking-distance, and max-stop constraints.

    Returns INFEASIBLE if CP-SAT cannot find a feasible solution within
    _SOLVER_TIMEOUT_SEC seconds. No greedy fallback — the user is asked to
    relax constraints rather than receiving a lower-quality route.
    """
    prefs = request.preferences

    start_min = _to_minutes(prefs.time_start)
    end_min   = _resolve_end_minute(start_min, prefs.time_end)
    budget_units = int(prefs.budget_tl * _COST_SCALE)
    max_pois  = prefs.max_pois or 6

    # ── 1. Use candidate POIs as-is — backend already filtered by DB query ───
    candidates = list(request.candidate_pois)
    diagnostics: list[str] = []

    if not candidates:
        diagnostics.append("Request contained no candidate POIs.")
        return _empty_response(
            request,
            status=OptimizeStatus.EMPTY_CANDIDATES,
            solver_status=SolverStatus.NOT_RUN,
            routing_source=RoutingSource.NONE,
            diagnostics=diagnostics,
        )

    # ── 1b. Weather filter — drop outdoor POIs on rainy days ─────────────────
    if prefs.weather == "rainy":
        outdoor = [p for p in candidates if _is_outdoor(p)]
        indoor = [p for p in candidates if not _is_outdoor(p)]
        if outdoor and indoor:
            diagnostics.append(
                f"Weather is rainy — excluded {len(outdoor)} outdoor candidate(s) "
                f"({', '.join(p.name for p in outdoor)})."
            )
            candidates = indoor
        elif outdoor and not indoor:
            diagnostics.append(
                f"Weather is rainy but all {len(outdoor)} candidates are outdoor; "
                "weather filter bypassed to keep a route possible."
            )

    # ── 2. Travel-time matrix ────────────────────────────────────────────────
    matrix, routing_source_str = build_travel_matrix(candidates)
    routing_source = RoutingSource(routing_source_str)
    if routing_source == RoutingSource.HAVERSINE:
        diagnostics.append(
            "OSRM unavailable; using Haversine straight-line distance at 5 km/h "
            "(travel times may be optimistic)."
        )

    # ── 3. Pre-flight constraint conflict checks ─────────────────────────────
    diagnostics.extend(_preflight_diagnostics(
        candidates=candidates,
        matrix=matrix,
        start_min=start_min,
        end_min=end_min,
        budget_tl=prefs.budget_tl,
        walking_tolerance_km=prefs.walking_tolerance_km,
        preferred_categories=prefs.categories,
    ))

    # ── 4. Score each candidate ──────────────────────────────────────────────
    scores = _compute_scores(candidates, prefs.categories, request.destination_anchor)

    # ── 4. Solve with OR-Tools CP-SAT ────────────────────────────────────────
    selected_indices, start_times, solver_status = _solve_cpsat(
        candidates=candidates,
        matrix=matrix,
        scores=scores,
        start_min=start_min,
        end_min=end_min,
        budget_units=budget_units,
        max_pois=max_pois,
        walking_tolerance_km=prefs.walking_tolerance_km,
        preferred_categories=prefs.categories,
    )

    # ── 5. No feasible route → return INFEASIBLE (no fallback) ───────────────
    if not selected_indices:
        if solver_status == SolverStatus.INFEASIBLE:
            diagnostics.append(
                "CP-SAT reported the problem infeasible under the given constraints. "
                "Try relaxing budget, time window, walking tolerance, or max_pois."
            )
        else:
            diagnostics.append(
                f"CP-SAT did not return a solution within {_SOLVER_TIMEOUT_SEC}s. "
                "The problem may be over-constrained — try relaxing constraints."
            )
        return _empty_response(
            request,
            status=OptimizeStatus.INFEASIBLE,
            solver_status=solver_status,
            routing_source=routing_source,
            diagnostics=diagnostics,
        )

    # ── 6. Build response ────────────────────────────────────────────────────
    return _build_response(
        request=request,
        candidates=candidates,
        selected_indices=selected_indices,
        start_times=start_times,
        matrix=matrix,
        solver_status=solver_status,
        routing_source=routing_source,
        diagnostics=diagnostics,
    )


# ── CP-SAT model ──────────────────────────────────────────────────────────────

def _solve_cpsat(
    candidates: list[POI],
    matrix: list[list[float]],
    scores: list[int],
    start_min: int,
    end_min: int,
    budget_units: int,
    max_pois: int,
    walking_tolerance_km: float,
    preferred_categories: list,
) -> tuple[list[int], dict[int, int], SolverStatus]:
    """
    Returns (ordered list of selected indices, {index: arrival_minute}).

    Circuit-based Time-Windowed Orienteering using OR-Tools CP-SAT.
    Depot node = index n (virtual start/end point).

    Key insight: AddCircuit requires every node to appear in exactly one cycle.
    Unvisited POI nodes use self-loop arcs (skip[i]) to satisfy this.
    x[i] = NOT skip[i], i.e. POI i is visited iff its self-loop is inactive.

    Variables:
      skip[i]    BoolVar  — POI i is skipped (self-loop active)
      x[i]       BoolVar  — POI i is visited  (= NOT skip[i])
      arc[i][j]  BoolVar  — route goes directly from i to j  (i≠j, real arcs)
      arrival[i] IntVar   — arrival time at POI i in minutes

    Constraints:
      C1  At most max_pois stops.
      C2  Budget: sum cost[i]*x[i] <= budget.
      C3  Time window per visited POI: open[i] <= arrival[i], arrival[i]+dur[i] <= close[i].
      C4  Travel time: arrival[j] >= arrival[i] + dur[i] + travel[i][j] if arc[i][j].
      C5  Walking tolerance: arcs exceeding max_travel_min are forced off.

    Objective: maximise category coverage first, then sum(score[i] * x[i]).
    """
    n = len(candidates)
    if n == 0:
        return [], {}, SolverStatus.NOT_RUN

    model = cp_model.CpModel()
    depot = n
    _WALK_SPEED_KMH_LOCAL = 5.0
    max_travel_min = int(walking_tolerance_km / _WALK_SPEED_KMH_LOCAL * 60)

    # ── Arc variables ─────────────────────────────────────────────────────────
    # Self-loops for skipped POI nodes
    skip: list[cp_model.IntVar] = [model.new_bool_var(f"skip_{i}") for i in range(n)]
    x:    list[cp_model.IntVar] = [skip[i].negated() for i in range(n)]

    # Real arcs between distinct nodes (including depot↔POI)
    arc: dict[tuple[int, int], cp_model.IntVar] = {}
    for i in range(n + 1):
        for j in range(n + 1):
            if i != j:
                arc[(i, j)] = model.new_bool_var(f"arc_{i}_{j}")

    # ── Circuit constraint ────────────────────────────────────────────────────
    circuit: list[tuple[int, int, cp_model.IntVar]] = []
    for i in range(n):
        circuit.append((i, i, skip[i]))          # self-loop = skip
    for (i, j), v in arc.items():
        circuit.append((i, j, v))
    model.add_circuit(circuit)

    # ── Arrival time variables ────────────────────────────────────────────────
    arrival = [model.new_int_var(start_min, end_min, f"arr_{i}") for i in range(n)]

    # ── C1: Max stops ─────────────────────────────────────────────────────────
    model.add(sum(skip[i].negated() for i in range(n)) <= max_pois)

    # ── C2: Budget ────────────────────────────────────────────────────────────
    cost_units = [int(candidates[i].budget.min_tl * _COST_SCALE) for i in range(n)]
    model.add(
        sum(cost_units[i] * skip[i].negated() for i in range(n)) <= budget_units
    )

    # ── C3: Time windows ──────────────────────────────────────────────────────
    for i in range(n):
        poi   = candidates[i]
        open_i, close_i = _opening_window_for_trip(
            poi.opening_hours.open,
            poi.opening_hours.close,
            start_min,
            end_min,
        )
        dur_i   = poi.visit_duration_minutes
        not_skip = skip[i].negated()
        model.add(arrival[i] >= max(open_i, start_min)).only_enforce_if(not_skip)
        model.add(arrival[i] + dur_i <= min(close_i, end_min)).only_enforce_if(not_skip)

    # ── C4 + C5: Travel propagation and walking tolerance ─────────────────────
    for i in range(n):
        dur_i = candidates[i].visit_duration_minutes
        for j in range(n):
            if i == j:
                continue
            travel_ij = int(matrix[i][j]) + 1  # ceiling to guarantee progress
            arc_ij = arc[(i, j)]

            if travel_ij - 1 > max_travel_min:
                model.add(arc_ij == 0)          # C5: too far, disable arc
            else:
                model.add(                       # C4: propagate time
                    arrival[j] >= arrival[i] + dur_i + travel_ij
                ).only_enforce_if(arc_ij)

    # ── Soft category coverage ────────────────────────────────────────────────
    # Selected categories are user intent, so covering more of them should beat
    # picking another same-category POI with a slightly better individual score.
    # This remains soft: if time/budget/walking constraints make a category
    # impossible, CP-SAT can still return the best feasible partial route.
    cover_vars: list[cp_model.IntVar] = []
    requested_categories = list(dict.fromkeys(preferred_categories or []))
    for category in requested_categories:
        category_indices = [
            i for i, poi in enumerate(candidates) if poi.category == category
        ]
        if not category_indices:
            continue

        category_name = category.value if hasattr(category, "value") else str(category)
        safe_name = category_name.replace(".", "_").replace("-", "_")
        covered = model.new_bool_var(f"cover_{safe_name}")
        selected_in_category = sum(skip[i].negated() for i in category_indices)
        model.add(selected_in_category >= covered)
        model.add(selected_in_category <= len(category_indices) * covered)
        cover_vars.append(covered)

    # ── Objective ─────────────────────────────────────────────────────────────
    model.maximize(
        sum(_CATEGORY_COVERAGE_BONUS * covered for covered in cover_vars)
        + sum(scores[i] * skip[i].negated() for i in range(n))
    )

    # ── Solve ─────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = _SOLVER_TIMEOUT_SEC
    solver.parameters.num_workers = 1  # single-threaded avoids parallel overhead
    status = solver.solve(model)

    if status == cp_model.INFEASIBLE:
        return [], {}, SolverStatus.INFEASIBLE
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # UNKNOWN / MODEL_INVALID — treat as a timeout-style outcome.
        return [], {}, SolverStatus.TIMEOUT

    selected = [i for i in range(n) if solver.boolean_value(skip[i].negated())]
    if not selected:
        # Solver returned a trivial empty cycle; treat as infeasible for our purposes.
        return [], {}, SolverStatus.INFEASIBLE

    ordered = _extract_order(solver, arc, depot, n)
    arrival_minutes = {i: solver.value(arrival[i]) for i in ordered}
    solver_status = SolverStatus.OPTIMAL if status == cp_model.OPTIMAL else SolverStatus.FEASIBLE
    return ordered, arrival_minutes, solver_status


def _extract_order(
    solver: cp_model.CpSolver,
    arc: dict[tuple[int, int], cp_model.IntVar],
    depot: int,
    n: int,
) -> list[int]:
    """Walk the active circuit from depot to recover the ordered visit sequence."""
    next_node: dict[int, int] = {
        i: j for (i, j), v in arc.items() if i != j and solver.value(v) == 1
    }
    order: list[int] = []
    current = depot
    seen: set[int] = set()
    while True:
        nxt = next_node.get(current)
        if nxt is None or nxt == depot or nxt in seen:
            break
        order.append(nxt)
        seen.add(nxt)
        current = nxt
    return order


# ── Pre-flight diagnostics ────────────────────────────────────────────────────

def _preflight_diagnostics(
    candidates: list[POI],
    matrix: list[list[float]],
    start_min: int,
    end_min: int,
    budget_tl: float,
    walking_tolerance_km: float,
    preferred_categories: list,
) -> list[str]:
    """
    Cheap pre-solve sanity checks. Advisory only — never short-circuits CP-SAT.

    Detects common constraint conflicts and emits human-readable diagnostics that
    the mobile app can surface to explain partial or empty routes.
    """
    notes: list[str] = []
    if not candidates:
        return notes

    # 1. Budget vs cheapest POI
    cheapest = min(candidates, key=lambda p: p.budget.min_tl)
    if cheapest.budget.min_tl > budget_tl:
        notes.append(
            f"Budget {budget_tl:.0f} TL is below the cheapest candidate "
            f"'{cheapest.name}' at {cheapest.budget.min_tl:.0f} TL — "
            "no POI fits the current budget."
        )

    # 2. Time window vs shortest visit
    window_min = end_min - start_min
    shortest = min(candidates, key=lambda p: p.visit_duration_minutes)
    if window_min < shortest.visit_duration_minutes:
        notes.append(
            f"Time window is {window_min} min but the shortest visit "
            f"('{shortest.name}', {shortest.visit_duration_minutes} min) "
            "does not fit — widen time_start/time_end."
        )

    # 3. Opening-hours overlap with [start, end]
    overlapping = 0
    for p in candidates:
        open_min, close_min = _opening_window_for_trip(
            p.opening_hours.open,
            p.opening_hours.close,
            start_min,
            end_min,
        )
        if open_min < end_min and close_min > start_min:
            overlapping += 1
    if overlapping == 0:
        notes.append(
            "No candidate POI is open during the requested time window — "
            "consider shifting time_start/time_end."
        )
    elif overlapping < len(candidates) / 2:
        notes.append(
            f"Only {overlapping} of {len(candidates)} candidates overlap the "
            "requested time window — consider widening it for more options."
        )

    # 4. Walking tolerance vs nearest inter-POI travel time
    if len(candidates) >= 2:
        max_travel_min = walking_tolerance_km / _WALK_SPEED_KMH * 60
        nearest = min(
            matrix[i][j]
            for i in range(len(candidates))
            for j in range(len(candidates))
            if i != j
        )
        if nearest > max_travel_min:
            nearest_km = nearest / 60 * _WALK_SPEED_KMH
            notes.append(
                f"Walking tolerance {walking_tolerance_km:.1f} km is below the "
                f"closest pair distance ({nearest_km:.1f} km) — solver may be "
                "forced to a single stop."
            )

    # 5. Category mismatch
    if preferred_categories:
        preferred_set = set(preferred_categories)
        if not any(p.category in preferred_set for p in candidates):
            notes.append(
                "No candidate POI matches the requested categories — scoring will "
                "treat all candidates equally."
            )

    return notes


# ── Score computation ─────────────────────────────────────────────────────────

def _compute_scores(
    candidates: list[POI],
    preferred_categories: list,
    destination_anchor=None,
) -> list[int]:
    """
    Score = category match bonus + visit_duration bonus + proximity bonus.

    Proximity bonus rewards POIs geographically close to the user's destination
    anchor (district centroid). Acts as a tie-breaker between same-category POIs
    so the route stays anchored to the user's chosen area even when the backend
    had to pull in nearby out-of-district candidates.

    Keeps integers for CP-SAT while still differentiating POIs.
    """
    preferred_set = set(preferred_categories) if preferred_categories else set()
    scores = []
    for poi in candidates:
        score = 200 if poi.category in preferred_set else 100
        # Small bonus for longer/richer experiences (max +50)
        duration_bonus = min(50, poi.visit_duration_minutes // 6)
        proximity_bonus = _proximity_bonus(poi, destination_anchor)
        scores.append(score + duration_bonus + proximity_bonus)
    return scores


def _proximity_bonus(poi: POI, anchor) -> int:
    """+60 within 5 km, +30 within 15 km, 0 beyond. No anchor → 0."""
    if anchor is None:
        return 0
    distance_km = _haversine_km(
        anchor.lat, anchor.lng, poi.location.lat, poi.location.lng
    )
    if distance_km <= 5:
        return 60
    if distance_km <= 15:
        return 30
    return 0


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    import math

    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _format_categories(categories: list) -> str:
    labels = [
        category.value if hasattr(category, "value") else str(category)
        for category in categories
    ]
    if len(labels) <= 1:
        return labels[0] if labels else ""
    if len(labels) == 2:
        return f"{labels[0]} and {labels[1]}"
    return f"{', '.join(labels[:-1])}, and {labels[-1]}"


# ── Response builders ─────────────────────────────────────────────────────────

_WALK_SPEED_KMH = 5.0


def _build_response(
    request: OptimizeRequest,
    candidates: list[POI],
    selected_indices: list[int],
    start_times: dict[int, int],
    matrix: list[list[float]],
    solver_status: SolverStatus,
    routing_source: RoutingSource,
    diagnostics: list[str],
) -> OptimizeResponse:
    stops: list[ScheduledPOI] = []
    total_cost = 0.0

    for idx in selected_indices:
        poi = candidates[idx]
        arrival_min = start_times[idx]
        departure_min = arrival_min + poi.visit_duration_minutes
        cost = poi.budget.min_tl
        stops.append(ScheduledPOI(
            poi_id=poi.poi_id,
            name=poi.name,
            arrival_time=_fmt(arrival_min),
            departure_time=_fmt(departure_min),
            travel_time_to_next_minutes=None,
            estimated_cost_tl=cost,
        ))
        total_cost += cost

    _backfill_travel(stops, candidates, matrix)

    requested_max = request.preferences.max_pois or 6
    status = OptimizeStatus.OK if len(stops) >= requested_max else OptimizeStatus.PARTIAL
    if status == OptimizeStatus.PARTIAL:
        diagnostics.append(
            f"Solver returned {len(stops)} of {requested_max} requested stops — "
            "no further POI improved the objective without violating a constraint."
        )

    requested_categories = list(dict.fromkeys(request.preferences.categories or []))
    candidate_categories = {poi.category for poi in candidates}
    selected_categories = {candidates[idx].category for idx in selected_indices}

    if len(requested_categories) > requested_max:
        diagnostics.append(
            f"User selected {len(requested_categories)} category type(s), but max_pois "
            f"allows only {requested_max} stop(s); optimizer covered the best feasible subset."
        )

    unavailable_categories = [
        category for category in requested_categories if category not in candidate_categories
    ]
    if unavailable_categories:
        diagnostics.append(
            "No candidate POIs were available for selected category type(s): "
            f"{_format_categories(unavailable_categories)}."
        )

    omitted_categories = [
        category
        for category in requested_categories
        if category in candidate_categories and category not in selected_categories
    ]
    if omitted_categories:
        diagnostics.append(
            "Could not fit selected category type(s) into the final route under "
            "the current time, budget, walking, and opening-hour constraints: "
            f"{_format_categories(omitted_categories)}."
        )

    start_min = _to_minutes(request.preferences.time_start)
    return _finalise_response(
        request,
        stops,
        total_cost,
        start_min,
        algorithm=ALGORITHM_VERSION,
        status=status,
        solver_status=solver_status,
        routing_source=routing_source,
        diagnostics=diagnostics,
    )


def _backfill_travel(
    stops: list[ScheduledPOI],
    candidates: list[POI],
    matrix: list[list[float]],
) -> None:
    """Fill travel_time_to_next_minutes for all stops except the last."""
    if len(stops) < 2:
        return
    idx_map = {s.poi_id: next(i for i, c in enumerate(candidates) if c.poi_id == s.poi_id)
               for s in stops}
    for k in range(len(stops) - 1):
        i = idx_map[stops[k].poi_id]
        j = idx_map[stops[k + 1].poi_id]
        travel = matrix[i][j]
        stops[k] = stops[k].model_copy(
            update={"travel_time_to_next_minutes": max(1, int(travel))}
        )


def _finalise_response(
    request: OptimizeRequest,
    stops: list[ScheduledPOI],
    total_cost: float,
    start_min: int,
    algorithm: str,
    status: OptimizeStatus,
    solver_status: SolverStatus,
    routing_source: RoutingSource,
    diagnostics: list[str],
) -> OptimizeResponse:
    last_dep_min = _to_minutes(stops[-1].departure_time)
    if last_dep_min <= start_min:
        last_dep_min += 24 * 60
    total_duration = last_dep_min - start_min

    total_travel_min = sum(
        s.travel_time_to_next_minutes for s in stops if s.travel_time_to_next_minutes
    )
    total_distance_km = round(total_travel_min / 60 * _WALK_SPEED_KMH, 2)

    route = DailyRoute(
        route_name=f"Istanbul Day Trip — {request.date}",
        total_distance_km=max(total_distance_km, 0.0),
        total_cost_tl=round(total_cost, 2),
        total_duration_minutes=max(total_duration, 0),
        stops=stops,
    )
    return OptimizeResponse(
        trip_id=request.trip_id,
        date=request.date,
        route=route,
        algorithm_used=algorithm,
        status=status,
        solver_status=solver_status,
        routing_source=routing_source,
        diagnostics=diagnostics,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ── Utilities ─────────────────────────────────────────────────────────────────

def _to_minutes(hhmm: str) -> int:
    h, m = map(int, hhmm.split(":"))
    return h * 60 + m


def _resolve_end_minute(start_min: int, end_hhmm: str) -> int:
    end_min = _to_minutes(end_hhmm)
    if end_min <= start_min:
        end_min += 24 * 60
    return end_min


def _opening_window_for_trip(
    open_hhmm: str,
    close_hhmm: str,
    trip_start_min: int,
    trip_end_min: int,
) -> tuple[int, int]:
    open_min = _to_minutes(open_hhmm)
    close_min = _to_minutes(close_hhmm)

    if close_min <= open_min:
        close_min += 24 * 60

    # If the trip itself crosses midnight, POIs with same-day opening hours may
    # need to be considered on the next calendar day as well.
    if trip_end_min > 24 * 60 and close_min <= trip_start_min:
        open_min += 24 * 60
        close_min += 24 * 60

    return open_min, close_min


def _fmt(total_minutes: int) -> str:
    h = (total_minutes % (24 * 60)) // 60
    m = total_minutes % 60
    return f"{h:02d}:{m:02d}"


def _empty_response(
    request: OptimizeRequest,
    status: OptimizeStatus,
    solver_status: SolverStatus,
    routing_source: RoutingSource,
    diagnostics: list[str],
) -> OptimizeResponse:
    route = DailyRoute(
        route_name=f"Istanbul Day Trip — {request.date}",
        total_distance_km=0.0,
        total_cost_tl=0.0,
        total_duration_minutes=0,
        stops=[],
    )
    return OptimizeResponse(
        trip_id=request.trip_id,
        date=request.date,
        route=route,
        algorithm_used=ALGORITHM_VERSION,
        status=status,
        solver_status=solver_status,
        routing_source=routing_source,
        diagnostics=diagnostics,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
