#!/usr/bin/env bash
# Pull the latest main from GitHub and rebuild/restart the app on the server.
# Usage (on the server): ~/publicreview/deploy/deploy.sh [git-ref]
set -euo pipefail
cd "$(dirname "$0")/.."

REF="${1:-main}"
git fetch --all --prune
git checkout --quiet "$REF"
[ "$REF" = "main" ] && git reset --hard origin/main

docker compose --env-file .env -f deploy/docker-compose.yml up -d --build
docker image prune -f >/dev/null
echo "Deployed $(git rev-parse --short HEAD)"
