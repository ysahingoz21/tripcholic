from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.poi import POI
from app.schemas.preferences import UserPreferences


class OptimizeStatus(str, Enum):
    OK = "ok"
    PARTIAL = "partial"
    INFEASIBLE = "infeasible"
    EMPTY_CANDIDATES = "empty_candidates"


class SolverStatus(str, Enum):
    OPTIMAL = "optimal"
    FEASIBLE = "feasible"
    INFEASIBLE = "infeasible"
    TIMEOUT = "timeout"
    NOT_RUN = "not_run"


class RoutingSource(str, Enum):
    OSRM = "osrm"
    HAVERSINE = "haversine"
    NONE = "none"


class ScheduledPOI(BaseModel):
    poi_id: str = Field(description="Reference to the POI identifier")
    name: str = Field(description="Display name of the POI")
    arrival_time: str = Field(description="Scheduled arrival time in HH:MM format")
    departure_time: str = Field(description="Scheduled departure time in HH:MM format")
    travel_time_to_next_minutes: int | None = Field(
        default=None,
        description="Travel time to the next stop in minutes. Null for the last stop.",
    )
    estimated_cost_tl: float = Field(
        ge=0,
        description="Estimated visit cost in Turkish Lira",
    )


class DailyRoute(BaseModel):
    route_name: str = Field(description="Human-readable name for the route")
    total_distance_km: float = Field(ge=0, description="Total travel distance in kilometers")
    total_cost_tl: float = Field(ge=0, description="Total estimated cost in Turkish Lira")
    total_duration_minutes: int = Field(ge=0, description="Total trip duration in minutes")
    stops: list[ScheduledPOI] = Field(
        default=[],
        description="Ordered list of scheduled stops for the day",
    )


class OptimizeRequest(BaseModel):
    trip_id: str = Field(description="Unique identifier for the trip (from backend)")
    date: str = Field(description="Trip date in YYYY-MM-DD format")
    preferences: UserPreferences = Field(description="User preferences and constraints")
    candidate_pois: list[POI] = Field(
        min_length=1,
        max_length=20,
        description=(
            "Pre-filtered list of candidate POIs. Backend must coarse-filter "
            "(city, category, open today, etc.) and send at most 20 candidates so "
            "CP-SAT consistently solves under the 3s wall-clock limit."
        ),
    )


class OptimizeResponse(BaseModel):
    trip_id: str = Field(description="Echo of the request trip_id")
    date: str = Field(description="Echo of the request date")
    route: DailyRoute = Field(description="The generated daily itinerary")
    algorithm_used: str = Field(
        description="Identifier of the algorithm version that produced this route (e.g. stub_v0, greedy_v1)"
    )
    status: OptimizeStatus = Field(
        description=(
            "High-level outcome of the optimization. "
            "'ok' = full route built, 'partial' = some stops fit but max_pois or constraints capped it, "
            "'infeasible' = no feasible route under the given constraints, "
            "'empty_candidates' = the request contained no candidate POIs."
        )
    )
    solver_status: SolverStatus = Field(
        description=(
            "Detailed solver outcome: 'optimal' / 'feasible' from CP-SAT, "
            "'infeasible' or 'timeout' when CP-SAT could not solve, "
            "'not_run' when no solver was invoked (e.g. empty candidates)."
        )
    )
    routing_source: RoutingSource = Field(
        description=(
            "Source of the travel-time matrix used during optimization. "
            "'osrm' = real road network via OSRM Table API, "
            "'haversine' = straight-line fallback at 5 km/h, "
            "'none' = matrix not built (e.g. empty candidates)."
        )
    )
    diagnostics: list[str] = Field(
        default=[],
        description=(
            "Human-readable notes explaining notable decisions or limitations: e.g. why the route is "
            "partial, which constraint blocked further stops, or that a fallback was used. Intended "
            "for surfacing to the user in the mobile app."
        ),
    )
    generated_at: str = Field(description="ISO 8601 timestamp of when the route was generated")
