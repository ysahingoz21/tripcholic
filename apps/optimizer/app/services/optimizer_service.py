from datetime import datetime, timezone
import math

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
_ORDER_OPTIMIZER_TIMEOUT_SEC = 1
_MAX_SOLVER_STOPS = 20
_CATEGORY_COVERAGE_BONUS = 350
_PRIMARY_DESTINATION_BONUS = 700
_TRAVEL_TIME_PENALTY_PER_MIN = 2


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
    max_pois = min(
        prefs.max_pois or len(request.candidate_pois),
        _MAX_SOLVER_STOPS,
    )

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
    matrix, routing_source_str = build_travel_matrix(
        candidates,
        walking_tolerance_km=prefs.walking_tolerance_km,
    )
    routing_source = RoutingSource(routing_source_str)
    if routing_source == RoutingSource.MULTIMODAL_ESTIMATE:
        diagnostics.append(
            "OSRM unavailable; using distance-based Istanbul transfer estimates "
            "for legs beyond the walking tolerance."
        )

    # ── 3. Pre-flight constraint conflict checks ─────────────────────────────
    diagnostics.extend(_preflight_diagnostics(
        candidates=candidates,
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

    selected_indices, start_times = _optimise_selected_order(
        candidates=candidates,
        matrix=matrix,
        selected_indices=selected_indices,
        original_start_times=start_times,
        start_min=start_min,
        end_min=end_min,
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
      C5  Travel feasibility: longer legs remain possible as transit-style
          transfers, so walking_tolerance controls the local walking/transfer
          split in the routing matrix rather than disabling citywide arcs.

    Objective: maximise POI score with a moderate category-coverage bonus,
    then penalise inter-stop travel so equal-quality routes come out compact.
    """
    n = len(candidates)
    if n == 0:
        return [], {}, SolverStatus.NOT_RUN

    model = cp_model.CpModel()
    depot = n

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

    # ── C4: Travel propagation ────────────────────────────────────────────────
    for i in range(n):
        dur_i = candidates[i].visit_duration_minutes
        for j in range(n):
            if i == j:
                continue
            travel_ij = _travel_minutes(matrix, i, j)
            arc_ij = arc[(i, j)]
            model.add(
                arrival[j] >= arrival[i] + dur_i + travel_ij
            ).only_enforce_if(arc_ij)

    # ── Soft category coverage ────────────────────────────────────────────────
    # Selected categories are user intent, so coverage receives a moderate
    # bonus. It should break close calls, not overpower route quality and
    # proximity by orders of magnitude.
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
    travel_penalty = sum(
        _travel_minutes(matrix, i, j) * arc[(i, j)]
        for i in range(n)
        for j in range(n)
        if i != j
    )
    model.maximize(
        sum(_CATEGORY_COVERAGE_BONUS * covered for covered in cover_vars)
        + sum(scores[i] * skip[i].negated() for i in range(n))
        - _TRAVEL_TIME_PENALTY_PER_MIN * travel_penalty
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


def _optimise_selected_order(
    candidates: list[POI],
    matrix: list[list[float]],
    selected_indices: list[int],
    original_start_times: dict[int, int],
    start_min: int,
    end_min: int,
) -> tuple[list[int], dict[int, int]]:
    """
    Second-pass route ordering for the fixed selected stop set.

    The first CP-SAT solve decides which POIs are worth visiting under all
    constraints. This pass keeps that set and minimizes only the inter-stop
    travel time, then schedules the resulting order as early as possible.
    """
    if len(selected_indices) <= 1:
        schedule = _schedule_order_earliest(
            selected_indices,
            candidates,
            matrix,
            start_min,
            end_min,
        )
        return selected_indices, schedule or original_start_times

    m = len(selected_indices)
    model = cp_model.CpModel()
    depot = m

    arc: dict[tuple[int, int], cp_model.IntVar] = {}
    for i in range(m + 1):
        for j in range(m + 1):
            if i != j:
                arc[(i, j)] = model.new_bool_var(f"order_arc_{i}_{j}")

    model.add_circuit([(i, j, v) for (i, j), v in arc.items()])

    arrival = [model.new_int_var(start_min, end_min, f"order_arr_{i}") for i in range(m)]

    for local_i, global_i in enumerate(selected_indices):
        poi = candidates[global_i]
        open_i, close_i = _opening_window_for_trip(
            poi.opening_hours.open,
            poi.opening_hours.close,
            start_min,
            end_min,
        )
        model.add(arrival[local_i] >= max(open_i, start_min))
        model.add(arrival[local_i] + poi.visit_duration_minutes <= min(close_i, end_min))

    for local_i, global_i in enumerate(selected_indices):
        dur_i = candidates[global_i].visit_duration_minutes
        for local_j, global_j in enumerate(selected_indices):
            if local_i == local_j:
                continue
            model.add(
                arrival[local_j]
                >= arrival[local_i] + dur_i + _travel_minutes(matrix, global_i, global_j)
            ).only_enforce_if(arc[(local_i, local_j)])

    model.minimize(
        sum(
            _travel_minutes(matrix, global_i, global_j) * arc[(local_i, local_j)]
            for local_i, global_i in enumerate(selected_indices)
            for local_j, global_j in enumerate(selected_indices)
            if local_i != local_j
        )
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = _ORDER_OPTIMIZER_TIMEOUT_SEC
    solver.parameters.num_workers = 1
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        schedule = _schedule_order_earliest(
            selected_indices,
            candidates,
            matrix,
            start_min,
            end_min,
        )
        return selected_indices, schedule or original_start_times

    local_order = _extract_order(solver, arc, depot, m)
    if len(local_order) != m:
        schedule = _schedule_order_earliest(
            selected_indices,
            candidates,
            matrix,
            start_min,
            end_min,
        )
        return selected_indices, schedule or original_start_times

    ordered_indices = [selected_indices[local_i] for local_i in local_order]
    schedule = _schedule_order_earliest(
        ordered_indices,
        candidates,
        matrix,
        start_min,
        end_min,
    )
    if schedule is None:
        return ordered_indices, {
            selected_indices[local_i]: solver.value(arrival[local_i])
            for local_i in local_order
        }

    return ordered_indices, schedule


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


def _schedule_order_earliest(
    ordered_indices: list[int],
    candidates: list[POI],
    matrix: list[list[float]],
    start_min: int,
    end_min: int,
) -> dict[int, int] | None:
    """Return the earliest feasible schedule for an already-ordered route."""
    schedule: dict[int, int] = {}
    cursor = start_min
    previous_idx: int | None = None

    for idx in ordered_indices:
        if previous_idx is not None:
            cursor += candidates[previous_idx].visit_duration_minutes
            cursor += _travel_minutes(matrix, previous_idx, idx)

        poi = candidates[idx]
        open_i, close_i = _opening_window_for_trip(
            poi.opening_hours.open,
            poi.opening_hours.close,
            start_min,
            end_min,
        )
        arrival = max(cursor, open_i, start_min)
        if arrival + poi.visit_duration_minutes > min(close_i, end_min):
            return None

        schedule[idx] = arrival
        cursor = arrival
        previous_idx = idx

    return schedule


def _travel_minutes(matrix: list[list[float]], i: int, j: int) -> int:
    if i == j:
        return 0
    return max(1, math.ceil(matrix[i][j]))


# ── Pre-flight diagnostics ────────────────────────────────────────────────────

def _preflight_diagnostics(
    candidates: list[POI],
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

    # 4. Walking tolerance vs nearest inter-POI straight-line distance
    if len(candidates) >= 2:
        nearest_km = min(
            _haversine_km(
                candidates[i].location.lat,
                candidates[i].location.lng,
                candidates[j].location.lat,
                candidates[j].location.lng,
            )
            for i in range(len(candidates))
            for j in range(len(candidates))
            if i != j
        )
        longest_local_transfer = any(
            _haversine_km(
                candidates[i].location.lat,
                candidates[i].location.lng,
                candidates[j].location.lat,
                candidates[j].location.lng,
            ) > walking_tolerance_km
            for i in range(len(candidates))
            for j in range(len(candidates))
            if i != j
        )
        if nearest_km > walking_tolerance_km:
            notes.append(
                f"Walking tolerance {walking_tolerance_km:.1f} km is below the "
                f"closest pair distance ({nearest_km:.1f} km); inter-stop legs "
                "will be treated as transfer-style travel instead of walking."
            )
        elif longest_local_transfer:
            notes.append(
                f"Candidate pool spans beyond the {walking_tolerance_km:.1f} km "
                "walking tolerance; longer feasible legs will use transfer-style "
                "travel times."
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
    Score = category match bonus + primary-destination bonus + visit_duration
    bonus + proximity bonus.

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
        score += _destination_relevance_bonus(poi)
        # Small bonus for longer/richer experiences (max +50)
        duration_bonus = min(50, poi.visit_duration_minutes // 6)
        proximity_bonus = _proximity_bonus(poi, destination_anchor)
        scores.append(score + duration_bonus + proximity_bonus)
    return scores


def _destination_relevance_bonus(poi: POI) -> int:
    """
    Keep the trip centered on the requested destination without making nearby
    expansion impossible when primary POIs are closed, over budget, or already
    exhausted.
    """
    if poi.destination_relevance == "primary":
        return _PRIMARY_DESTINATION_BONUS
    return 0


def _proximity_bonus(poi: POI, anchor) -> int:
    """
    Anchored proximity scoring — dominates category match so the route stays in
    the user's chosen area even when a different-category POI sits closer than
    a same-category POI across the city.

    Tiers (bonus must beat the +200 category-match bonus at close range):
      +400  ≤ 1.5 km  — inside the destination
      +200  ≤ 3 km    — adjacent area
      +80   ≤ 6 km    — short transit, still nearby
      0     beyond    — across the city, no bonus

    No anchor → 0 (no bias applied).
    """
    if anchor is None:
        return 0
    distance_km = _haversine_km(
        anchor.lat, anchor.lng, poi.location.lat, poi.location.lng
    )
    if distance_km <= 1.5:
        return 400
    if distance_km <= 3:
        return 200
    if distance_km <= 6:
        return 80
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

    _backfill_travel(
        stops,
        candidates,
        matrix,
        walking_tolerance_km=request.preferences.walking_tolerance_km,
    )
    transfer_leg_count = _count_transfer_legs(
        selected_indices,
        candidates,
        request.preferences.walking_tolerance_km,
    )
    if transfer_leg_count > 0:
        diagnostics.append(
            f"Route includes {transfer_leg_count} leg(s) longer than the "
            f"{request.preferences.walking_tolerance_km:.1f} km walking tolerance; "
            "those legs use transfer-style travel estimates."
        )

    requested_max = min(
        request.preferences.max_pois or len(candidates),
        len(candidates),
        _MAX_SOLVER_STOPS,
    )
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
        _route_distance_km(selected_indices, candidates),
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
    walking_tolerance_km: float,
) -> None:
    """Fill travel_time_to_next_minutes for all stops except the last."""
    if len(stops) < 2:
        return
    idx_map = {
        s.poi_id: next(i for i, c in enumerate(candidates) if c.poi_id == s.poi_id)
        for s in stops
    }
    for k in range(len(stops) - 1):
        i = idx_map[stops[k].poi_id]
        j = idx_map[stops[k + 1].poi_id]
        travel_mode = (
            "walk"
            if _leg_distance_km(candidates[i], candidates[j]) <= walking_tolerance_km
            else "transfer"
        )
        stops[k] = stops[k].model_copy(
            update={
                "travel_time_to_next_minutes": _travel_minutes(matrix, i, j),
                "travel_mode_to_next": travel_mode,
            }
        )


def _count_transfer_legs(
    selected_indices: list[int],
    candidates: list[POI],
    walking_tolerance_km: float,
) -> int:
    count = 0
    for k in range(len(selected_indices) - 1):
        if _leg_distance_km(
            candidates[selected_indices[k]],
            candidates[selected_indices[k + 1]],
        ) > walking_tolerance_km:
            count += 1
    return count


def _route_distance_km(selected_indices: list[int], candidates: list[POI]) -> float:
    total = 0.0
    for k in range(len(selected_indices) - 1):
        total += _leg_distance_km(
            candidates[selected_indices[k]],
            candidates[selected_indices[k + 1]],
        )
    return total


def _leg_distance_km(origin: POI, destination: POI) -> float:
    return _haversine_km(
        origin.location.lat,
        origin.location.lng,
        destination.location.lat,
        destination.location.lng,
    )


def _finalise_response(
    request: OptimizeRequest,
    stops: list[ScheduledPOI],
    total_cost: float,
    total_distance_km: float,
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

    route = DailyRoute(
        route_name=f"Istanbul Day Trip — {request.date}",
        total_distance_km=max(round(total_distance_km, 2), 0.0),
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
