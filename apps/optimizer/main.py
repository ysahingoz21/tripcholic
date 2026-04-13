from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from app.config import settings
from app.routers import health, optimize, validate


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[{settings.APP_NAME}] v{settings.APP_VERSION} starting — env={settings.ENV}")
    yield
    print(f"[{settings.APP_NAME}] shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Constraint-aware route optimization engine for the Tripcholic trip planning application.\n\n"
        "Models single-day trip planning in Istanbul as a constrained optimization problem. "
        "Receives structured user preference vectors and candidate POIs from the NestJS backend "
        "and returns feasible ordered daily itineraries that satisfy time windows, venue opening "
        "hours, budget limits, and walking distance tolerance.\n\n"
        "**Algorithm:** OR-Tools CP-SAT solver (greedy fallback). "
        "Candidate POIs are selected and filtered by the backend before reaching this service."
    ),
    version=settings.APP_VERSION,
    contact={
        "name": "Tripcholic Team",
        "email": "denizmeric21@ku.edu.tr",
    },
    license_info={
        "name": "Private — Koç University COMP 491",
    },
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.include_router(health.router)
app.include_router(optimize.router)
app.include_router(validate.router)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.ENV == "development",
        log_level=settings.LOG_LEVEL.lower(),
    )
