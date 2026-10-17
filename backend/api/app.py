"""SentinelAI REST API.

Design notes:
  * The safety-critical path (forecaster + deterministic rule engine) never depends
    on the LLM. /compliance and /workflow degrade; /zones and /permits/evaluate do not.
  * Every response is a declared Pydantic model, so /docs is a usable integration
    contract rather than a debug page.
  * Errors return RFC-7807-style problem detail bodies with a stable `type`.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sentinel import __version__
from sentinel import config as C
from sentinel.api import schemas as S
from sentinel.api.service import plant
from sentinel.geo.site import PROXIMITY_RADIUS_M
from sentinel.llm.provider import get_llm
from sentinel.rules.engine import (
    PermitRequest,
    ProximateHazard,
    ZoneConditions,
    evaluate_permit,
)

ROOT = Path(__file__).resolve().parents[2]
log = logging.getLogger("sentinel.clock")

DESCRIPTION = """
Compound industrial safety intelligence.

Fuses gas, pressure, temperature, vibration and operational context (permits,
maintenance) into a forward-looking risk forecast, explains every alert with SHAP,
enforces deterministic permit interlocks, and coordinates response through a
multi-agent workflow.

**Safety contract:** the machine-learning layer may *escalate or reject* work. It can
never approve work that the deterministic gas/oxygen interlocks have rejected.
"""


def _clock_interval() -> float:
    """Wall-clock seconds per plant minute, overridable at runtime."""
    raw = os.environ.get("SENTINEL_CLOCK_SECONDS")
    if not raw:
        return float(C.CLOCK_SECONDS_PER_MINUTE)
    try:
        return max(0.05, float(raw))
    except ValueError:
        log.warning("ignoring invalid SENTINEL_CLOCK_SECONDS=%r", raw)
        return float(C.CLOCK_SECONDS_PER_MINUTE)


async def _run_clock(interval: float) -> None:
    """Advance the plant clock forever, so the console is live on arrival.

    A real control room does not pause because nobody is looking at it. The clock
    is server state, so every page and every connected client sees the same
    minute without any of them having to drive it. It wraps at the end of the
    episode and replays, which is what makes the console continuously running
    rather than a recording that stops.

    A failure here must never take the API down: the plant state is still
    perfectly readable at a frozen minute, so we log and keep going.
    """
    plant.seconds_per_minute = interval
    plant.clock_running = True
    try:
        while True:
            await asyncio.sleep(interval)
            if not plant.ready:
                continue
            try:
                plant.tick(1)
            except Exception:
                log.exception("plant clock tick failed; clock continues")
    except asyncio.CancelledError:
        raise
    finally:
        plant.clock_running = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    plant.startup()
    interval = _clock_interval()
    task = asyncio.create_task(_run_clock(interval), name="sentinel-plant-clock")
    log.info("plant clock started: 1 plant minute per %.2fs wall clock", interval)
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="SentinelAI",
    version=__version__,
    description=DESCRIPTION,
    lifespan=lifespan,
    contact={"name": "SentinelAI"},
    license_info={"name": "See repository LICENSE"},
    openapi_tags=[
        {"name": "system", "description": "Health and readiness."},
        {"name": "plant", "description": "Live zone telemetry and risk state."},
        {"name": "alerts", "description": "Prioritised alert queue."},
        {"name": "permits", "description": "Deterministic permit interlocks."},
        {"name": "compliance", "description": "RAG-grounded regulatory answers."},
        {"name": "workflow", "description": "Multi-agent safety workflow."},
        {"name": "evaluation", "description": "Baseline-vs-compound evidence."},
    ],
)

# Dev origins for the operator console. Vite's default is 5173; this project's
# console runs on 8080. Override with SENTINEL_CORS_ORIGINS (comma-separated).
_DEFAULT_ORIGINS = [
    "*",
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:8080", "http://127.0.0.1:8080",
    "http://localhost:3000", "http://127.0.0.1:3000",
]
_origins = [
    o.strip() for o in os.environ.get("SENTINEL_CORS_ORIGINS", "").split(",") if o.strip()
] or _DEFAULT_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api/v1")


def _require_ready() -> None:
    if not plant.ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=plant.error or "service starting",
        )


# ------------------------------------------------------------------- system
@api.get("/health", response_model=S.HealthResponse, tags=["system"])
def health() -> S.HealthResponse:
    return S.HealthResponse(
        status="ok" if plant.ready else "degraded",
        version=__version__,
        model_loaded=plant.model is not None,
        llm_backend=get_llm().backend,
        regulation_chunks=len(plant.store.chunks) if plant.store else 0,
    )


# -------------------------------------------------------------------- plant
@api.get("/zones", response_model=list[S.ZoneState], tags=["plant"])
def zones() -> list[S.ZoneState]:
    _require_ready()
    return [S.ZoneState(**z) for z in plant.zone_states()]


@api.get("/zones/{zone_id}", response_model=S.ZoneState, tags=["plant"])
def zone(zone_id: str) -> S.ZoneState:
    _require_ready()
    try:
        return S.ZoneState(**plant.zone_state(zone_id))
    except KeyError:
        raise HTTPException(404, f"unknown zone '{zone_id}'")


@api.get("/zones/{zone_id}/history", response_model=list[S.ZoneReading], tags=["plant"])
def zone_history(zone_id: str,
                 window: int = Query(90, ge=10, le=240)) -> list[S.ZoneReading]:
    _require_ready()
    try:
        return [S.ZoneReading(**r) for r in plant.zone_history(zone_id, window)]
    except KeyError:
        raise HTTPException(404, f"unknown zone '{zone_id}'")


@api.get("/vision", response_model=S.VisionResponse, tags=["plant"])
def vision() -> S.VisionResponse:
    """Detector-derived occupancy, with imagery provenance.

    Never fails when the CV stack is absent — it reports `active: false` and the
    reason, and the rest of the system runs on simulated occupancy.
    """
    _require_ready()
    return S.VisionResponse(**plant.vision_report())


@api.get("/site/geo", response_model=S.SiteGeoResponse, tags=["plant"])
def site_geo() -> S.SiteGeoResponse:
    """Real site boundary (OpenStreetMap, ODbL) with explicit provenance."""
    _require_ready()
    return S.SiteGeoResponse(**plant.site_geo())


@api.get("/zones/{zone_id}/proximity", response_model=list[S.ProximateHazardOut],
         tags=["plant"])
def zone_proximity(zone_id: str,
                   radius_m: float = Query(PROXIMITY_RADIUS_M, ge=50, le=8000)
                   ) -> list[S.ProximateHazardOut]:
    """Neighbouring zones with elevated gas within `radius_m` real metres."""
    _require_ready()
    try:
        return [S.ProximateHazardOut(**h)
                for h in plant.proximate_hazards(zone_id, radius_m=radius_m)]
    except KeyError:
        raise HTTPException(404, f"unknown zone '{zone_id}'")


@api.post("/clock/tick", response_model=S.ClockResponse, tags=["plant"])
def tick(steps: int = Query(1, ge=1, le=60)) -> S.ClockResponse:
    """Skip forward. The clock keeps advancing on its own from where it lands."""
    _require_ready()
    plant.tick(steps)
    return S.ClockResponse(**plant.clock_state())


@api.post("/clock/set", response_model=S.ClockResponse, tags=["plant"])
def set_clock(minute: int = Query(..., ge=0, le=239)) -> S.ClockResponse:
    """Seek to a minute. The clock keeps advancing on its own from there."""
    _require_ready()
    plant.set_minute(minute)
    return S.ClockResponse(**plant.clock_state())


@api.get("/clock", response_model=S.ClockResponse, tags=["plant"])
def clock() -> S.ClockResponse:
    return S.ClockResponse(**plant.clock_state())


# ------------------------------------------------------------------- alerts
@api.get("/alerts", response_model=list[S.AlertItem], tags=["alerts"])
def alerts() -> list[S.AlertItem]:
    _require_ready()
    return [S.AlertItem(**a) for a in plant.alerts()]


# ------------------------------------------------------------------ permits
@api.post("/permits/evaluate", response_model=S.PermitDecisionResponse, tags=["permits"])
def evaluate(body: S.PermitRequestBody) -> S.PermitDecisionResponse:
    """Deterministic interlocks, optionally escalated by the compound-risk model.

    This endpoint does not require the LLM and stays available if it is down.
    """
    _require_ready()
    try:
        s = plant.zone_state(body.zone_id)
    except KeyError:
        raise HTTPException(404, f"unknown zone '{body.zone_id}'")

    cond = ZoneConditions(
        gas_lel=s["gas_lel"], gas_trend=s["gas_trend"],
        maintenance_active=s["maintenance_active"],
        workers_in_zone=s["workers_in_zone"],
        # Spatial context: units venting nearby make an otherwise-clean permit
        # a simultaneous-operations problem.
        proximate_hazards=[
            ProximateHazard(zone_id=h["zone_id"], distance_m=h["distance_m"],
                            gas_lel=h["gas_lel"], rising=h["rising"])
            for h in plant.proximate_hazards(body.zone_id)
        ],
    )
    decision = evaluate_permit(
        PermitRequest(body.permit_type, zone=body.zone_id, machine_id=body.machine_id),
        cond,
        compound_risk=s["risk"] if body.use_ai_risk else None,
        lead_time_min=s["lead_time_min"] if body.use_ai_risk else None,
    )
    res = S.PermitDecisionResponse(**decision.as_dict())
    try:
        from sentinel.ibmz.hardware import ledger
        ledger.seal_event(
            event_type=f"PERMIT_{decision.decision}",
            zone_id=body.zone_id,
            risk_score=float(s.get("risk", 0.0)),
            interlock_status=decision.decision,
            details={"permit_type": body.permit_type, "reasons": decision.reasons, "machine_id": body.machine_id},
        )
    except Exception:
        pass
    return res


# --------------------------------------------------------------- compliance
_PROV_OFFICIAL = {"STATUTE", "OFFICIAL"}


@api.post("/compliance/ask", response_model=S.ComplianceResponse, tags=["compliance"])
def ask(body: S.ComplianceQuery) -> S.ComplianceResponse:
    _require_ready()
    from sentinel.rag.assistant import ComplianceAssistant
    ans = ComplianceAssistant(store=plant.store).ask(body.question, k=body.top_k)
    return S.ComplianceResponse(
        question=ans.question, answer=ans.answer, backend=ans.backend,
        grounded=ans.grounded,
        citations=[S.Citation(
            standard=c.standard, section=c.section, provenance=c.provenance,
            is_official=c.provenance in _PROV_OFFICIAL, score=round(c.score, 4),
        ) for c in ans.chunks],
    )


# ----------------------------------------------------------------- workflow
@api.post("/workflow/run/{zone_id}", response_model=S.WorkflowResponse, tags=["workflow"])
def run_workflow(zone_id: str) -> S.WorkflowResponse:
    """Execute the multi-agent safety workflow against a zone's live state."""
    _require_ready()
    try:
        s = plant.zone_state(zone_id)
    except KeyError:
        raise HTTPException(404, f"unknown zone '{zone_id}'")

    from sentinel.agents.graph import run_safety_workflow
    drivers = "; ".join(d["label"] for d in s["drivers"][:4]) or "n/a"
    result = run_safety_workflow({
        "zone": s["name"], "machine_id": zone_id, "risk": s["risk"],
        "lead_time_min": s["lead_time_min"] or 0,
        "anomaly_score": s["anomaly_score"], "explanation": drivers,
        "gas_lel": s["gas_lel"], "gas_trend": s["gas_trend"],
        "maintenance_active": s["maintenance_active"],
        "hot_work_active": s["hot_work_active"],
        "workers_in_zone": s["workers_in_zone"],
        "night_shift": s["night_shift"], "in_changeover": s["in_changeover"],
    })

    comp = result.get("compliance")
    comp_model = None
    if comp:
        comp_model = S.ComplianceResponse(
            question=comp.get("question", ""), answer=comp.get("answer", ""),
            backend=comp.get("backend", "none"), grounded=comp.get("grounded", False),
            citations=[],
        )
    pdec = result.get("permit_decision")
    return S.WorkflowResponse(
        zone_id=zone_id,
        trace=result.get("trace", []),
        priority=(result.get("priority") or {}).get("priority"),
        permit_decision=S.PermitDecisionResponse(**pdec) if pdec else None,
        interlocks=result.get("interlocks", []),
        compliance=comp_model,
        actions=result.get("actions", []),
        report=result.get("report"),
    )


