# IBM Z Datathon · Team Lead Execution & Delegation Plan

**Project:** SentinelAI — Industrial Digital Twin & Compound Risk Intelligence  
**Target Platform:** IBM LinuxONE Community Cloud (`s390x`)  
**Event Code:** `SSF2026`  

---

## 1. Quick Team Onboarding Message (Copy-Paste to WhatsApp / Discord / Slack)

```text
Team, here is our project setup for the IBM Z Datathon:

1. Project: SentinelAI - Industrial Safety Digital Twin & AI on IBM LinuxONE
2. GitHub Repo: <INSERT_YOUR_GITHUB_REPO_URL>
3. Server: Single IBM LinuxONE (s390x) server provisioned for our team.
   - Send me your public SSH key (~/.ssh/id_ed25519.pub or id_rsa.pub) so I can add you to the server.
4. Setup guide & scripts are in the repo: LINUXONE_DEPLOYMENT.md and scripts/setup_linuxone.sh

Check out your assigned role in TEAM_WORK_BREAKDOWN.md and let's coordinate!
```

---

## 2. Team Member Role Assignments (4–6 Members)

| Member | Track / Focus | Key Deliverables |
|---|---|---|
| **Member 1 (You - Lead)** | **System Architecture & Cloud Lead** | Deploy & maintain LinuxONE VM; manage GitHub repo & CI/CD; coordinate integrations; lead the pitch presentation. |
| **Member 2** | **ML Forecaster & Benchmarks** | Run `scripts/run_pipeline.py`; tune LightGBM thresholds; evaluate Tennessee Eastman (`validate_tep.py`) & HAI (`validate_hai.py`) datasets; extract scoreboard metrics for slides. |
| **Member 3** | **Knowledge Graph & Multi-Agent Workflow** | Validate process header reachability (`backend/graph`); verify permit suspension endpoints; test LangGraph safety workflow (`backend/agents/graph.py`); inspect compliance citations. |
| **Member 4** | **3D Digital Twin & Frontend Console** | Run and customize the TanStack + Three.js console (`frontend/`); refine 3D refinery scene markers; ensure responsive layout during the live judge demo. |
| **Member 5** | **Computer Vision (PPE) & Sensor Scenarios** | Check YOLO detector (`backend/vision/`); inspect worker detection and helmet/vest compliance feeds; prepare simulation what-if scenarios (gas surge, simultaneous operations). |
| **Member 6** *(if 6 members)* | **Compliance & Documentation / Presentation** | Align demo narrative with DGMS & Factories Act regulations; build pitch deck (5–7 slides); record a 2-minute backup demo video in case of network issues. |

*(If 4 or 5 members: Member 2 & 5 can be combined, and Member 3 & 6 can be combined).*

---

## 3. Timeline & Execution Checkpoints

### Phase 1: Day 0 – Pre-Datathon Setup (TODAY)
- [ ] Team lead registers on [LinuxONE Community Cloud](https://linuxone.cloud.marist.edu/#/register?flag=VM) with event code **`SSF2026`**.
- [ ] Push local `ibmz` repository to GitHub (Private or Public depending on rules).
- [ ] Collect teammate SSH public keys and add them to `~/.ssh/authorized_keys` on the LinuxONE server.
- [ ] Run `./scripts/setup_linuxone.sh` on the server and verify all 138 tests pass.

### Phase 2: Day 1 – System Integration & Fine-Tuning
- [ ] Verify live backend API at `http://<SERVER_IP>:8000/docs`.
- [ ] Run operator console at `http://<SERVER_IP>:8080`.
- [ ] Prepare 3 dynamic demo scenarios:
  1. **Scenario A (Blast Radius)**: Coke Oven Battery B reaches critical gas → Knowledge graph triggers emergency suspension of hot-work permits in connected zones.
  2. **Scenario B (Simultaneous Operations)**: Hot work permit requested in clean zone, but neighbouring unit within 300m is venting → Deterministic rejection.
  3. **Scenario C (Computer Vision PPE)**: Worker enters without safety helmet → Occupancy updated and alert escalated.

### Phase 3: Day 2 – Pitch Deck & Judge Presentation
- [ ] Prepare 5-7 slide pitch deck highlighting IBM Z mainframe fit.
- [ ] Record a 2-minute demo walk-through video as a backup.
- [ ] Rehearse live Q&A handling for technical judges (Alex Osadchyy, Bruce Gilkes).

---

## 4. Winning Pitch Blueprint for IBM Judges

When presenting to IBM SMEs, emphasize why this project was built for **IBM Z / LinuxONE**:
1. **Mission-Critical Reliability for Heavy Industry**:
   - Steel mills, chemical plants, and mines cannot afford cloud downtime. LinuxONE provides 99.999% availability for life-safety systems.
2. **Deterministic Safety Contract**:
   - AI/ML escalates and predicts, but deterministic logic enforces safety stops. Model output can never loosen an interlock.
3. **High-Throughput s390x Workload**:
   - Multi-channel sensor ingestion + microsecond knowledge graph traversals run natively on LinuxONE.
4. **Verifiable Regulatory Grounding**:
   - RAG assistant cites statutory standards (DGMS circulars, Factories Act 1948, OISD-STD-105) with provenance badges.
