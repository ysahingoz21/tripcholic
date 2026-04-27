#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if docker compose version >/dev/null 2>&1; then
  cd "$ROOT_DIR"
  docker compose down
  exit 0
fi

if command -v docker-compose >/dev/null 2>&1; then
  cd "$ROOT_DIR"
  docker-compose down
  exit 0
fi

printf '[tripcholic-dev] ERROR: Docker Compose is required to stop the database container.\n' >&2
exit 1
