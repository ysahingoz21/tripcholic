from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "error"]
    version: str
    environment: str


@router.get(
    "/health",
    summary="Service health check",
    description=(
        "Returns the current status, version, and runtime environment of the optimizer service. "
        "Used by Docker health checks and backend readiness probes."
    ),
    response_model=HealthResponse,
)
def get_health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        environment=settings.ENV,
    )
