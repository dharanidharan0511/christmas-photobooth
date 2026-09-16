/**
 * DocFloAgentsPage — /docflo/agents
 *
 * DocFlo+ agents list. Engine has no DocFlo agent CRUD API in the docs yet,
 * so this page shows an empty state — never invents sample agents.
 * The "New agent" wizard is UI-only until the create endpoint exists.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileStack, Plus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { cn } from "../lib/utils";

function NewAgentModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-line bg-surface shadow-lg">
        <div className="flex items-center gap-0 border-b border-line px-6 pb-0 pt-5">
          <h2 className="mr-6 pb-4 text-base font-semibold text-ink">New agent</h2>
          {([1, 2, 3] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={cn(
                "border-b-2 px-4 pb-3 text-xs font-semibold uppercase tracking-wider transition-colors",
                step === s
                  ? "border-accent text-accent"
                  : "border-transparent text-faint hover:text-mid",
              )}
            >
              {s === 1 ? "01 · Basics" : s === 2 ? "02 · Datasources" : "03 · Review"}
            </button>
          ))}
        </div>

        <div className="space-y-5 p-6">
          {step === 1 && (
            <>
              <p className="text-sm text-mid">
                Name the agent and pick a <strong className="text-ink">DocFlo mind</strong> from your Roles.
                Mind options will load here once the DocFlo API is available.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-mid">Agent name</label>
                <input
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
                  placeholder="e.g. Legal Contracts"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
                <p className="text-xs font-medium text-mid">No DocFlo minds to pick yet</p>
                <p className="mt-1 text-[11px] text-faint">
                  Assign a DocFlo mind via Roles, then return here when the agent API is connected.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-mid">
                Link datasources for this agent&apos;s corpus. Connectors will be available when the DocFlo API is wired.
              </p>
              <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center">
                <p className="text-xs font-medium text-mid">Datasource connect not available yet</p>
                <p className="mt-1 text-[11px] text-faint">OneDrive, Google Drive, and uploads will appear here.</p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-mid">Review before creating.</p>
              <table className="w-full overflow-hidden rounded-lg border border-line text-sm">
                <tbody>
                  {[
                    ["Agent", name.trim() || "—"],
                    ["Mind", "—"],
                    ["Datasources", "None linked"],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b border-line last:border-0">
                      <td className="w-32 px-3 py-2 text-mid">{k}</td>
                      <td className="px-3 py-2 font-medium text-ink">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="rounded-lg border border-line bg-bg-subtle px-4 py-3 text-xs text-mid">
                Create is disabled until the DocFlo agent API is available on this engine.
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className="text-sm text-mid hover:text-ink">
            Cancel
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="secondary" size="sm" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                ← Back
              </Button>
            )}
            {step < 3 ? (
              <Button size="sm" onClick={() => setStep((s) => (s + 1) as 2 | 3)}>
                Next →
              </Button>
            ) : (
              <Button size="sm" disabled title="DocFlo agent API not available">
                Create agent
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DocFloAgentsPage() {
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);

  // No DocFlo list API in engine docs — keep an empty list, never mock agents.
  const agents: never[] = [];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 pt-2">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mb-3 flex items-center gap-1 text-xs text-accent transition-colors hover:text-accent/80"
          >
            ← Workbench
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-ink">DocFlo+ · Agents</h1>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-mid">
                An agent is a <strong className="text-ink">DocFlo mind + its own datasources</strong> — each carries
                a separate corpus and knowledge graph.
              </p>
              <p className="mt-1 text-xs text-faint">
                Agents are per-user. Listing requires the DocFlo agent API on the engine.
              </p>
            </div>
            <Button lined className="shrink-0 gap-1.5" onClick={() => setWizardOpen(true)}>
              <Plus size={14} strokeWidth={2} />
              New agent
            </Button>
          </div>
        </div>

        {agents.length === 0 ? (
          <EmptyState
            icon={<FileStack size={28} strokeWidth={1.5} />}
            title="No agents yet"
            description="Create an agent once the DocFlo API is available, or wait for agents assigned through your Roles to appear here."
            footnote="DocFlo agent list API not available on this engine yet"
          />
        ) : null}

        {wizardOpen && <NewAgentModal onClose={() => setWizardOpen(false)} />}
      </div>
    </div>
  );
}
