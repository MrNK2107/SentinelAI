"""Automated remote deployment tool for SentinelAI to IBM LinuxONE Community Cloud."""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tarfile
import tempfile
import time
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

KEY_PATH = Path(r"C:\Users\nanda\Downloads\admin.pem")
PROJECT_ROOT = Path(__file__).resolve().parents[1]


def run_cmd(cmd: list[str], check: bool = True, stream: bool = False) -> subprocess.CompletedProcess:
    print(f"--> Executing: {' '.join(cmd)}")
    if stream:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        output = []
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            output.append(line)
        process.wait()
        res = subprocess.CompletedProcess(cmd, process.returncode, "".join(output), "")
    else:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    if check and res.returncode != 0:
        print(f"Error (code {res.returncode}):\n{res.stderr if hasattr(res, 'stderr') else ''}\n{res.stdout if hasattr(res, 'stdout') else ''}")
        sys.exit(res.returncode)
    return res


_REMOTE_USER = "linux1"


def get_ssh_user(ip: str) -> str:
    global _REMOTE_USER
    for user in ("linux1", "ubuntu"):
        cmd = [
            "ssh",
            "-n",
            "-i", str(KEY_PATH),
            "-o", "StrictHostKeyChecking=no",
            "-o", "ConnectTimeout=5",
            f"{user}@{ip}",
            "echo OK",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"--> Authenticated successfully as '{user}'")
            _REMOTE_USER = user
            return user
    print(f"--> Warning: defaulting to '{_REMOTE_USER}'")
    return _REMOTE_USER


def ssh_cmd(ip: str, remote_script: str, stream: bool = False) -> subprocess.CompletedProcess:
    cmd = [
        "ssh",
        "-n",
        "-i", str(KEY_PATH),
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=15",
        f"{_REMOTE_USER}@{ip}",
        remote_script,
    ]
    return run_cmd(cmd, stream=stream)


def create_archive(output_path: Path):
    print("--> Packaging project files into archive (excluding venv, node_modules, git)...")
    exclude_parts = {".venv", "venv", "node_modules", ".git", ".cache", "__pycache__"}

    def tar_filter(tarinfo):
        parts = Path(tarinfo.name).parts
        for p in parts:
            if p in exclude_parts or p.endswith(".pyc"):
                return None
        return tarinfo

    with tarfile.open(output_path, "w:gz") as tar:
        for item in PROJECT_ROOT.iterdir():
            if item.name in exclude_parts:
                continue
            tar.add(item, arcname=item.name, filter=tar_filter)
    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"--> Created clean archive {output_path.name} ({size_mb:.2f} MB)")


def deploy(ip: str):
    if not KEY_PATH.exists():
        print(f"Error: Key file {KEY_PATH} not found.")
        sys.exit(1)

    print(f"==================================================================")
    print(f" Deploying SentinelAI to IBM LinuxONE Server: {ip}")
    print(f"==================================================================")

    # 1. Test SSH connectivity
    print("--> Testing SSH connectivity to LinuxONE instance...")
    user = get_ssh_user(ip)
    res = ssh_cmd(ip, "uname -m && uptime")
    print(f"--> Remote host info:\n{res.stdout.strip()}")

    # 2. Prepare remote directory
    ssh_cmd(ip, "mkdir -p ~/ibmz")

    # 3. Create and upload archive
    with tempfile.TemporaryDirectory() as tmpdir:
        archive_path = Path(tmpdir) / "ibmz_bundle.tar.gz"
        create_archive(archive_path)

        print(f"--> Uploading codebase to {ip}:~/ibmz_bundle.tar.gz via scp...")
        run_cmd([
            "scp",
            "-i", str(KEY_PATH),
            "-o", "StrictHostKeyChecking=no",
            "-o", "BatchMode=yes",
            str(archive_path),
            f"{user}@{ip}:~/ibmz_bundle.tar.gz",
        ])

    # 4. Extract archive on remote server
    print("--> Extracting files on remote server...")
    ssh_cmd(ip, "tar -xzf ~/ibmz_bundle.tar.gz -C ~/ibmz && rm ~/ibmz_bundle.tar.gz")

    # 5. Run LinuxONE bootstrap
    print("--> Running setup_linuxone.sh on s390x (this compiles dependencies)...")
    ssh_cmd(ip, "cd ~/ibmz && chmod +x scripts/*.sh && bash scripts/setup_linuxone.sh", stream=True)

    # 6. Install systemd services and start
    print("--> Installing and starting production background services...")
    ssh_cmd(ip, "cd ~/ibmz && bash scripts/manage_services.sh install-systemd && bash scripts/manage_services.sh start", stream=True)

    # 7. Check health
    print("--> Verifying remote API health...")
    time.sleep(3)
    res = ssh_cmd(ip, "curl -s http://127.0.0.1:8000/api/v1/health || true")
    print(f"--> API Health Response:\n{res.stdout.strip()}")

    print("==================================================================")
    print(f" DEPLOYMENT SUCCESSFUL!")
    print(f" Web Console URL: http://{ip}:8080")
    print(f" API Docs URL:    http://{ip}:8000/docs")
    print("==================================================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy to LinuxONE")
    parser.add_argument("--ip", required=True, help="Public IP address of LinuxONE instance")
    args = parser.parse_args()
    deploy(args.ip)
