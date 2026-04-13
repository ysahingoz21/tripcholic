from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator


class POICategory(str, Enum):
    HISTORICAL = "historical"
    SCENIC = "scenic"
    FOOD = "food"
    SHOPPING = "shopping"
    NATURE = "nature"
    NEIGHBORHOOD = "neighborhood"
    ENTERTAINMENT = "entertainment"


# Maps proposal-level preference profiles to the actual dataset categories.
# Used when the LLM or user selects a high-level profile instead of raw categories.
PROFILE_TO_CATEGORIES: dict[str, list["POICategory"]] = {
    "cultural": [POICategory.HISTORICAL, POICategory.NEIGHBORHOOD, POICategory.ENTERTAINMENT],
    "romantic": [POICategory.SCENIC, POICategory.FOOD, POICategory.NEIGHBORHOOD],
    "family": [POICategory.ENTERTAINMENT, POICategory.NATURE, POICategory.HISTORICAL],
    "touristic": [POICategory.HISTORICAL, POICategory.SCENIC, POICategory.SHOPPING],
    "group": [POICategory.ENTERTAINMENT, POICategory.FOOD, POICategory.SHOPPING],
    "solo": [POICategory.HISTORICAL, POICategory.SCENIC, POICategory.FOOD, POICategory.NEIGHBORHOOD],
}


class ConstraintType(str, Enum):
    BUDGET = "budget"
    TIME = "time"
    WALKING_DISTANCE = "walking_distance"
    CATEGORY = "category"


class Location(BaseModel):
    lat: float = Field(ge=-90, le=90, description="Latitude in decimal degrees")
    lng: float = Field(ge=-180, le=180, description="Longitude in decimal degrees")


class BudgetLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# Approximate TL cost per visit for each budget level.
# Used to estimate costs when the backend sends POIs with BudgetLevel labels.
BUDGET_LEVEL_TL: dict[str, tuple[float, float]] = {
    "low":    (0.0,     2000.0),   # free entry / mosques / parks, street food — per person
    "medium": (2000.0,  6000.0),   # museums, casual restaurants, bazaars — per person
    "high":   (6000.0,  20000.0),  # hammams, palace tours, rooftop dining, Bosphorus tours — per person
}


class BudgetRange(BaseModel):
    min_tl: float = Field(ge=0, description="Minimum cost in Turkish Lira")
    max_tl: float = Field(ge=0, description="Maximum cost in Turkish Lira")

    @model_validator(mode="after")
    def max_gte_min(self) -> "BudgetRange":
        if self.max_tl < self.min_tl:
            raise ValueError("max_tl must be greater than or equal to min_tl")
        return self

    @classmethod
    def from_level(cls, level: str) -> "BudgetRange":
        """Construct a BudgetRange from a CSV budget label (low/medium/high)."""
        min_tl, max_tl = BUDGET_LEVEL_TL.get(level.lower(), (0.0, 500.0))
        return cls(min_tl=min_tl, max_tl=max_tl)


class OpeningHours(BaseModel):
    open: str = Field(description="Opening time in HH:MM format")
    close: str = Field(description="Closing time in HH:MM format")

    @field_validator("open", "close")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        parts = v.split(":")
        if len(parts) != 2:
            raise ValueError("Time must be in HH:MM format")
        h, m = parts
        if not h.isdigit() or not m.isdigit():
            raise ValueError("Time must be in HH:MM format")
        if not (0 <= int(h) <= 23) or not (0 <= int(m) <= 59):
            raise ValueError("Invalid time value")
        return v
