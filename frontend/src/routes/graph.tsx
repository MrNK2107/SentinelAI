import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, Chip } from "@/components/panel";
import { QueryBoundary } from "@/components/data-state";
import {
  useGraph,
  useBlastRadius,
  usePermitsToSuspend,
  useZones,
  riskPct,
  bandTone,
} from "@/lib/queries";
import { api } from "@/lib/api";
import {
  Network,
  Users,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  GitBranch,
  Layers,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Knowledge Graph · SentinelAI" },
      {
        name: "description",
        content: "Equipment, permits, hazards and regulations as a connected model to trace blast radius and multi-hop reachability.",
      },
    ],
  }),
  component: KnowledgeGraphRoute,
});

const KIND_COLORS: Record<string, string> = {
  Plant: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  Zone: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  Sensor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Permit: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Hazard: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  Worker: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Regulation: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

function KnowledgeGraphRoute() {
  const { data: zones } = useZones();
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [pathSource, setPathSource] = useState<string>("COB-B");
  const [pathTarget, setPathTarget] = useState<string>("PWR-1");
  const [tracedPath, setTracedPath] = useState<{ source: string; target: string; hops: number; path: string[] } | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);

  const activeZoneId =
    selectedZone ||
    zones?.find((z) => z.risk >= 0.5)?.zone_id ||
    zones?.[0]?.zone_id ||
    "COB-B";

  const { data: graphSnapshot, isLoading: graphLoading } = useGraph();
  const { data: radius, isLoading: radiusLoading } = useBlastRadius(activeZoneId, 2);
  const { data: permitsToSuspend } = usePermitsToSuspend(activeZoneId, 2);

  const handleTracePath = async () => {
    if (!pathSource || !pathTarget) return;
    try {
      setPathError(null);
      const res = await api.graphPath(pathSource, pathTarget);
      setTracedPath(res);
    } catch (e: any) {
      setTracedPath(null);
      setPathError(e.message || "No reachability path found");
    }
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Equipment-Permit-Hazard Knowledge Graph
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Gas travels along shared headers and ducts — reachability analysis traces multi-hop exposure that per-zone displays miss.
          </p>
        </div>

        {/* Origin Selector */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-1.5 shadow-sm">
          <label htmlFor="trace-zone-select" className="text-xs font-medium text-muted-foreground">
            Trace release from:
          </label>
          <select
            id="trace-zone-select"
            value={activeZoneId}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="rounded border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {zones?.map((z) => (
              <option key={z.zone_id} value={z.zone_id}>
                {z.zone_id} — {z.name} ({riskPct(z.risk)}% risk)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Blast Radius Spotlight Banner */}
      {radius && (
        <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-panel to-panel p-5 shadow-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-800/80 p-2.5 text-slate-300">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Direct in {radius.origin_zone}
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {radius.origin_workers} workers
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center text-muted-foreground">
                <ArrowRight className="h-6 w-6 text-amber-500 animate-pulse" />
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/20 p-2.5 text-amber-400">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                    Total At Risk Across Connected Headers
                  </div>
                  <div className="text-2xl font-bold text-amber-300">
                    {radius.total_workers_at_risk} workers
                  </div>
                </div>
              </div>

              {radius.ignition_sources_in_radius.length > 0 && (
                <div className="flex items-center gap-3 border-l border-border/80 pl-6">
                  <div className="rounded-lg bg-rose-500/20 p-2.5 text-rose-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-rose-400">
                      Ignition Sources in Blast Radius
                    </div>
                    <div className="text-sm font-semibold text-rose-300">
                      {radius.ignition_sources_in_radius.join(", ")}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="max-w-md text-xs leading-relaxed text-muted-foreground">
              Gas does not stop at administrative zone lines. An incident in{" "}
              <span className="font-semibold text-foreground">{radius.origin_zone}</span> endangers{" "}
              <span className="font-semibold text-amber-400">{radius.total_workers_at_risk}</span> workers
              across connected gas mains, requiring immediate isolation.
            </div>
          </div>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Connected Zones Reachable Table */}
        <Panel
          title="Reachable Zones & Workers"
          subtitle="Zones sharing a gas header or common duct within 2 hops of origin"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Zone</th>
                  <th className="pb-2 font-medium">Hops</th>
                  <th className="pb-2 font-medium">Workers</th>
                  <th className="pb-2 font-medium">Hot Work</th>
                  <th className="pb-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {radius?.connected_zones && radius.connected_zones.length > 0 ? (
                  radius.connected_zones.map((cz) => (
                    <tr key={cz.zone_id} className="hover:bg-muted/30">
                      <td className="py-2.5 font-medium text-foreground">
                        {cz.zone} ({cz.zone_id})
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                          {cz.hops} {cz.hops === 1 ? "hop" : "hops"}
                        </span>
                      </td>
                      <td className="py-2.5 font-bold text-foreground">{cz.workers}</td>
                      <td className="py-2.5">
                        {cz.hot_work_active ? (
                          <Chip tone="danger">Active (Ignition)</Chip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <Chip tone={bandTone(cz.risk >= 0.7 ? "CRITICAL" : cz.risk >= 0.4 ? "HIGH" : "LOW")}>
                          {riskPct(cz.risk)}%
                        </Chip>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No reachable zones found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Permits to Suspend Panel */}
        <Panel
          title="Permits Subject to Emergency Suspension"
          subtitle="Permits inside blast radius that must be suspended under OISD-STD-105"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Permit ID</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Zone</th>
                  <th className="pb-2 font-medium">Ignition Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {permitsToSuspend && permitsToSuspend.length > 0 ? (
                  permitsToSuspend.map((p) => (
                    <tr key={p.permit_id} className="hover:bg-muted/30">
                      <td className="py-2.5 font-mono text-[11px] text-muted-foreground">
                        {p.permit_id}
                      </td>
                      <td className="py-2.5 font-medium text-foreground">{p.permit_type}</td>
                      <td className="py-2.5 text-muted-foreground">{p.zone}</td>
                      <td className="py-2.5">
                        {p.is_ignition_source ? (
                          <Chip tone="danger">Immediate Stop</Chip>
                        ) : (
                          <Chip tone="warn">Review Isolation</Chip>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No active permits requiring suspension in this radius.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Path Finder & Graph Composition */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Reachability Path Finder */}
        <Panel
          title="Explain Connection Path"
          subtitle="Shortest graph traversal explaining why two plant entities interact"
          className="lg:col-span-2"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">From:</span>
                <input
                  type="text"
                  value={pathSource}
                  onChange={(e) => setPathSource(e.target.value)}
                  placeholder="e.g. COB-B"
                  className="w-28 rounded border border-border bg-background px-2 py-1 text-xs font-mono font-medium text-foreground"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">To:</span>
                <input
                  type="text"
                  value={pathTarget}
                  onChange={(e) => setPathTarget(e.target.value)}
                  placeholder="e.g. PWR-1"
                  className="w-28 rounded border border-border bg-background px-2 py-1 text-xs font-mono font-medium text-foreground"
                />
              </div>
              <button
                onClick={handleTracePath}
                className="flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                Find Path
              </button>
            </div>

            {pathError && (
              <div className="rounded border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                {pathError}
              </div>
            )}

            {tracedPath && (
              <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-3">
                <div className="text-[11px] font-semibold text-sky-400">
                  Connected in {tracedPath.hops} {tracedPath.hops === 1 ? "hop" : "hops"}:
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {tracedPath.path.map((node, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="rounded bg-sky-500/20 px-2 py-1 font-mono text-xs font-medium text-sky-200">
                        {node}
                      </span>
                      {i < tracedPath.path.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-sky-400/60" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground mb-1">Plant Duct & Header Topology</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>• COB-A ↔ COB-B: Coke oven gas main</div>
                <div>• COB-B ↔ BYP-1: Crude gas line to by-product</div>
                <div>• BYP-1 ↔ GAS-H: Cleaned gas to holder</div>
                <div>• GAS-H ↔ PWR-1: Fuel gas to power station</div>
                <div>• GAS-H ↔ BLF-2: Fuel gas to blast furnace stoves</div>
                <div>• BLF-2 ↔ SIN-1: Shared dust extraction</div>
              </div>
            </div>
          </div>
        </Panel>

        {/* Knowledge Graph Topology Stats */}
        <Panel
          title="Graph Node Structure"
          subtitle="Live entity counts in current topology"
        >
          <div className="space-y-3">
            {graphSnapshot?.counts ? (
              Object.entries(graphSnapshot.counts).map(([kind, count]) => (
                <div
                  key={kind}
                  className="flex items-center justify-between rounded border border-border/50 bg-background/50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        kind === "Zone"
                          ? "bg-sky-400"
                          : kind === "Permit"
                          ? "bg-amber-400"
                          : kind === "Hazard"
                          ? "bg-rose-400"
                          : kind === "Regulation"
                          ? "bg-purple-400"
                          : "bg-slate-400"
                      }`}
                    />
                    <span className="font-medium text-foreground">{kind}</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">{count}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Loading graph structure…
              </div>
            )}

            <div className="pt-2 text-[11px] text-muted-foreground leading-normal">
              Nodes update live with shift rosters, open permits, and sensor streams.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
