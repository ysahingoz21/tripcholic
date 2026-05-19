from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import BudgetRange, Location, OpeningHours, POICategory


class POI(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    poi_id: str = Field(description="Unique identifier for the POI (UUID from backend DB)")
    name: str = Field(description="Display name of the point of interest")
    location: Location = Field(description="Geographic coordinates")
    category: POICategory = Field(description="Thematic category of the POI")
    opening_hours: OpeningHours = Field(description="Daily opening and closing times")
    budget: BudgetRange = Field(description="Estimated cost range for a visit in Turkish Lira")
    visit_duration_minutes: int = Field(
        gt=0,
        le=480,
        description="Estimated visit duration in minutes (max 8 hours)",
    )
    is_outdoor: bool | None = Field(
        default=None,
        description=(
            "Whether the POI is primarily outdoor (parks, viewpoints, walking routes). "
            "Used by the optimizer to filter weather-sensitive candidates when "
            "preferences.weather is 'rainy'. If None, the optimizer falls back to a "
            "category-based heuristic (SCENIC and NATURE treated as outdoor)."
        ),
    )
