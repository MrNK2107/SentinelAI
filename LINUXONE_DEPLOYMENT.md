# IBM LinuxONE Community Cloud Deployment Guide

This guide walks your team through registering for the **IBM LinuxONE Community Cloud**, deploying an **s390x virtual server** using the **IBM Z Datathon** event code, and setting up the **SentinelAI** platform.

---

## 1. Registration & Server Provisioning

### Step 1: Register on LinuxONE Community Cloud
1. Visit the registration portal: [LinuxONE Community Cloud VM Registration](https://linuxone.cloud.marist.edu/#/register?flag=VM)
2. Fill in your details (Name, Work/University Email, Organization).
3. **Important — Enter the Datathon Event Code:**
   - **Event Code:** `SSF2026`
   *(This extends your trial duration and provides the resources allocated for the Datathon).*
4. Submit the request and check your email for the confirmation link containing your **User ID** and temporary password.

---

## 2. SSH Key Setup (Crucial for Team Access)

Only **one Z server is permitted per team (4–6 members)**. You will share access via SSH keys.

1. **Log in** at [https://linuxone.cloud.marist.edu/#/login](https://linuxone.cloud.marist.edu/#/login).
2. Go to **Virtual Servers** (top-left) → click your **Username** (top-right) → select **Manage SSH Key Pairs**.
3. **Import Public Keys**:
   - Have all 4–6 teammates generate SSH keys on their local laptops if they haven't already:
     ```bash
     ssh-keygen -t ed25519 -C "team-member-name"
     ```
   - Upload the team leader's key first to deploy the instance.
   - Once the instance is running, append teammate public keys to `~/.ssh/authorized_keys` so everyone can SSH in.

---

## 3. Deploying the Virtual Server

1. In the portal, click **Create** or **Deploy Virtual Server**.
2. **Select Image / OS**:
   - Choose **Ubuntu 24.04 LTS** or **Ubuntu 22.04 LTS** (Architecture: `s390x`).
3. **Select Flavor / Sizing**:
   - Choose the recommended Datathon flavor (typically **General Purpose** `linuxone.standard` with 2–4 vCPUs and 4–8 GB RAM).
4. **Select Key Pair**:
   - Choose the SSH Key you imported.
5. Click **Deploy Instance**.
6. Wait 1–2 minutes until the status shows **Active** and take note of your **Public IP Address** (e.g., `148.100.x.x`).

---

## 4. Connecting & Team Setup

Connect to your server:
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@<YOUR_SERVER_PUBLIC_IP>
```

### Enable Multi-User Team Access
To let teammates access the same instance:
```bash
# Add teammates' public keys
echo "ssh-ed25519 AAAA... teammate1@laptop" >> ~/.ssh/authorized_keys
echo "ssh-ed25519 AAAA... teammate2@laptop" >> ~/.ssh/authorized_keys
```

---

## 5. Automated Setup of SentinelAI on LinuxONE

We have provided a one-step bootstrap script designed specifically for the `s390x` architecture:

```bash
# 1. Clone your project repository onto the LinuxONE instance
git clone <YOUR_GIT_REPO_URL> ibmz
cd ibmz

# 2. Make the bootstrap script executable and run it
chmod +x scripts/setup_linuxone.sh
./scripts/setup_linuxone.sh
```

### What the Script Handles Automatically:
1. Installs s390x build toolchains (`build-essential`, `cmake`, `libopenblas-dev`, `python3-dev`).
2. Installs official s390x Node.js & npm.
3. Configures a Python virtual environment with all ML dependencies (NumPy, LightGBM, SHAP, Scikit-learn, FastAPI).
4. Runs `scripts/run_pipeline.py` to train the forecaster and build `reports/scoreboard.json`.
5. Builds the TanStack Start / Three.js frontend.

---

## 6. Running SentinelAI in Production

### Start Backend Service (API)
```bash
source .venv/bin/activate
nohup python -m uvicorn sentinel.api.app:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```
- Verify API: `curl http://localhost:8000/api/v1/health`
- OpenAPI Docs: `http://<SERVER_IP>:8000/docs`

### Start Frontend Console
```bash
cd frontend
nohup npm run preview -- --host 0.0.0.0 --port 8080 > frontend.log 2>&1 &
```
- Access Console: `http://<SERVER_IP>:8080`

---

## 7. IBM Z & LinuxONE Value Narrative for the Datathon

When presenting your solution to the IBM judges, highlight how SentinelAI leverages LinuxONE:
1. **Mission-Critical Industrial Reliability**: LinuxONE's enterprise architecture is engineered for five-nines (99.999%) uptime—vital for continuous toxic gas and combustible atmosphere monitoring in heavy industry.
2. **Deterministic Safety Core**: Strict separation between the deterministic rule engine (which can stop work instantly) and the predictive ML forecaster.
3. **High-Throughput Sensor Ingestion**: Real-time multi-channel telemetry processing from hundreds of plant sensors with sub-millisecond graph traversals on s390x.
4. **Pervasive Security & Compliance**: Strict RAG regulatory adherence with verifiable provenance badges across DGMS, OISD-STD-105, and the Factories Act 1948.
