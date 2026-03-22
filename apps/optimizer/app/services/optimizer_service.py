from datetime import datetime, timezone

from app.schemas.optimize import (
    DailyRoute,
    OptimizeRequest,
    OptimizeResponse,
    ScheduledPOI,
)
from app.schemas.poi import POI
from app.services.routing_service import build_travel_matrix

ALGORITHM_VERSION = "greedy_v1"


def generate_route(request: OptimizeRequest) -> OptimizeResponse:
    """
    Greedy constraint-aware route optimizer.

    Steps:
      1. Filter candidate POIs against hard constraints (budget headroom,
         opening hours, category match).
      2. Build an NxN walking-time matrix via OpenRouteService (falls back
         to Haversine when ORS is unavailable).
      3. Greedy nearest-feasible selection: from the current position pick
         the unvisited POI that can be reached in time, fits in the remaining
         budget, and is still open — preferring the one closest in travel time.
      4. Pack the selected stops into a DailyRoute with per-stop timestamps.
    """
    prefs = request.preferences

    start_h, start_m = map(int, prefs.time_start.split(":"))
    end_h, end_m = map(int, prefs.time_end.split(":"))

    # ── 1. Hard-constraint pre-filter ────────────────────────────────────────
    candidates = _filter_candidates(
        request.candidate_pois,
        prefs.categories,
        prefs.budget_tl,
        prefs.time_start,
        prefs.time_end,
        prefs.weather,
    )

    if not candidates:
        # Nothing feasible — return an empty-stop route rather than crashing.
        return _empty_response(request)

    # ── 2. Travel-time matrix ────────────────────────────────────────────────
    matrix = build_travel_matrix(candidates)

    # ── 3. Greedy selection ──────────────────────────────────────────────────
    stops: list[ScheduledPOI] = []
    total_cost = 0.0
    current_minutes = start_h * 60 + start_m
    remaining_budget = prefs.budget_tl
    visited = set()

    # Start from the first candidate as the "virtual depot" (index -1 means
    # we haven't moved yet; use index 0 as starting POI anchor).
    current_idx: int | None = None

    max_pois = prefs.max_pois or 6

    while len(stops) < max_pois:
        best_idx = _pick_next(
            candidates=candidates,
            matrix=matrix,
            current_idx=current_idx,
            visited=visited,
            current_minutes=current_minutes,
            end_minutes=end_h * 60 + end_m,
            remaining_budget=remaining_budget,
            walking_tolerance_km=prefs.walking_tolerance_km,
        )
        if best_idx is None:
            break

        poi = candidates[best_idx]
        travel_min = 0.0 if current_idx is None else matrix[current_idx][best_idx]
        arrival_min = current_minutes + (0 if current_idx is None else int(travel_min))
        departure_min = arrival_min + poi.visit_duration_minutes
        cost = poi.budget.min_tl

        stops.append(
            ScheduledPOI(
                poi_id=poi.poi_id,
                name=poi.name,
                arrival_time=_fmt(arrival_min),
                departure_time=_fmt(departure_min),
                travel_time_to_next_minutes=None,  # filled in below
                estimated_cost_tl=cost,
            )
        )

        total_cost += cost
        remaining_budget -= cost
        current_minutes = departure_min
        visited.add(best_idx)
        current_idx = best_idx

    # Back-fill travel_time_to_next for all stops except the last.
    if len(stops) >= 2:
        selected_indices = [
            next(i for i, c in enumerate(candidates) if c.poi_id == s.poi_id)
            for s in stops
        ]
        for k in range(len(stops) - 1):
            travel = matrix[selected_indices[k]][selected_indices[k + 1]]
            stops[k] = stops[k].model_copy(
                update={"travel_time_to_next_minutes": max(1, int(travel))}
            )

    # ── 4. Build response ────────────────────────────────────────────────────
    if not stops:
        return _empty_response(request)

    last_dep_h, last_dep_m = map(int, stops[-1].departure_time.split(":"))
    total_duration = (last_dep_h * 60 + last_dep_m) - (start_h * 60 + start_m)

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
        algorithm_used=ALGORITHM_VERSION,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

_WALK_SPEED_KMH = 5.0


_OUTDOOR_CATEGORIES = {"scenic", "nature", "neighborhood"}


def _filter_candidates(
    pois: list[POI],
    categories: list,
    total_budget: float,
    time_start: str,
    time_end: str,
    weather: str | None = None,
) -> list[POI]:
    """
    Keep only POIs that:
    - match at least one requested category
    - have minimum cost below total budget
    - are open at some point within the trip window
    - are not purely outdoor when weather is rainy
    """
    trip_start = _to_minutes(time_start)
    trip_end = _to_minutes(time_end)
    is_rainy = weather and weather.lower() == "rainy"

    filtered = []
    for poi in pois:
        if poi.category not in categories:
            continue
        if poi.budget.min_tl > total_budget:
            continue
        open_min = _to_minutes(poi.opening_hours.open)
        close_min = _to_minutes(poi.opening_hours.close)
        if close_min <= trip_start or open_min >= trip_end:
            continue
        if is_rainy and poi.category.value in _OUTDOOR_CATEGORIES:
            continue
        filtered.append(poi)
    return filtered


def _pick_next(
    candidates: list[POI],
    matrix: list[list[float]],
    current_idx: int | None,
    visited: set[int],
    current_minutes: int,
    end_minutes: int,
    remaining_budget: float,
    walking_tolerance_km: float,
) -> int | None:
    """
    From candidates, pick the unvisited POI that:
    - can be reached before it closes
    - finishes its visit before trip end
    - fits within remaining budget
    - travel distance is within walking_tolerance_km
    - is open on arrival

    Among feasible options, prefer the one with shortest travel time (greedy).
    Returns index into candidates, or None if no feasible POI exists.
    """
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
