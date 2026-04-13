# Tripcholic Optimizer

Python FastAPI microservice that models single-day trip planning as a constrained optimization problem. Receives structured preference vectors from the NestJS backend and returns feasible ordered daily itineraries for Istanbul.

---

## Running locally

```bash
cd apps/optimizer
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --reload
```

Or directly:

```bash
python main.py
```

The service starts on `http://localhost:8000` by default.

Interactive API docs: `http://localhost:8000/docs`

---

## Environment variables

| Variable      | Default                  | Description                          |
|---------------|--------------------------|--------------------------------------|
| `PORT`        | `8000`                   | Port the service listens on          |
| `ENV`         | `development`            | Runtime environment                  |
| `APP_NAME`    | `Tripcholic Optimizer`   | Service name shown in OpenAPI docs   |
| `APP_VERSION` | `0.1.0`                  | Version string shown in OpenAPI docs |
| `LOG_LEVEL`   | `INFO`                   | Uvicorn log level                    |

Copy `.env.example` to `.env` and adjust as needed.

---

## API endpoints

| Method | Path        | Description                                      |
|--------|-------------|--------------------------------------------------|
| `GET`  | `/health`   | Service health check (status, version, env)      |
| `POST` | `/optimize` | Generate an optimized daily itinerary            |
| `POST` | `/validate` | Validate a route against constraints             |

Full request/response schemas are available at `/docs` (Swagger UI) or `/redoc`.

---

## Project structure

```
apps/optimizer/
├── main.py                        # App factory, router registration, lifespan
├── requirements.txt               # Pinned dependencies
│
└── app/
    ├── config.py                  # pydantic-settings: reads env vars from .env
    │
    ├── schemas/
    │   ├── common.py              # Shared: Location, BudgetRange, OpeningHours, POICategory, ConstraintType
    │   ├── poi.py                 # POI input schema
    │   ├── preferences.py         # UserPreferences schema
    │   ├── optimize.py            # OptimizeRequest / DailyRoute / OptimizeResponse
    │   └── validate.py            # ValidateRequest / ConstraintViolation / ValidateResponse
    │
    ├── routers/
    │   ├── health.py              # GET /health
    │   ├── optimize.py            # POST /optimize
    │   └── validate.py            # POST /validate
    │
    └── services/
        ├── optimizer_service.py   # Route generation logic (stub_v0 → real algorithm)
        └── validator_service.py   # Constraint validation logic (stub → real)
```

The `routers/` layer owns HTTP concerns only. The `services/` layer owns all business logic. When the real scheduling algorithm is ready, only `services/optimizer_service.py` needs to change — the router, schema, and API contract stay the same.

---

## Adding the real algorithm

1. Implement the scheduling logic inside `app/services/optimizer_service.py`, replacing the `generate_stub_route` internals.
2. Update `ALGORITHM_VERSION` (e.g. `"greedy_v1"`) so responses are distinguishable in logs.
3. Add any new dependencies to `requirements.txt`.
4. The `lifespan` context in `main.py` is the right place to pre-load heavy resources (distance matrix, ML model) into `app.state` at startup.

---

## Installing dependencies

```bash
pip install -r requirements.txt
```
