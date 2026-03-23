#!/usr/bin/env bash

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${APP_DIR}/.env.local"
PORT="${DOCKER_PORT:-3020}"
CONTAINER_NAME="cophrase-web-local"
IMAGE_NAME="cophrase-web:local"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Create it first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

env_args=(
  --env-file "${ENV_FILE}"
  -e "BETTER_AUTH_URL=http://127.0.0.1:${PORT}"
  -e "BETTER_AUTH_INTERNAL_URL=http://127.0.0.1:3000"
)

if [[ -n "${DATABASE_URL:-}" ]]; then
  env_args+=(-e "DATABASE_URL=${DATABASE_URL//localhost/host.docker.internal}")
fi

if [[ -n "${WORKFLOW_POSTGRES_URL:-}" ]]; then
  env_args+=(
    -e "WORKFLOW_POSTGRES_URL=${WORKFLOW_POSTGRES_URL//localhost/host.docker.internal}"
  )
fi

if [[ -n "${S3_ENDPOINT:-}" ]]; then
  env_args+=(-e "S3_ENDPOINT=${S3_ENDPOINT//localhost/host.docker.internal}")
fi

docker run \
  --rm \
  --name "${CONTAINER_NAME}" \
  --add-host=host.docker.internal:host-gateway \
  -p "${PORT}:3000" \
  "${env_args[@]}" \
  "${IMAGE_NAME}"
