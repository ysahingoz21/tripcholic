from datetime import datetime, timezone

from ortools.sat.python import cp_model

from app.schemas.optimize import (
    DailyRoute,
    OptimizeRequest,
    OptimizeResponse,
    ScheduledPOI,
)
from app.schemas.poi import POI
from app.services.routing_service import build_travel_matrix

ALGORITHM_VERSION = "ortools_cpsat_v1"

# OR-Tools works with integers — we scale minutes to this resolution.
_TIME_SCALE = 1          # 1 unit = 1 minute (no scaling needed here)
_COST_SCALE = 100        # 1 unit = 0.01 TL  (keeps integers manageable)
_SOLVER_TIMEOUT_SEC = 8  # wall-clock limit; falls back to greedy on timeout


def generate_route(request: OptimizeRequest) -> OptimizeResponse:
    """
    Constraint-aware route optimizer using OR-Tools CP-SAT.

    Models the single-day itinerary as a Time-Windowed Orienteering Problem:
      - Each POI has a time window [open, close], visit duration, and cost.
      - An optional arc connects consecutive stops with a travel-time penalty.
      - Objective: maximise a weighted score (preference match + visit value)
        subject to time-window, budget, walking-distance, and max-stop constraints.

    Falls back to the greedy heuristic if the solver does not find a feasible
    solution within _SOLVER_TIMEOUT_SEC seconds.
    """
    prefs = request.preferences

    start_min = _to_minutes(prefs.time_start)
    end_min   = _to_minutes(prefs.time_end)
    budget_units = int(prefs.budget_tl * _COST_SCALE)
    max_pois  = prefs.max_pois or 6

    # ── 1. Use candidate POIs as-is — backend already filtered by DB query ───
    candidates = list(request.candidate_pois)

    if not candidates:
        return _empty_response(request)

    # ── 2. Travel-time matrix ────────────────────────────────────────────────
    matrix = build_travel_matrix(candidates)

    # ── 3. Score each candidate ──────────────────────────────────────────────
    scores = _compute_scores(candidates, prefs.categories)

    # ── 4. Solve with OR-Tools CP-SAT ────────────────────────────────────────
    selected_indices, start_times = _solve_cpsat(
        candidates=candidates,
        matrix=matrix,
        scores=scores,
        start_min=start_min,
        end_min=end_min,
        budget_units=budget_units,
        max_pois=max_pois,
        walking_tolerance_km=prefs.walking_tolerance_km,
    )

    # ── 5. Fallback to greedy if CP-SAT found nothing ────────────────────────
    if not selected_indices:
        return _greedy_fallback(
            candidates=candidates,
            matrix=matrix,
            request=request,
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
) -> tuple[list[int], dict[int, int]]:
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

    Objective: maximise sum(score[i] * x[i]).
    """
    n = len(candidates)
    if n == 0:
        return [], {}

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
        open_i  = _to_minutes(poi.opening_hours.open)
        close_i = _to_minutes(poi.opening_hours.close)
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

    # ── Objective ─────────────────────────────────────────────────────────────
    model.maximize(sum(scores[i] * skip[i].negated() for i in range(n)))

    # ── Solve ─────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = _SOLVER_TIMEOUT_SEC
    solver.parameters.num_workers = 1  # single-threaded avoids parallel overhead
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return [], {}

    selected = [i for i in range(n) if solver.boolean_value(skip[i].negated())]
    if not selected:
        return [], {}

    ordered = _extract_order(solver, arc, depot, n)
    arrival_minutes = {i: solver.value(arrival[i]) for i in ordered}
    return ordered, arrival_minutes


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


# ── Score computation ─────────────────────────────────────────────────────────

def _compute_scores(candidates: list[POI], preferred_categories: list) -> list[int]:
    """
    Score = 100 * (category match bonus) + normalised visit_duration bonus.

    Keeps integers for CP-SAT while still differentiating POIs.
    """
    preferred_set = set(preferred_categories) if preferred_categories else set()
    scores = []
    for poi in candidates:
        score = 200 if poi.category in preferred_set else 100
        # Small bonus for longer/richer experiences (max +50)
        duration_bonus = min(50, poi.visit_duration_minutes // 6)
        scores.append(score + duration_bonus)
    return scores


# ── Greedy fallback ───────────────────────────────────────────────────────────

_WALK_SPEED_KMH = 5.0


def _greedy_fallback(
    candidates: list[POI],
    matrix: list[list[float]],
    request: OptimizeRequest,
    start_min: int,
    end_min: int,
) -> OptimizeResponse:
    """Original nearest-feasible greedy, used when CP-SAT times out."""
    prefs = request.preferences
    max_pois = prefs.max_pois or 6

    stops: list[ScheduledPOI] = []
    total_cost = 0.0
    current_minutes = start_min
    remaining_budget = prefs.budget_tl
    visited: set[int] = set()
    current_idx: int | None = None

    while len(stops) < max_pois:
        best_idx = _pick_next_greedy(
            candidates=candidates,
            matrix=matrix,
            current_idx=current_idx,
            visited=visited,
            current_minutes=current_minutes,
            end_minutes=end_min,
            remaining_budget=remaining_budget,
            walking_tolerance_km=prefs.walking_tolerance_km,
        )
        if best_idx is None:
            break

        poi = candidates[best_idx]
        travel_min = 0.0 if current_idx is None else matrix[current_idx][best_idx]
        earliest_arrival = current_minutes + (0 if current_idx is None else int(travel_min))
        open_min = _to_minutes(poi.opening_hours.open)
        arrival_min = max(earliest_arrival, open_min)
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
        remaining_budget -= cost
        current_minutes = departure_min
        visited.add(best_idx)
        current_idx = best_idx

    _backfill_travel(stops, candidates, matrix)

    if not stops:
        return _empty_response(request)

    return _finalise_response(request, stops, total_cost, start_min, algorithm="greedy_v1_fallback")


def _pick_next_greedy(
    candidates, matrix, current_idx, visited, current_minutes, end_minutes,
    remaining_budget, walking_tolerance_km,
) -> int | None:
    best_idx = None
    best_travel = float("inf")
    for idx, poi in enumerate(candidates):
        if idx in visited:
            continue
        travel_min = 0.0 if current_idx is None else matrix[current_idx][idx]
        travel_km = travel_min / 60.0 * _WALK_SPEED_KMH
        if travel_km > walking_tolerance_km:
            continue
        if poi.budget.min_tl > remaining_budget:
            continue
        arrival = current_minutes + int(travel_min)
        departure = arrival + poi.visit_duration_minutes
        open_min = _to_minutes(poi.opening_hours.open)
        close_min = _to_minutes(poi.opening_hours.close)
        if arrival < open_min or arrival >= close_min:
            continue
        if departure > end_minutes:
            continue
        if travel_min < best_travel:
            best_travel = travel_min
            best_idx = idx
    return best_idx


# ── Response builders ─────────────────────────────────────────────────────────

def _build_response(
    request: OptimizeRequest,
    candidates: list[POI],
    selected_indices: list[int],
    start_times: dict[int, int],
    matrix: list[list[float]],
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

    start_min = _to_minutes(request.preferences.time_start)
    return _finalise_response(request, stops, total_cost, start_min, algorithm=ALGORITHM_VERSION)


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
) -> OptimizeResponse:
    last_dep_h, last_dep_m = map(int, stops[-1].departure_time.split(":"))
    total_duration = (last_dep_h * 60 + last_dep_m) - start_min

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
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ── Utilities ─────────────────────────────────────────────────────────────────

def _to_minutes(hhmm: str) -> int:
    h, m = map(int, hhmm.split(":"))
    return h * 60 + m


def _fmt(total_minutes: int) -> str:
    h = (total_minutes % (24 * 60)) // 60
    m = total_minutes % 60
    return f"{h:02d}:{m:02d}"


def _empty_response(request: OptimizeRequest) -> OptimizeResponse:
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
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