# ---------------------------------------------------------------- simulation
@api.post("/simulate", response_model=list[S.SimulationResult], tags=["plant"])
def simulate_all(body: S.SimulationRequest) -> list[S.SimulationResult]:
    """Re-score every zone under what-if overrides, using the trained forecaster.

    The counterfactual runs through the same feature pipeline and the same
    LightGBM model as live scoring, so the number an operator sees here is the
    model's actual opinion rather than a proxy formula.
    """
    _require_ready()
    return [S.SimulationResult(**r) for r in plant.simulate_all(**body.model_dump())]


@api.post("/simulate/{zone_id}", response_model=S.SimulationResult, tags=["plant"])
def simulate_zone(zone_id: str, body: S.SimulationRequest) -> S.SimulationResult:
    _require_ready()
    try:
        return S.SimulationResult(**plant.simulate(zone_id, **body.model_dump()))
    except KeyError:
        raise HTTPException(404, f"unknown zone '{zone_id}'")


# ------------------------------------------------------------------ analytics
def _scoreboard_dict() -> dict | None:
    path = ROOT / "reports" / "scoreboard.json"
    return json.loads(path.read_text()) if path.exists() else None


@api.get("/analytics/kpis", tags=["analytics"])
def analytics_kpis() -> dict:
    """Headline KPIs tagged leading vs lagging (3:1 ratio is the target)."""
    _require_ready()
    from sentinel.analytics.indicators import kpi_summary
    return kpi_summary(plant.zone_states(), _scoreboard_dict())


