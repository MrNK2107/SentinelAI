import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, Chip } from "@/components/panel";
import {
  useIncidentPatterns,
  useIncidentPriorities,
  useIncidentRecords,
} from "@/lib/queries";
import {
  Layers,
  Sparkles,
  AlertOctagon,
  ShieldCheck,
  TrendingUp,
  Filter,
} from "lucide-react";

export const Route = createFileRoute("/incident-patterns")({
  head: () => ({
    meta: [
      { title: "Incident Pattern Intelligence · SentinelAI" },
      {
        name: "description",
        content: "Mined precursor combinations and lift analysis across the incident and near-miss corpus.",
      },
    ],
  }),
  component: IncidentPatternsRoute,
});

function IncidentPatternsRoute() {
  const { data: summary, isLoading: summaryLoading } = useIncidentPatterns();
  const { data: priorities, isLoading: prioritiesLoading } = useIncidentPriorities();
  const [filter, setFilter] = useState<"ALL" | "INCIDENT" | "NEAR_MISS">("ALL");
  const { data: records, isLoading: recordsLoading } = useIncidentRecords(
    filter === "ALL" ? undefined : filter,
    60,
  );

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-400" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Incident Pattern Intelligence
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Association rule mining across historical incidents and near misses reveals which compound conditions produce catastrophic lift.
          </p>
        </div>
      </div>

      {/* Summary Headline Cards */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Corpus Records</span>
              <Sparkles className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{summary.n_records}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Replayed episodes with full multi-channel telemetry</p>
          </div>

          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-rose-400">
              <span className="text-xs font-medium">True Incidents</span>
              <AlertOctagon className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-400">{summary.n_incidents}</div>
            <p className="mt-1 text-[11px] text-rose-300/80">Hazard threshold breached</p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-xs font-medium">Near Misses Caught</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">{summary.n_near_misses}</div>
            <p className="mt-1 text-[11px] text-emerald-300/80">Developing hazards safely isolated in advance</p>
          </div>

          <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Base Incident Rate</span>
              <TrendingUp className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-sky-400">
              {(summary.base_incident_rate * 100).toFixed(1)}%
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Statistical reference baseline for lift calculation</p>
          </div>
        </div>
      )}

      {/* Prevention Priorities */}
      {priorities && priorities.length > 0 && (
        <Panel
          title="Targeted Prevention Interventions"
          subtitle="Highest-lift precursor patterns translated into proactive plant operating controls"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {priorities.map((p, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-lg border border-border bg-background p-3.5 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground">{p.pattern}</span>
                    <Chip tone="danger">{p.lift.toFixed(1)}× Lift</Chip>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Observed in <span className="font-semibold text-foreground">{p.occurrences}</span> episodes (
                    <span className="text-rose-400 font-semibold">{p.incidents} incidents</span>,{" "}
                    <span className="text-amber-400 font-semibold">{p.single_sensor_missed} missed by point sensor</span>)
                  </div>
                </div>

                <div className="mt-3 border-t border-border/60 pt-2.5">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                    Mitigation Controls
                  </div>
                  <ul className="space-y-1 text-xs text-foreground/90">
                    {p.actions.map((act, aIdx) => (
                      <li key={aIdx} className="flex items-start gap-1.5 text-[11px]">
                        <span className="text-sky-400 font-bold">•</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Mined Precursor Patterns Table */}
      <Panel
        title="Recurring Precursor Patterns"
        subtitle="Ranked by lift over baseline risk"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Precursor Combination</th>
                <th className="pb-2 text-right font-medium">Lift</th>
                <th className="pb-2 text-right font-medium">Confidence</th>
                <th className="pb-2 text-right font-medium">Occurrences</th>
                <th className="pb-2 text-right font-medium">Incidents</th>
                <th className="pb-2 text-right font-medium">Near Misses</th>
                <th className="pb-2 text-right font-medium">Single Sensor Missed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {summary?.patterns && summary.patterns.length > 0 ? (
                summary.patterns.map((pat, idx) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="py-2.5 font-medium text-foreground">
                      <div className="flex flex-wrap gap-1">
                        {pat.conditions.map((c, cIdx) => (
                          <span
                            key={cIdx}
                            className="rounded bg-panel border border-border px-1.5 py-0.5 text-[11px]"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-bold text-amber-400">
                      {pat.lift.toFixed(2)}×
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      {(pat.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 text-right font-mono text-muted-foreground">
                      {pat.occurrences}
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold text-rose-400">
                      {pat.incidents}
                    </td>
                    <td className="py-2.5 text-right font-mono text-emerald-400">
                      {pat.near_misses}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-amber-400">
                      {pat.single_sensor_missed}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">
                    {summaryLoading ? "Mining patterns…" : "No patterns mined."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Replayed Incident Logs */}
      <Panel
        title="Incident Corpus Telemetry"
        subtitle="Individual incident and near-miss case records"
        actions={
          <div className="flex items-center gap-1 rounded bg-background p-1 border border-border text-[11px]">
            <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1" />
            <button
              onClick={() => setFilter("ALL")}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === "ALL" ? "bg-panel font-semibold text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("INCIDENT")}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === "INCIDENT" ? "bg-rose-500/20 text-rose-300 font-semibold" : "text-muted-foreground"
              }`}
            >
              Incidents
            </button>
            <button
              onClick={() => setFilter("NEAR_MISS")}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === "NEAR_MISS" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-muted-foreground"
              }`}
            >
              Near Misses
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          {records && records.length > 0 ? (
            records.slice(0, 20).map((r) => (
              <div
                key={r.record_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-background/60 p-3 hover:bg-muted/20 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Chip tone={r.outcome === "INCIDENT" ? "danger" : "success"}>
                      {r.outcome === "INCIDENT" ? "Incident" : "Near Miss"}
                    </Chip>
                    <span className="font-semibold text-xs text-foreground">{r.zone}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      @ Minute {r.minute_of_event}
                    </span>
                    <span className="text-[11px] text-muted-foreground">({r.incident_type})</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.narrative}</p>
                </div>

                <div className="shrink-0 text-right">
                  {r.detected_by_single_sensor ? (
                    <Chip tone="info">Single Sensor Caught</Chip>
                  ) : (
                    <Chip tone="warn">Single Sensor Missed (Compound Caught)</Chip>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {recordsLoading ? "Loading records…" : "No matching records found."}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
