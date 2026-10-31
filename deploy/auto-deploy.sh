#!/usr/bin/env bash
# Runs every few minutes (systemd timer). Deploys only when GitHub main has a new commit.
# Before each deploy it copies the SQLite database to a timestamped backup inside the volume.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

echo "New commit $REMOTE (running $LOCAL): deploying"
C="docker compose --env-file .env -f deploy/docker-compose.yml"
$C exec -T app sh -c 'if [ -f /data/ideapulse.db ]; then cp /data/ideapulse.db "/data/ideapulse.backup-$(date +%Y%m%d%H%M).db"; ls -1t /data/ideapulse.backup-*.db | tail -n +6 | xargs -r rm -f; echo "database backed up"; fi' || echo "backup skipped (app not running?)"

./deploy/deploy.sh

# Curated open-source SaaS list: adds only what is missing, never deletes.
sleep 10
$C exec -T app node server/src/db/seed-repos.js | tail -2 || true
echo "Deployed $(git rev-parse --short HEAD)"
