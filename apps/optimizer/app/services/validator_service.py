from datetime import datetime, timezone

from app.schemas.validate import ValidateRequest, ValidateResponse


def generate_stub_report(request: ValidateRequest) -> ValidateResponse:
    """
    Stub implementation of the route validator.

    Always returns is_feasible=True with an empty violations list and a
    feasibility_score of 1.0. This is the correct placeholder behaviour:
    the real validator will replace only these internals without changing
    the router or schema layer.
    """
    return ValidateResponse(
        trip_id=request.trip_id,
        is_feasible=True,
        violations=[],
        feasibility_score=1.0,
        validated_at=datetime.now(timezone.utc).isoformat(),
    )
