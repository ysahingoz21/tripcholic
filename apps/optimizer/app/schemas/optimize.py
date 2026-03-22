from pydantic import BaseModel, Field

from app.schemas.poi import POI
from app.schemas.preferences import UserPreferences


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
        max_length=50,
        description="Pre-filtered list of candidate POIs. Backend must filter by city before sending.",
    )


class OptimizeResponse(BaseModel):
    trip_id: str = Field(description="Echo of the request trip_id")
    date: str = Field(description="Echo of the request date")
    route: DailyRoute = Field(description="The generated daily itinerary")
    algorithm_used: str = Field(
        description="Identifier of the algorithm version that produced this route (e.g. stub_v0, greedy_v1)"
    )
    generated_at: str = Field(description="ISO 8601 timestamp of when the route was generated")
