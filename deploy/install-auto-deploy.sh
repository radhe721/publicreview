#!/usr/bin/env bash
# One-time setup on the server. Afterwards every push to GitHub main is deployed automatically
# within 5 minutes (with a database backup first). Logs: journalctl -u businessliste-autodeploy
# Usage (on the server, as the user that owns ~/publicreview):  bash deploy/install-auto-deploy.sh
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_AS="$(id -un)"
chmod +x "$APP_DIR/deploy/auto-deploy.sh" "$APP_DIR/deploy/deploy.sh"

sudo tee /etc/systemd/system/businessliste-autodeploy.service >/dev/null <<UNIT
[Unit]
Description=BusinessListe: deploy new commits from GitHub main
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
User=$RUN_AS
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/deploy/auto-deploy.sh
UNIT

sudo tee /etc/systemd/system/businessliste-autodeploy.timer >/dev/null <<UNIT
[Unit]
Description=Check GitHub main for BusinessListe updates every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now businessliste-autodeploy.timer
echo "Auto-deploy is on. Running the first check now..."
sudo systemctl start businessliste-autodeploy.service || true
sudo journalctl -u businessliste-autodeploy --no-pager -n 20
