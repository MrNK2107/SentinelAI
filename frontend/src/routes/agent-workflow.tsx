import { createFileRoute } from "@tanstack/react-router";
import { Panel, Chip } from "@/components/panel";
import { ErrorState, Loading, QueryBoundary } from "@/components/data-state";
import { priorityTone, useRunWorkflow, useZones } from "@/lib/queries";
import type { PermitStatus } from "@/lib/api-types";
import { motion } from "framer-motion";
import { FileText, Play } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/agent-workflow")({
  head: () => ({
    meta: [
      { title: "Agent Workflow · SentinelAI" },
      {
        name: "description",
        content:
          "Live view of the multi-agent orchestration monitoring, deciding, and acting on plant risk.",
      },
    ],
  }),
  component: AgentWorkflow,
});

const statusTone = (s: PermitStatus): "success" | "warn" | "danger" =>
  s === "APPROVED" ? "success" : s === "CONDITIONAL" ? "warn" : "danger";

/** Trace lines arrive as "[AgentName] message"; split the tag for the timeline. */
function splitTrace(line: string): { agent: string | null; message: string } {
  const m = /^\[([^\]]+)\]\s*(.*)$/s.exec(line);
  return m ? { agent: m[1], message: m[2] } : { agent: null, message: line };
}

function AgentWorkflow() {
  const zones = useZones();
  const [zoneId, setZoneId] = useState("");
  const workflow = useRunWorkflow();

  useEffect(() => {
    if (!zoneId && zones.data?.length) setZoneId(zones.data[0].zone_id);
  }, [zoneId, zones.data]);

  const run = workflow.data;

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-12">
      <Panel
        title="Agent Orchestration"
        subtitle="Runs the full agent chain against one zone's current state"
        actions={run?.priority && <Chip tone={priorityTone(run.priority)}>{run.priority}</Chip>}
        className="lg:col-span-8 min-h-[420px]"
      >
        <QueryBoundary
          query={zones}
          loadingLabel="Loading zones"
          emptyLabel="No zones reported"
          isEmpty={(z) => z.length === 0}
        >
          {(list) => (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Zone
                  </div>
                  <select
                    value={zoneId}
                    onChange={(e) => {
                      setZoneId(e.target.value);
                      workflow.reset();
                    }}
                    className="h-9 w-full rounded-md border border-border bg-background/50 px-2 text-[12px] focus:outline-none"
                  >
                    {list.map((z) => (
                      <option key={z.zone_id} value={z.zone_id}>
                        {z.zone_id} · {z.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => zoneId && workflow.mutate(zoneId)}
                  disabled={!zoneId || workflow.isPending}
                  className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
                >
                  <Play className="h-3 w-3" /> Run workflow
                </button>
              </div>

              {workflow.isPending ? (
                <Loading label="Running agent chain" />
              ) : workflow.error ? (
                <ErrorState error={workflow.error} onRetry={() => workflow.reset()} />
              ) : !run ? (
                <p className="px-1 py-6 text-[12px] text-muted-foreground">
                  Select a zone and run the workflow to see the real execution trace.
                </p>
              ) : (
                <div className="border-t border-border pt-3">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Execution trace · {run.zone_id}
                  </div>
                  <ol className="space-y-0">
                    {run.trace.map((line, i) => {
                      const { agent, message } = splitTrace(line);
                      return (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="relative flex gap-3 pb-3 pl-1 last:pb-0"
                        >
                          <div className="flex flex-col items-center">
                            <span className="mono grid h-6 w-6 shrink-0 place-items-center rounded-md border border-primary/40 bg-primary/10 text-[10px] text-primary">
                              {i + 1}
                            </span>
                            {i < run.trace.length - 1 && (
                              <span className="mt-1 w-px flex-1 bg-border" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 rounded-md border border-border bg-background/40 px-3 py-2">
                            {agent && <div className="mono text-[11px] text-primary">{agent}</div>}
                            <div className="mt-0.5 text-[12px] leading-relaxed whitespace-pre-line">
                              {message}
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          )}
        </QueryBoundary>
      </Panel>

      <div className="space-y-3 lg:col-span-4">
        <Panel
          title="Permit Decision"
          actions={
            run?.permit_decision && (
              <Chip tone={statusTone(run.permit_decision.status)}>
                {run.permit_decision.status}
              </Chip>
            )
          }
        >
          {run?.permit_decision ? (
            <div className="space-y-2 text-[12px]">
              <ol className="list-decimal space-y-1 pl-4 leading-relaxed">
                {run.permit_decision.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
              {run.permit_decision.citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {run.permit_decision.citations.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-0.5 text-[11px]"
                    >
                      <FileText className="h-3 w-3 text-primary" />
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              {run ? "No permit was evaluated in this run." : "Run the workflow to populate."}
            </p>
          )}
        </Panel>

        <Panel
          title="Interlocks"
          subtitle={run ? `${run.interlocks.length} tripped` : undefined}
          padded={false}
        >
          {run && run.interlocks.length > 0 ? (
            <ul className="divide-y divide-border text-[12px]">
              {run.interlocks.map((i) => (
                <li key={i} className="flex gap-2 px-4 py-2.5 leading-relaxed text-destructive">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive pulse-dot" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-[12px] text-muted-foreground">
              {run ? "No standing interlocks tripped." : "Run the workflow to populate."}
            </p>
          )}
        </Panel>

        <Panel
          title="Actions"
          subtitle={run ? `${run.actions.length} initiated` : undefined}
          padded={false}
        >
          {run && run.actions.length > 0 ? (
            <ol className="divide-y divide-border text-[12px]">
              {run.actions.map((a, i) => (
                <li key={a} className="flex gap-2 px-4 py-2.5 leading-relaxed">
                  <span className="mono shrink-0 text-[10px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-4 py-6 text-[12px] text-muted-foreground">
              {run ? "No actions initiated." : "Run the workflow to populate."}
            </p>
          )}
        </Panel>
      </div>

      {run?.compliance && (
        <Panel
          title="Compliance Check"
          subtitle={run.compliance.question}
          actions={
            <>
              <Chip tone="info">{run.compliance.backend}</Chip>
              <Chip tone={run.compliance.grounded ? "success" : "warn"}>
                {run.compliance.grounded ? "Grounded" : "Ungrounded"}
              </Chip>
            </>
          }
          className="lg:col-span-7"
        >
          <div
            className={`rounded-md border p-3 text-[12px] leading-relaxed whitespace-pre-line ${
              run.compliance.grounded
                ? "border-border bg-background/40"
                : "border-warning/40 bg-warning/10"
            }`}
          >
            {run.compliance.answer}
          </div>
          {run.compliance.citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {run.compliance.citations.map((c) => (
                <span
                  key={`${c.standard}-${c.section}`}
                  className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-0.5 text-[11px]"
                >
                  <FileText className="h-3 w-3 text-primary" />
                  {c.standard} § {c.section}
                  <span className="mono text-[10px] text-muted-foreground">
                    {c.score.toFixed(4)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </Panel>
      )}

      {run?.report && (
        <Panel
          title="Draft Regulatory Notification"
          subtitle="Pending human verification"
          className="lg:col-span-5"
        >
          <pre className="mono whitespace-pre-wrap rounded-md border border-border bg-background/40 p-3 text-[11px] leading-relaxed">
            {run.report}
          </pre>
        </Panel>
      )}
    </div>
  );
}
