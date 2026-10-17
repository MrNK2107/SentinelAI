/**
 * Typed client for the SentinelAI backend.
 *
 * Base URL comes from VITE_API_URL so the console can point at a deployed API
 * without a rebuild. The backend returns RFC-7807-style problem details, so
 * `ApiError` carries the `title` the server sent rather than a generic message.
 */
import type {
  AlarmPerformance,
  AlertItem,
  BlastRadius,
  ClockResponse,
  ComplianceResponse,
  ContributingFactor,
  GraphSnapshot,
  HealthResponse,
  IncidentRecord,
  KpiSummary,
  PatternSummary,
  PermitDecisionResponse,
  PermitRequestBody,
  PermitToSuspend,
  PreventionPriority,
  ProximateHazard,
  RiskDistribution,
  ScoreboardResponse,
  SiteGeoResponse,
  TierSummary,
  TrendPoint,
  VisionResponse,
  SimulationRequest,
  SimulationResult,
  WorkflowResponse,
  ZoneReading,
  ZoneState,
} from "./api-types";

export const API_BASE: string =
  (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  (typeof window !== "undefined"
    ? (window.location.port === "8080"
        ? `${window.location.protocol}//${window.location.hostname}:8000`
        : "")
    : "http://127.0.0.1:8000");

const PREFIX = "/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public path?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** 503 means the service is up but not ready (no model, no corpus). */
  get isNotReady() {
    return this.status === 503;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${PREFIX}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    // Network-level failure: the API isn't reachable at all.
    throw new ApiError(0, `Cannot reach the SentinelAI API at ${API_BASE}`, path);
  }

  if (!res.ok) {
    let title = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.title) title = body.title;
      else if (body?.detail) title = body.detail;
    } catch {
      /* non-JSON error body — keep the status line */
    }
    throw new ApiError(res.status, title, path);
  }

  return (await res.json()) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const api = {
  // ---------------------------------------------------------------- system
  health: () => request<HealthResponse>("/health"),

  // ----------------------------------------------------------------- plant
  zones: () => request<ZoneState[]>("/zones"),
  zone: (zoneId: string) => request<ZoneState>(`/zones/${encodeURIComponent(zoneId)}`),
  zoneHistory: (zoneId: string, window = 90) =>
    request<ZoneReading[]>(`/zones/${encodeURIComponent(zoneId)}/history?window=${window}`),

  // ----------------------------------------------------------------- clock
  clock: () => request<ClockResponse>("/clock"),
  siteGeo: () => request<SiteGeoResponse>("/site/geo"),
  proximity: (zoneId: string, radiusM?: number) =>
    request<ProximateHazard[]>(
      `/zones/${encodeURIComponent(zoneId)}/proximity` + (radiusM ? `?radius_m=${radiusM}` : ""),
    ),
  vision: () => request<VisionResponse>("/vision"),
  tick: (steps = 1) => post<ClockResponse>(`/clock/tick?steps=${steps}`),
  setClock: (minute: number) => post<ClockResponse>(`/clock/set?minute=${minute}`),

  // ---------------------------------------------------------------- alerts
  alerts: () => request<AlertItem[]>("/alerts"),

  // --------------------------------------------------------------- permits
  evaluatePermit: (body: PermitRequestBody) =>
    post<PermitDecisionResponse>("/permits/evaluate", {
      use_ai_risk: true,
      machine_id: "",
      ...body,
    }),

  // ------------------------------------------------------------ compliance
  ask: (question: string, topK = 4) =>
    post<ComplianceResponse>("/compliance/ask", { question, top_k: topK }),

  // -------------------------------------------------------------- workflow
  runWorkflow: (zoneId: string) =>
    post<WorkflowResponse>(`/workflow/run/${encodeURIComponent(zoneId)}`),

  // ------------------------------------------------------------ simulation
  /** Re-score every zone under what-if overrides, using the trained model. */
  simulate: (body: SimulationRequest) => post<SimulationResult[]>("/simulate", body),

  // ------------------------------------------------------------ evaluation
  scoreboard: () => request<ScoreboardResponse>("/evaluation/scoreboard"),

  // ------------------------------------------------------------------ graph
  graph: () => request<GraphSnapshot>("/graph"),
  blastRadius: (zoneId: string, maxHops = 2) =>
    request<BlastRadius>(`/graph/blast-radius/${encodeURIComponent(zoneId)}?max_hops=${maxHops}`),
  permitsToSuspend: (zoneId: string, maxHops = 2) =>
    request<PermitToSuspend[]>(
      `/graph/permits-to-suspend/${encodeURIComponent(zoneId)}?max_hops=${maxHops}`,
    ),
  graphPath: (source: string, target: string) =>
    request<{ source: string; target: string; hops: number; path: string[] }>(
      `/graph/path/${encodeURIComponent(source)}/${encodeURIComponent(target)}`,
    ),

  // -------------------------------------------------------------- analytics
  kpis: () => request<KpiSummary>("/analytics/kpis"),
  tiers: () => request<TierSummary>("/analytics/tiers"),
  alarmPerformance: () => request<AlarmPerformance>("/analytics/alarm-performance"),
  riskDistribution: () => request<RiskDistribution>("/analytics/risk-distribution"),
  trend: (window = 120) => request<TrendPoint[]>(`/analytics/trend?window=${window}`),
  contributingFactors: (top = 10) =>
    request<ContributingFactor[]>(`/analytics/contributing-factors?top=${top}`),

  // ------------------------------------------------------- incident patterns
  patterns: () => request<PatternSummary>("/incidents/patterns"),
  priorities: () => request<PreventionPriority[]>("/incidents/priorities"),
  incidentRecords: (outcome?: "INCIDENT" | "NEAR_MISS", limit = 40) =>
    request<IncidentRecord[]>(
      `/incidents/records?limit=${limit}${outcome ? `&outcome=${outcome}` : ""}`,
    ),
};