@api.get("/analytics/tiers", tags=["analytics"])
def analytics_tiers() -> dict:
    """Current conditions classified into the API RP 754 tier structure."""
    _require_ready()
    from sentinel.analytics.indicators import tier_events
    return tier_events(plant.zone_states(), _scoreboard_dict())


@api.get("/analytics/alarm-performance", tags=["analytics"])
def analytics_alarms() -> dict:
    """Alarm load benchmarked against EEMUA 191 / ISA-18.2."""
    from sentinel.analytics.indicators import alarm_performance
    return alarm_performance(_scoreboard_dict())


@api.get("/analytics/risk-distribution", tags=["analytics"])
def analytics_distribution() -> dict:
    _require_ready()
    from sentinel.analytics.indicators import risk_distribution
    return risk_distribution(plant.zone_states())


@api.get("/analytics/trend", tags=["analytics"])
def analytics_trend(window: int = Query(120, ge=20, le=240)) -> list[dict]:
    _require_ready()
    from sentinel.analytics.indicators import risk_trend
    series = {z.zone_id: z.proba for z in plant.zones}
    return risk_trend(series, plant.minute, window)


@api.get("/analytics/contributing-factors", tags=["analytics"])
def analytics_factors(top: int = Query(10, ge=3, le=20)) -> list[dict]:
    _require_ready()
    from sentinel.analytics.indicators import contributing_factors
    return contributing_factors(plant.model, top=top)


