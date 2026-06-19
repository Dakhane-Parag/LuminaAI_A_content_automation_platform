#!/bin/bash
##############################################################
# BrandFlow AI — Update Script
# Run this every time you push new code to GitHub
# and want to deploy it to EC2.
#
# Usage (from EC2 SSH):
#   cd /home/ubuntu/app && bash backend/deploy/update.sh
##############################################################

set -e

APP_DIR="/home/ubuntu/app"
BACKEND_DIR="$APP_DIR/backend"

echo ""
echo "[update] Pulling latest code from GitHub..."
cd "$APP_DIR"
git pull

echo "[update] Installing any new dependencies..."
cd "$BACKEND_DIR"
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate

echo "[update] Restarting services..."
sudo systemctl restart brandflow-api
sudo systemctl restart brandflow-celery

echo ""
echo "✅ Update complete!"
sudo systemctl is-active brandflow-api    && echo "  ✓ FastAPI:  RUNNING"
sudo systemctl is-active brandflow-celery && echo "  ✓ Celery:   RUNNING"
echo ""
