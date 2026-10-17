/**
 * React Query hooks over the SentinelAI API.
 *
 * The backend holds a precomputed 240-minute episode per zone and exposes a
 * clock pointer into it. Live-looking pages poll `LIVE_MS`; anything derived
 * from the clock is invalidated together so the whole console stays coherent.
 */
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { api } from "./api";
import type {
  AlertItem,
  ClockResponse,
  HealthResponse,
  ProximateHazard,
  ScoreboardResponse,
  SimulationRequest,
  SiteGeoResponse,
  VisionResponse,
  ZoneReading,
  ZoneState,
} from "./api-types";

/**
 * Poll interval for zone/alert telemetry.
 *
 * The backend clock advances a plant minute per second, so polling every two
 * seconds keeps the console moving visibly without the numbers jumping in large
 * steps. `/zones` costs ~15ms server-side even with SHAP, so this is cheap.
 */
export const LIVE_MS = 2000;

/** The clock is a tiny read and drives every "now" label, so it polls faster. */
export const CLOCK_MS = 1000;

export const qk = {
  health: ["health"] as const,
  zones: ["zones"] as const,
  zone: (id: string) => ["zone", id] as const,
  zoneHistory: (id: string, w: number) => ["zone-history", id, w] as const,
  alerts: ["alerts"] as const,
  clock: ["clock"] as const,
  scoreboard: ["scoreboard"] as const,
  workflow: (id: string) => ["workflow", id] as const,
  siteGeo: ["site-geo"] as const,
  proximity: (id: string, r: number) => ["proximity", id, r] as const,
  vision: ["vision"] as const,
  graph: ["graph"] as const,
  blastRadius: (id: string, hops: number) => ["blast-radius", id, hops] as const,
  permitsToSuspend: (id: string, hops: number) => ["permits-to-suspend", id, hops] as const,
  patterns: ["patterns"] as const,
  priorities: ["priorities"] as const,
  incidentRecords: (outcome?: string, limit?: number) => ["incident-records", outcome, limit] as const,
  kpis: ["kpis"] as const,
  tiers: ["tiers"] as const,
};

type Opts<T> = Omit<UseQueryOptions<T, Error, T>, "queryKey" | "queryFn">;

export function useHealth(opts?: Opts<HealthResponse>) {
  return useQuery({
    queryKey: qk.health,
    queryFn: api.health,
    refetchInterval: 15000,
    ...opts,
  });
}

export function useZones(opts?: Opts<ZoneState[]>) {
  return useQuery({
    queryKey: qk.zones,
    queryFn: api.zones,
    refetchInterval: LIVE_MS,
    ...opts,
  });
}

export function useZone(zoneId: string | undefined, opts?: Opts<ZoneState>) {
  return useQuery({
    queryKey: qk.zone(zoneId ?? ""),
    queryFn: () => api.zone(zoneId as string),
    enabled: Boolean(zoneId),
    refetchInterval: LIVE_MS,
    ...opts,
  });
}

export function useZoneHistory(
  zoneId: string | undefined,
  window = 90,
  opts?: Opts<ZoneReading[]>,
) {
  return useQuery({
    queryKey: qk.zoneHistory(zoneId ?? "", window),
    queryFn: () => api.zoneHistory(zoneId as string, window),
    enabled: Boolean(zoneId),
    refetchInterval: LIVE_MS,
    ...opts,
  });
}

export function useAlerts(opts?: Opts<AlertItem[]>) {
  return useQuery({
    queryKey: qk.alerts,
    queryFn: api.alerts,
    refetchInterval: LIVE_MS,
    ...opts,
  });
}

export function useClock(opts?: Opts<ClockResponse>) {
  return useQuery({
    queryKey: qk.clock,
    queryFn: api.clock,
    refetchInterval: CLOCK_MS,
    ...opts,
  });
}

/** Site boundary + provenance. Static for the process lifetime. */
export function useSiteGeo(opts?: Opts<SiteGeoResponse>) {
  return useQuery({
    queryKey: qk.siteGeo,
    queryFn: api.siteGeo,
    staleTime: Infinity,
    ...opts,
  });
}

/** Neighbouring zones venting within a real radius. Clock-dependent. */
export function useProximity(
  zoneId: string | undefined,
  radiusM?: number,
  opts?: Opts<ProximateHazard[]>,
) {
  return useQuery({
    queryKey: qk.proximity(zoneId ?? "", radiusM ?? 0),
    queryFn: () => api.proximity(zoneId as string, radiusM),
    enabled: Boolean(zoneId),
    refetchInterval: LIVE_MS,
    ...opts,
  });
}

/** Detector output. Frames are analysed once at startup, so this is static. */
export function useVision(opts?: Opts<VisionResponse>) {
  return useQuery({
    queryKey: qk.vision,
    queryFn: api.vision,
    staleTime: Infinity,
    retry: false,
    ...opts,
  });
}

