#!/usr/bin/env bash
# ==============================================================================
# SentinelAI - IBM LinuxONE Community Cloud (s390x) Bootstrap Script
# Target: Ubuntu 22.04 / 24.04 LTS on IBM Z / LinuxONE (s390x)
# ==============================================================================
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "=================================================================="
echo " Starting SentinelAI Setup on IBM LinuxONE (Architecture: $(uname -m))"
echo "=================================================================="

# 1. System Package Updates & Prerequisites
echo "[1/5] Updating apt repositories and installing build toolchains..."
sudo apt-get update -y
sudo apt-get install -y \
    build-essential \
    cmake \
    gfortran \
    pkg-config \
    python3-dev \
    python3-pip \
    python3-venv \
    python3-scipy \
    python3-sklearn \
    python3-numpy \
    python3-pandas \
    python3-joblib \
    python3-matplotlib \
    python3-llvmlite \
    libopenblas-dev \
    liblapack-dev \
    git \
    curl \
    htop \
    tmux \
    nginx

# 2. Install Node.js (s390x native)
echo "[2/5] Setting up Node.js for s390x..."
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-s390x.tar.xz | sudo tar -xJf - --strip-components=1 -C /usr/local
fi
sudo ln -sf /usr/local/bin/node /usr/bin/node
sudo ln -sf /usr/local/bin/npm /usr/bin/npm
echo "Node version: $(node -v)"
echo "NPM version:  $(npm -v)"

# 3. Python Virtual Environment & Dependencies
echo "[3/5] Setting up Python virtual environment..."
export PYTHONIOENCODING=utf-8
export LC_ALL=C.UTF-8
python3 -m venv --system-site-packages .venv
source .venv/bin/activate
pip install --no-color --progress-bar off --upgrade pip setuptools wheel

echo "Installing Python dependencies (using s390x native wheels and constraints)..."
pip install --no-color --progress-bar off -c constraints.txt --no-build-isolation "numba==0.59.1"
pip install --no-color --progress-bar off -c constraints.txt lightgbm shap fastapi uvicorn pydantic
pip install --no-color --progress-bar off --no-build-isolation --no-deps -e .

# 4. Train Models & Produce Evaluation Artefacts
echo "[4/5] Training forecaster models and generating scoreboard..."
python scripts/run_pipeline.py --episodes 300

# 5. Frontend Production Verification
echo "[5/5] Verifying production frontend SSR bundle..."
if [ -f "frontend/.output/server/index.mjs" ]; then
    echo "Frontend SSR bundle present and verified (.output/server/index.mjs)."
else
    echo "Warning: frontend/.output/server/index.mjs not found; attempting local build..."
    if [ -d "frontend" ]; then
        cd frontend
        npm install --legacy-peer-deps || true
        NITRO_PRESET=node-server npm run build || true
        cd ..
    fi
fi

echo "=================================================================="
echo " Setup Complete on IBM LinuxONE!"
echo " "
echo " To start the backend API:"
echo "   source .venv/bin/activate"
echo "   python -m uvicorn sentinel.api.app:app --host 0.0.0.0 --port 8000"
echo " "
echo " To preview or run frontend dev server:"
echo "   cd frontend && npm run dev -- --host 0.0.0.0"
echo "=================================================================="
