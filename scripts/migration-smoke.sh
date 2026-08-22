#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${MIGRATION_SMOKE_DATABASE:-bumpa_migration_smoke_${GITHUB_RUN_ID:-local}_$$}"
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_ADMIN_USER="${DATABASE_ADMIN_USER:-$(whoami)}"
DB_ADMIN_PASSWORD="${DATABASE_ADMIN_PASSWORD:-}"
APP_DB_USER="${DATABASE_USER:-bumpa}"
APP_DB_PASSWORD="${DATABASE_PASSWORD:-bumpa}"

cleanup() {
  PGPASSWORD="$DB_ADMIN_PASSWORD" dropdb \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_ADMIN_USER" \
    --if-exists \
    "$DB_NAME" >/dev/null 2>&1 || true
}

trap cleanup EXIT

cleanup
if ! PGPASSWORD="$DB_ADMIN_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_ADMIN_USER" \
  -d postgres \
  -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$APP_DB_USER'" | grep -q 1; then
  PGPASSWORD="$DB_ADMIN_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_ADMIN_USER" \
    -d postgres \
    -v ON_ERROR_STOP=1 \
    -c "CREATE ROLE \"$APP_DB_USER\" WITH LOGIN PASSWORD '$APP_DB_PASSWORD'"
fi

PGPASSWORD="$DB_ADMIN_PASSWORD" createdb \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_ADMIN_USER" \
  -O "$APP_DB_USER" \
  "$DB_NAME"

DATABASE_NAME="$DB_NAME" npm run migration:run
DATABASE_NAME="$DB_NAME" npm run migration:show
