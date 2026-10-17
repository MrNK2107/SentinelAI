# IBM LinuxONE (s390x) Server Maintenance & Operations Guide

As the **Team Lead**, you are the custodian of your team's single IBM Z LinuxONE virtual server. This guide gives you the exact operational procedures, commands, and best practices to keep the server secure, running 24/7 without crashing, and ready for the judges.

---

## Quick Reference Commands

| Task | Command |
|---|---|
| Check service status & health | `./scripts/manage_services.sh status` |
| View live backend logs | `./scripts/manage_services.sh logs backend` |
| View live frontend logs | `./scripts/manage_services.sh logs frontend` |
| Restart all services | `./scripts/manage_services.sh restart` |
| Deploy latest git code & rebuild | `./scripts/manage_services.sh update` |
| Check RAM & Disk space | `free -h && df -h /` |
| Kill a stuck port 8000 process | `sudo fuser -k 8000/tcp` |

---

## 1. Access & Teammate Management

You have **one server** for all 4–6 team members. All teammates connect over SSH using the default user (`ubuntu`).

### Adding a Teammate's SSH Key
1. Have your teammate send you their public key string (`cat ~/.ssh/id_ed25519.pub` or `id_rsa.pub`).
2. On the server, open the authorized keys file:
   ```bash
   nano ~/.ssh/authorized_keys
   ```
3. Paste their public key string on a new line and save (`Ctrl+O`, `Enter`, `Ctrl+X`).
4. Ensure correct file permissions:
   ```bash
   chmod 600 ~/.ssh/authorized_keys
   chmod 700 ~/.ssh
   ```
5. Test their connection: Teammate connects using:
   ```bash
   ssh -i ~/.ssh/id_ed25519 ubuntu@<SERVER_PUBLIC_IP>
   ```

> [!WARNING]
> Never delete your own public key from `~/.ssh/authorized_keys`, or you will lock yourself out of the cloud console. Always keep a backup copy of your private key on your laptop.

---

## 2. Keeping Services Running 24/7 with `systemd`

**Do not run servers directly in an SSH terminal session.** If your laptop goes to sleep or your Wi-Fi disconnects, the server will terminate immediately.

Use the provided production systemd services:

### Step 1: Install & Enable Services
Run this once from the repository root:
```bash
./scripts/manage_services.sh install-systemd
```
This registers `sentinel-backend.service` and `sentinel-frontend.service` with the Linux kernel. They will automatically start on boot and automatically restart if any process ever crashes.

### Step 2: Controlling the Services
```bash
# Start both services
sudo systemctl start sentinel-backend sentinel-frontend

# Check status
sudo systemctl status sentinel-backend --no-pager
sudo systemctl status sentinel-frontend --no-pager

# Restart after configuration changes
sudo systemctl restart sentinel-backend sentinel-frontend

# Stop services
sudo systemctl stop sentinel-backend sentinel-frontend
```

---

## 3. Network Ports & Firewall

Ensure the ports required for SentinelAI are reachable from outside:
- **Port 22**: SSH (remote administration)
- **Port 8000**: FastAPI Backend REST API & OpenAPI Docs
- **Port 8080**: Web Operator Console & 3D Digital Twin

### Check Active Listening Ports
```bash
sudo ss -tulpn | grep -E ':8000|:8080|:22'
```

### If Ubuntu UFW Firewall is Enabled
Allow traffic on these ports:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 8080/tcp
sudo ufw status
```

---

## 4. Hardware & Resource Monitoring on LinuxONE (s390x)

IBM Z / LinuxONE is a big-endian mainframe architecture (`s390x`). Demonstrating this live to IBM judges shows your solution genuinely runs on their hardware.

### Mainframe Architecture Proof Commands
Run these to inspect the virtualized IBM zSystems hardware:
```bash
# Verify s390x architecture
uname -m
# Output: s390x

# Check CPU & System details
lscpu
cat /proc/sysinfo
```

### Live Resource Monitoring
Watch memory, CPU, and process loads in real time:
```bash
htop
```
*(Press `q` to quit `htop`).*

### Creating Swap Space (Crucial for 4GB RAM VMs)
If your VM has 4GB of RAM, compiling heavy packages or running LightGBM training can spike memory. Adding a 2GB swap file prevents out-of-memory (OOM) crashes:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

---

## 5. Team Code Update Workflow

When teammates make changes locally and push to your team's GitHub repository:

### Step 1: Safe Pull & Rebuild
Use the helper script to pull, update dependencies, rebuild frontend, and reload services with zero downtime:
```bash
./scripts/manage_services.sh update
```

### Manual Step-by-Step (Alternative)
```bash
git pull origin main

# If backend python code changed:
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart sentinel-backend

# If frontend React code changed:
cd frontend
npm run build
cd ..
sudo systemctl restart sentinel-frontend
```

---

## 6. Log Inspection & Troubleshooting

### Viewing Live Logs
```bash
# Live tail of backend errors and requests:
sudo journalctl -u sentinel-backend -f

# Live tail of frontend console:
sudo journalctl -u sentinel-frontend -f
```

### Common Issue 1: Port 8000 or 8080 Already in Use
If uvicorn fails to start with `[Errno 98] Address already in use`:
```bash
sudo fuser -k 8000/tcp
sudo fuser -k 8080/tcp
sudo systemctl restart sentinel-backend sentinel-frontend
```

### Common Issue 2: Disk Space Full
Node builds and Python pip caches can fill small cloud volumes. Check free space:
```bash
df -h /
```
If disk usage is over 85%, clean cached build files:
```bash
sudo apt-get clean
npm cache clean --force
sudo journalctl --vacuum-time=2d
```

---

## 7. Emergency Checklist: 15 Minutes Before Judge Demo

Run this rapid health check before entering the presentation room:

1. **Verify Backend Health**:
   ```bash
   curl -s http://127.0.0.1:8000/api/v1/health | jq
   # Expect: status="ok" or "degraded" (with loaded models)
   ```
2. **Verify Frontend**:
   Open browser at `http://<SERVER_PUBLIC_IP>:8080` in an incognito window.
3. **Verify Interactive API Docs**:
   Open `http://<SERVER_PUBLIC_IP>:8000/docs`.
4. **Keep a Hot Backup**:
   Keep a terminal open running:
   ```bash
   sudo journalctl -u sentinel-backend -f
   ```
   If any demo request fails, you will immediately see the error traceback.
