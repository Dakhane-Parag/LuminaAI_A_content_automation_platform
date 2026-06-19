#!/bin/bash
##############################################################
# BrandFlow AI — EC2 One-Time Server Setup Script
# Run this ONCE after SSHing into a fresh Ubuntu 22.04 instance.
#
# Usage:
#   chmod +x setup.sh && ./setup.sh
#
# What it does:
#   1. Updates system packages
#   2. Installs Python 3, pip, venv, Nginx, Git
#   3. Clones the GitHub repo
#   4. Creates Python virtualenv and installs dependencies
#   5. Installs systemd services (auto-start, auto-restart)
#   6. Configures Nginx as reverse proxy
#   7. Starts everything
##############################################################

set -e  # Exit immediately if any command fails

REPO_URL="https://github.com/Dakhane-Parag/LuminaAI_A_content_automation_platform.git"
APP_DIR="/home/ubuntu/app"
BACKEND_DIR="$APP_DIR/backend"

echo ""
echo "============================================================"
echo "  BrandFlow AI — EC2 Server Setup"
echo "============================================================"
echo ""

# ── Step 1: System update ────────────────────────────────────
echo "[1/7] Updating system packages..."
sudo apt update -y && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv nginx git curl unzip

# ── Step 2: Clone repo ───────────────────────────────────────
echo "[2/7] Cloning repository..."
if [ -d "$APP_DIR" ]; then
    echo "  → $APP_DIR already exists, pulling latest..."
    cd "$APP_DIR" && git pull
else
    git clone "$REPO_URL" "$APP_DIR"
fi

# ── Step 3: Python venv + dependencies ───────────────────────
echo "[3/7] Setting up Python virtualenv..."
cd "$BACKEND_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# ── Step 4: Create generated_images directory ─────────────────
echo "[4/7] Creating generated_images directory..."
mkdir -p "$BACKEND_DIR/generated_images"
chmod 755 "$BACKEND_DIR/generated_images"

# ── Step 5: Check .env file ───────────────────────────────────
echo "[5/7] Checking .env file..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo ""
    echo "  ⚠️  WARNING: .env file not found at $BACKEND_DIR/.env"
    echo "  You MUST create it before services will work."
    echo "  Copy .env.production.example and fill in your values."
    echo ""
else
    echo "  ✓ .env file found"
fi

# ── Step 6: Install systemd services ─────────────────────────
echo "[6/7] Installing systemd services..."
sudo cp "$BACKEND_DIR/deploy/brandflow-api.service" /etc/systemd/system/
sudo cp "$BACKEND_DIR/deploy/brandflow-celery.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable brandflow-api brandflow-celery
sudo systemctl start brandflow-api brandflow-celery

# ── Step 7: Configure Nginx ──────────────────────────────────
echo "[7/7] Configuring Nginx..."
sudo rm -f /etc/nginx/sites-enabled/default
sudo cp "$BACKEND_DIR/deploy/nginx.conf" /etc/nginx/sites-available/brandflow
sudo ln -sf /etc/nginx/sites-available/brandflow /etc/nginx/sites-enabled/brandflow
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  ✅  Setup Complete!"
echo "============================================================"
echo ""
echo "  Service status:"
sudo systemctl is-active brandflow-api    && echo "  ✓ FastAPI:       RUNNING" || echo "  ✗ FastAPI:       STOPPED (check: sudo journalctl -u brandflow-api -n 30)"
sudo systemctl is-active brandflow-celery && echo "  ✓ Celery:        RUNNING" || echo "  ✗ Celery:        STOPPED (check: sudo journalctl -u brandflow-celery -n 30)"
sudo systemctl is-active nginx            && echo "  ✓ Nginx:         RUNNING" || echo "  ✗ Nginx:         STOPPED"
echo ""
echo "  Test your API:"
echo "  curl http://\$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/"
echo ""
echo "  View logs:"
echo "    sudo journalctl -u brandflow-api -f"
echo "    sudo journalctl -u brandflow-celery -f"
echo ""