# ------------------------------------------------------------ knowledge graph
def _graph():
    """Rebuilt per request — the graph reflects live permit and staffing state."""
    from sentinel.graph.builder import build_graph
    return build_graph(plant.zone_states())


@api.get("/graph", tags=["graph"])
def graph_snapshot() -> dict:
    """Full equipment / permit / hazard / regulation graph for the current instant."""
    _require_ready()
    return _graph().to_dict()


@api.get("/graph/blast-radius/{zone_id}", tags=["graph"])
def blast_radius(zone_id: str, max_hops: int = Query(2, ge=1, le=4)) -> dict:
    """Which connected zones are endangered by a release here, and who is in them.

    A per-zone view cannot answer this: gas travels along shared headers, so exposure
    is the reachable set, not the zone.
    """
    _require_ready()
    g = _graph()
    if zone_id not in g.nodes:
        raise HTTPException(404, f"unknown zone '{zone_id}'")
    return g.blast_radius(zone_id, max_hops=max_hops)


@api.get("/graph/permits-to-suspend/{zone_id}", tags=["graph"])
def permits_to_suspend(zone_id: str, max_hops: int = Query(2, ge=1, le=4)) -> list[dict]:
    """Every permit needing review if this zone goes critical, including adjacent zones."""
    _require_ready()
    g = _graph()
    if zone_id not in g.nodes:
        raise HTTPException(404, f"unknown zone '{zone_id}'")
    return g.permits_to_suspend(zone_id, max_hops=max_hops)


