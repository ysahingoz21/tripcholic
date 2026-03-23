from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import POICategory

# ── Defaults applied when LLM does not provide a value ───────────────────────
_DEFAULT_END_TIME = "21:00"
_DEFAULT_BUDGET_TL = 6000.0
_DEFAULT_WALKING_KM = 3.0
_DEFAULT_MAX_POIS = 6


def _current_time_hhmm() -> str:
    """Return the current local time as HH:MM (used as default start time)."""
    now = datetime.now(timezone.utc)
    return f"{now.hour:02d}:{now.minute:02d}"


class UserPreferences(BaseModel):
    """
    All fields are optional so this model accepts partial LLM output without
    raising validation errors.  Missing values are filled with sensible defaults
    before the optimizer runs.
    """

    categories: list[POICategory] | None = Field(
        default=None,
        description="POI categories the user is interested in. Defaults to all categories.",
    )
    time_start: str | None = Field(
        default=None,
        description="Trip start time in HH:MM format. Defaults to current time.",
    )
    time_end: str | None = Field(
        default=_DEFAULT_END_TIME,
        description="Trip end time in HH:MM format. Defaults to 21:00.",
    )
    budget_tl: float | None = Field(
        default=_DEFAULT_BUDGET_TL,
        gt=0,
        description="Total daily budget in Turkish Lira. Defaults to 500 TL.",
    )
    walking_tolerance_km: float | None = Field(
        default=_DEFAULT_WALKING_KM,
        ge=0,
        le=50,
        description="Max walking distance between stops in km. Defaults to 3 km.",
    )
    max_pois: int | None = Field(
        default=_DEFAULT_MAX_POIS,
        ge=1,
        le=20,
        description="Maximum number of stops in the itinerary. Defaults to 6.",
    )
    weather: Literal["clear", "cloudy", "rainy"] | None = Field(
        default=None,
        description="Current weather context. 'rainy' excludes outdoor-only POIs.",
    )

    @field_validator("time_start", "time_end", mode="before")
    @classmethod
    def validate_time_format(cls, v: str | None) -> str | None:
        if v is None:
            return v
        parts = v.split(":")
        if len(parts) != 2:
            raise ValueError("Time must be in HH:MM format")
        h, m = parts
        if not h.isdigit() or not m.isdigit():
            raise ValueError("Time must be in HH:MM format")
        if not (0 <= int(h) <= 23) or not (0 <= int(m) <= 59):
            raise ValueError("Invalid time value")
        return v

    @model_validator(mode="after")
    def apply_defaults_and_validate(self) -> "UserPreferences":
        # Fill start time with current time if not provided
        if self.time_start is None:
            self.time_start = _current_time_hhmm()

        # Fill categories with all available categories if not provided
        if not self.categories:
            self.categories = list(POICategory)

        # Ensure end is after start
        start_h, start_m = map(int, self.time_start.split(":"))
        end_h, end_m = map(int, self.time_end.split(":"))
        if (end_h * 60 + end_m) <= (start_h * 60 + start_m):
            raise ValueError("time_end must be later than time_start")

        return self
