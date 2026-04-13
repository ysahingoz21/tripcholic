from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ConstraintType
from app.schemas.optimize import DailyRoute
from app.schemas.preferences import UserPreferences


class Constraint(BaseModel):
    type: ConstraintType = Field(description="The type of constraint being applied")
    value: float | str = Field(
        description="Constraint value. Float for budget/distance, HH:MM string for time, category name string for category."
    )


class ConstraintViolation(BaseModel):
    constraint_type: ConstraintType = Field(description="The type of constraint that was violated")
    description: str = Field(description="Human-readable explanation of the violation")
    severity: Literal["warning", "error"] = Field(
        description="Severity level: 'error' means the route is infeasible, 'warning' means degraded quality"
    )


class ValidateRequest(BaseModel):
    trip_id: str = Field(description="Unique identifier for the trip")
    route: DailyRoute = Field(description="The route to validate")
    preferences: UserPreferences = Field(description="User preferences to validate against")
    constraints: list[Constraint] = Field(
        default=[],
        description="Additional explicit constraints to check beyond the preferences",
    )


class ValidateResponse(BaseModel):
    trip_id: str = Field(description="Echo of the request trip_id")
    is_feasible: bool = Field(
        description="True if the route satisfies all constraints with no errors"
    )
    violations: list[ConstraintViolation] = Field(
        description="List of constraint violations found. Empty if is_feasible is True."
    )
    feasibility_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Continuous score from 0.0 (completely infeasible) to 1.0 (fully feasible)",
    )
    validated_at: str = Field(description="ISO 8601 timestamp of when validation was performed")