@api.get("/graph/path/{source}/{target}", tags=["graph"])
def graph_path(source: str, target: str) -> dict:
    """Shortest relationship path — shows *why* two entities are connected."""
    _require_ready()
    path = _graph().explain_path(source, target)
    if path is None:
        raise HTTPException(404, "no path between those nodes")
    return {"source": source, "target": target, "hops": len(path), "path": path}


# ------------------------------------------------------- incident intelligence
_INCIDENT_CACHE: dict = {}


def _incident_corpus():
    """Build (once) the incident / near-miss corpus and mined patterns."""
    if "records" not in _INCIDENT_CACHE:
        from sentinel.incidents.patterns import mine_patterns, prevention_priorities
        from sentinel.incidents.records import build_incident_corpus
        from sentinel.sim.simulator import generate_dataset
        raw = generate_dataset(600, seed=C.GLOBAL_SEED)
        records = build_incident_corpus(raw)
        mined = mine_patterns(records)
        _INCIDENT_CACHE["records"] = records
        _INCIDENT_CACHE["mined"] = mined
        _INCIDENT_CACHE["priorities"] = prevention_priorities(mined)
    return _INCIDENT_CACHE


@api.get("/incidents/patterns", tags=["incidents"])
def incident_patterns() -> dict:
    """Recurring precursor patterns mined across the incident and near-miss corpus."""
    return _incident_corpus()["mined"]


@api.get("/incidents/priorities", tags=["incidents"])
def incident_priorities() -> list[dict]:
    """Highest-lift patterns translated into ranked prevention actions."""
    return _incident_corpus()["priorities"]


@api.get("/incidents/records", tags=["incidents"])
def incident_records(outcome: str | None = Query(None, pattern="^(INCIDENT|NEAR_MISS)$"),
                     limit: int = Query(40, ge=1, le=200)) -> list[dict]:
    recs = _incident_corpus()["records"]
    if outcome:
        recs = [r for r in recs if r.outcome == outcome]
    return [r.as_dict() for r in recs[:limit]]


# ---------------------------------------------------------------- evaluation
@api.get("/evaluation/scoreboard", response_model=S.ScoreboardResponse, tags=["evaluation"])
def scoreboard() -> S.ScoreboardResponse:
    """The baseline-vs-compound evidence produced by scripts/run_pipeline.py."""
    path = ROOT / "reports" / "scoreboard.json"
    legacy = ROOT / "reports" / "row_metrics.json"
    if not path.exists():
        raise HTTPException(
            404, "no scoreboard.json — run scripts/run_pipeline.py to generate it"
            + (" (row_metrics.json found, but it is a different report)" if legacy.exists() else "")
        )
    return S.ScoreboardResponse(**json.loads(path.read_text()))


# ---------------------------------------------------------------- IBM Z Native
@api.get("/ibmz/hardware", tags=["ibmz"])
def ibmz_hardware() -> dict:
    """Inspects native IBM Z / LinuxONE hardware features (CPACF, NNPA, Vector Facility)."""
    from sentinel.ibmz.hardware import get_ibmz_hardware_info
    return get_ibmz_hardware_info()


@api.get("/ibmz/ledger", tags=["ibmz"])
def ibmz_ledger(limit: int = Query(20, ge=1, le=100)) -> list[dict]:
    """Returns tamper-evident regulatory safety blocks sealed via s390x hardware CPACF."""
    from sentinel.ibmz.hardware import ledger
    return ledger.get_recent_blocks(limit=limit)


app.include_router(api)


@app.exception_handler(HTTPException)
async def problem_detail(request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"type": f"https://sentinel.ai/errors/{exc.status_code}",
                 "title": exc.detail, "status": exc.status_code,
                 "instance": str(request.url.path)},
    )


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"service": "SentinelAI", "version": __version__, "docs": "/docs"}
