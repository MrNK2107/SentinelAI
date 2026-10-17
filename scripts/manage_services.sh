#!/usr/bin/env bash
# ==============================================================================
# SentinelAI - LinuxONE Server Maintenance Helper CLI
# Usage: ./scripts/manage_services.sh [start|stop|restart|status|logs|update|install-systemd]
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ACTION="${1:-status}"

install_systemd() {
    echo "Installing systemd services for SentinelAI..."
    sudo cp scripts/systemd/sentinel-backend.service /etc/systemd/system/
    sudo cp scripts/systemd/sentinel-frontend.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable sentinel-backend sentinel-frontend
    echo "Services installed and enabled! Start them with: sudo systemctl start sentinel-backend sentinel-frontend"
}

case "$ACTION" in
    start)
        echo "Starting SentinelAI services via systemctl..."
        sudo systemctl start sentinel-backend sentinel-frontend
        echo "Services started."
        ;;
    stop)
        echo "Stopping SentinelAI services..."
        sudo systemctl stop sentinel-backend sentinel-frontend || true
        echo "Services stopped."
        ;;
    restart)
        echo "Restarting SentinelAI services..."
        sudo systemctl restart sentinel-backend sentinel-frontend
        echo "Services restarted."
        ;;
    status)
        echo "=================================================================="
        echo " SentinelAI Service Status on IBM LinuxONE ($(uname -m))"
        echo "=================================================================="
        echo "--- Backend Service (systemctl) ---"
        sudo systemctl status sentinel-backend --no-pager -l || true
        echo ""
        echo "--- Frontend Service (systemctl) ---"
        sudo systemctl status sentinel-frontend --no-pager -l || true
        echo ""
        echo "--- Listening Network Ports ---"
        sudo ss -tulpn | grep -E ':8000|:8080' || echo "Ports 8000/8080 not currently listening."
        echo ""
        echo "--- System Resources (RAM & Disk) ---"
        free -h
        df -h /
        echo ""
        echo "--- Live API Health Probe ---"
        curl -s http://127.0.0.1:8000/api/v1/health || echo "API is not responding on 8000."
        echo ""
        ;;
    logs)
        TARGET="${2:-backend}"
        if [ "$TARGET" = "frontend" ]; then
            sudo journalctl -u sentinel-frontend -f
        else
            sudo journalctl -u sentinel-backend -f
        fi
        ;;
    update)
        echo "Pulling latest git changes..."
        git pull origin main
        echo "Updating dependencies..."
        source .venv/bin/activate
        pip install -r requirements.txt
        echo "Rebuilding frontend..."
        cd frontend && NITRO_PRESET=node-server npm run build && cd ..
        echo "Restarting services..."
        sudo systemctl restart sentinel-backend sentinel-frontend
        echo "Update completed successfully!"
        ;;
    install-systemd)
        install_systemd
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs [backend|frontend]|update|install-systemd}"
        exit 1
        ;;
esac
