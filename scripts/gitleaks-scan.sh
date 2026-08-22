#!/usr/bin/env bash
set -euo pipefail

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --source . --config .gitleaks.toml --redact --verbose
  exit 0
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker run --rm \
    -v "$PWD:/repo" \
    zricethezav/gitleaks:latest \
    detect --source /repo --config /repo/.gitleaks.toml --redact --verbose
  exit 0
fi

echo "gitleaks is required. Install it locally or start Docker so the containerized scanner can run." >&2
exit 1
