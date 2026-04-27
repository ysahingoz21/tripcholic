#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"
OPTIMIZER_DIR="$ROOT_DIR/apps/optimizer"
MOBILE_DIR="$ROOT_DIR/apps/mobile"

SERVICE_PIDS=()
SERVICE_NAMES=()

log() {
  printf '[tripcholic-dev] %s\n' "$1"
}

fail() {
  printf '[tripcholic-dev] ERROR: %s\n' "$1" >&2
  exit 1
}

require_file() {
  local path="$1"
  local help_text="$2"

  if [[ ! -f "$path" ]]; then
    fail "$path is missing. $help_text"
  fi
}

require_dir() {
  local path="$1"
  local help_text="$2"

  if [[ ! -d "$path" ]]; then
    fail "$path is missing. $help_text"
  fi
}

find_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    return
  fi

  fail 'Docker Compose is required. Install Docker Desktop or docker-compose first.'
}

wait_for_postgres() {
  local attempts=30
  local count=1

  log 'Waiting for PostgreSQL to accept connections...'
  while (( count <= attempts )); do
    if docker exec tripcholic-db pg_isready -U postgres -d tripcholic >/dev/null 2>&1; then
      log 'PostgreSQL is ready.'
      return
    fi

    sleep 1
    count=$((count + 1))
  done

  fail 'PostgreSQL did not become ready in time. Check `docker ps` and `docker logs tripcholic-db`.'
}

prefix_output() {
  local name="$1"
  while IFS= read -r line; do
    printf '[%s] %s\n' "$name" "$line"
  done
}

start_service() {
  local name="$1"
  local workdir="$2"
  shift 2

  log "Starting $name..."
  (
    cd "$workdir"
    "$@" 2>&1 | prefix_output "$name"
  ) &

  SERVICE_PIDS+=("$!")
  SERVICE_NAMES+=("$name")
}

shutdown_children() {
  local reason="${1:-Stopping services...}"
  log "$reason"

  local pid
  for pid in "${SERVICE_PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done

  for pid in "${SERVICE_PIDS[@]:-}"; do
    wait "$pid" >/dev/null 2>&1 || true
  done
}

monitor_services() {
  while true; do
    local index
    for index in "${!SERVICE_PIDS[@]}"; do
      local pid="${SERVICE_PIDS[$index]}"
      local name="${SERVICE_NAMES[$index]}"

      if ! kill -0 "$pid" >/dev/null 2>&1; then
        set +e
        wait "$pid"
        local status=$?
        set -e

        shutdown_children "$name exited (status $status). Shutting down the rest of the local stack..."
        exit "$status"
      fi
    done

    sleep 1
  done
}

trap 'shutdown_children "Received interrupt. Stopping backend, optimizer, and mobile..."; exit 0' INT TERM

command -v npm >/dev/null 2>&1 || fail 'npm is required.'
command -v docker >/dev/null 2>&1 || fail 'Docker is required.'

require_file "$ROOT_DIR/docker-compose.yml" 'This script expects the repo root docker-compose.yml file.'
require_file "$BACKEND_DIR/package.json" 'Run from the Tripcholic repo root.'
require_file "$MOBILE_DIR/package.json" 'Run from the Tripcholic repo root.'
require_file "$OPTIMIZER_DIR/main.py" 'Run from the Tripcholic repo root.'
require_dir "$BACKEND_DIR/node_modules" 'Install backend dependencies with `cd apps/backend && npm install`.'
require_dir "$MOBILE_DIR/node_modules" 'Install mobile dependencies with `cd apps/mobile && npm install`.'
require_file "$BACKEND_DIR/.env" 'Copy apps/backend/.env.example to apps/backend/.env and fill the values.'
require_file "$MOBILE_DIR/.env" 'Copy apps/mobile/.env.example to apps/mobile/.env.'
require_file "$OPTIMIZER_DIR/.env" 'Copy apps/optimizer/.env.example to apps/optimizer/.env.'

OPTIMIZER_PYTHON="${OPTIMIZER_PYTHON:-$OPTIMIZER_DIR/venv/bin/python}"
if [[ ! -x "$OPTIMIZER_PYTHON" ]]; then
  fail "Optimizer Python runtime not found at $OPTIMIZER_PYTHON. Create the venv and install requirements in apps/optimizer first."
fi

find_compose_cmd

log "Repo root: $ROOT_DIR"
log 'Starting Docker database container...'
"${COMPOSE_CMD[@]}" up -d db >/dev/null
wait_for_postgres

log 'Starting app services with prefixed logs.'
start_service 'backend' "$BACKEND_DIR" npm run start:dev
start_service 'optimizer' "$OPTIMIZER_DIR" "$OPTIMIZER_PYTHON" -m uvicorn main:app --host 0.0.0.0 --reload
start_service 'mobile' "$MOBILE_DIR" npm run start

log 'Local stack booted. Press Ctrl-C to stop backend, optimizer, and mobile. Database stays running until `npm run dev:down`.'
monitor_services