export function useScoreboard(opts?: Opts<ScoreboardResponse>) {
  return useQuery({
    queryKey: qk.scoreboard,
    queryFn: api.scoreboard,
    staleTime: Infinity, // produced offline by scripts/run_pipeline.py
    retry: false,
    ...opts,
  });
}

/** Everything downstream of the plant clock. */
function useInvalidateClockDependents() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.clock });
    qc.invalidateQueries({ queryKey: qk.zones });
    qc.invalidateQueries({ queryKey: qk.alerts });
    qc.invalidateQueries({ queryKey: ["zone"] });
    qc.invalidateQueries({ queryKey: ["zone-history"] });
  };
}

export function useTick() {
  const invalidate = useInvalidateClockDependents();
  return useMutation({
    mutationFn: (steps: number = 1) => api.tick(steps),
    onSuccess: invalidate,
  });
}

export function useSetClock() {
  const invalidate = useInvalidateClockDependents();
  return useMutation({
    mutationFn: (minute: number) => api.setClock(minute),
    onSuccess: invalidate,
  });
}

/**
 * What-if scoring. Debounced by the caller: every change re-runs the real
 * LightGBM forecaster server-side, so this is a request, not a local formula.
 */
export function useSimulation(body: SimulationRequest, enabled = true) {
  return useQuery({
    queryKey: ["simulate", body],
    queryFn: () => api.simulate(body),
    enabled,
    placeholderData: (prev) => prev, // keep the last result while re-scoring
    staleTime: 30_000,
  });
}

export function useEvaluatePermit() {
  return useMutation({ mutationFn: api.evaluatePermit });
}

export function useAskCompliance() {
  return useMutation({
    mutationFn: ({ question, topK }: { question: string; topK?: number }) =>
      api.ask(question, topK),
  });
}

export function useRunWorkflow() {
  return useMutation({ mutationFn: (zoneId: string) => api.runWorkflow(zoneId) });
}

export function useGraph() {
  return useQuery({
    queryKey: qk.graph,
    queryFn: api.graph,
    refetchInterval: LIVE_MS,
  });
}

export function useBlastRadius(zoneId: string, maxHops = 2) {
  return useQuery({
    queryKey: qk.blastRadius(zoneId, maxHops),
    queryFn: () => api.blastRadius(zoneId, maxHops),
    enabled: Boolean(zoneId),
    refetchInterval: LIVE_MS,
  });
}

export function usePermitsToSuspend(zoneId: string, maxHops = 2) {
  return useQuery({
    queryKey: qk.permitsToSuspend(zoneId, maxHops),
    queryFn: () => api.permitsToSuspend(zoneId, maxHops),
    enabled: Boolean(zoneId),
    refetchInterval: LIVE_MS,
  });
}

export function useIncidentPatterns() {
  return useQuery({
    queryKey: qk.patterns,
    queryFn: api.patterns,
    staleTime: 60000,
  });
}

export function useIncidentPriorities() {
  return useQuery({
    queryKey: qk.priorities,
    queryFn: api.priorities,
    staleTime: 60000,
  });
}

export function useIncidentRecords(outcome?: "INCIDENT" | "NEAR_MISS", limit = 40) {
  return useQuery({
    queryKey: qk.incidentRecords(outcome, limit),
    queryFn: () => api.incidentRecords(outcome, limit),
    staleTime: 60000,
  });
}

export function useAnalyticsKpis() {
  return useQuery({
    queryKey: qk.kpis,
    queryFn: api.kpis,
    refetchInterval: LIVE_MS,
  });
}

export function useAnalyticsTiers() {
  return useQuery({
    queryKey: qk.tiers,
    queryFn: api.tiers,
    refetchInterval: LIVE_MS,
  });
}

// ------------------------------------------------------------------ helpers

/** Backend risk is 0-1; the console shows whole percentages. */
export const riskPct = (risk: number) => Math.round(risk * 100);

export const bandTone = (band: string): "success" | "warn" | "danger" | "muted" =>
  band === "CRITICAL" || band === "HIGH"
    ? band === "CRITICAL"
      ? "danger"
      : "warn"
    : band === "MEDIUM"
      ? "warn"
      : "success";

export const priorityTone = (p: string): "success" | "warn" | "danger" | "muted" =>
  p === "CRITICAL" ? "danger" : p === "HIGH" ? "warn" : p === "MEDIUM" ? "warn" : "muted";

/**
 * Episode minutes are presented as a shift clock starting at 08:00, so the
 * console reads like a working shift rather than an array index.
 */
export const SHIFT_START_HOUR = 8;

export function asShiftTime(minute: number) {
  const total = SHIFT_START_HOUR * 60 + minute;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
