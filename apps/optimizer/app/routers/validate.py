from fastapi import APIRouter

from app.schemas.validate import ValidateRequest, ValidateResponse
from app.services import validator_service

router = APIRouter(tags=["Validation"])


@router.post(
    "/validate",
    summary="Validate a route against constraints",
    description=(
        "Given a pre-built daily route and a set of user preferences and explicit constraints, "
        "returns a feasibility report with per-constraint violation details and an aggregate score.\n\n"
        "Accepts routes produced by `POST /optimize` or manually constructed routes from the mobile app. "
        "The `feasibility_score` (0.0–1.0) can be used by the frontend for UX feedback even before "
        "the real validation logic is implemented.\n\n"
        "**Current status:** stub implementation. Always returns `is_feasible: true` with "
        "`feasibility_score: 1.0` and no violations."
    ),
    response_model=ValidateResponse,
    status_code=200,
    responses={
        422: {"description": "Request body failed schema validation"},
    },
)
def validate_route(request: ValidateRequest) -> ValidateResponse:
    return validator_service.generate_stub_report(request)
