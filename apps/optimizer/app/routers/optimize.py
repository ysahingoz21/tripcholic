from fastapi import APIRouter

from app.schemas.optimize import OptimizeRequest, OptimizeResponse
from app.services.optimizer_service import generate_route

router = APIRouter(tags=["Optimization"])


@router.post(
    "/optimize",
    summary="Generate an optimized daily itinerary",
    description=(
        "Accepts a structured user preference vector and a pre-filtered list of candidate POIs. "
        "Returns a single feasible ordered daily itinerary for Istanbul, respecting time windows, "
        "venue opening hours, budget limits, and walking distance tolerance.\n\n"
        "Uses a greedy nearest-feasible algorithm backed by OpenRouteService walking-time matrix "
        "(falls back to Haversine when ORS is unavailable)."
    ),
    response_model=OptimizeResponse,
    status_code=200,
    responses={
        422: {"description": "Request body failed schema validation"},
        503: {"description": "Optimizer engine temporarily unavailable"},
    },
)
def optimize_route(request: OptimizeRequest) -> OptimizeResponse:
    return generate_route(request)
