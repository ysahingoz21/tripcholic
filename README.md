# Tripcholic

Constraint-aware AI-powered trip planning application combining route optimization and LLM-based interaction.

## Tech Stack

- Mobile: React Native + Expo + TypeScript
- Backend API: Node.js + NestJS + TypeScript
- Optimization Engine: Python microservice
- Database: PostgreSQL
- ORM: Prisma
- Auth: JWT

## Repository Structure

- `apps/mobile` → mobile application
- `apps/backend` → main backend API
- `apps/optimizer` → Python optimization engine
- `packages/shared-types` → shared TypeScript types

## Local Development

Boot the local development stack from the repo root with:

```bash
npm run dev
```

This starts:
- PostgreSQL via Docker Compose
- NestJS backend in watch mode
- FastAPI optimizer with Uvicorn reload
- Expo mobile dev server

Prerequisites:
- Docker Desktop or another Docker runtime with Compose support
- backend dependencies installed in `apps/backend`
- mobile dependencies installed in `apps/mobile`
- optimizer virtualenv created in `apps/optimizer/venv` with `requirements.txt` installed
- local env files present for backend, mobile, and optimizer

Stop the app processes with `Ctrl-C`.

Stop the Docker database with:

```bash
npm run dev:down
```

## Project Scope

Tripcholic focuses on feasible single-day trip generation in Istanbul by considering user preferences, budget, time constraints, venue availability, routing, and weather context.
