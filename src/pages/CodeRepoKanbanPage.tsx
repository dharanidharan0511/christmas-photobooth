/**
 * CodeRepoKanbanPage — /code-repos/:repoId/kanban
 *
 * Project board shell. Progress / checkpoint APIs are not in the engine docs yet,
 * so this page never invents tasks — it shows an honest empty state until real
 * progress data can be loaded.
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, LayoutGrid, Play, X } from "lucide-react";
import { ProjectViewNav } from "../components/code-repos/ProjectViewNav";
import { getCodeRepo } from "../lib/engineClient";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { LinedPanel } from "../components/ui/LinedPanel";

const PIPELINE_STAGES = [
  { id: "analysis", title: "Code Analysis" },
  { id: "migration", title: "Code Migration" },
  { id: "refinement", title: "Code Refinement" },
] as const;

function ActivityStream({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex w-56 shrink-0 flex-col overflow-hidden border-l border-line bg-bg">
      <div className="flex items-center justify-between gap-1 border-b border-line px-2.5 py-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-mid">
          ↳ Activity Stream
        </span>
        <button type="button" onClick={onClose} className="text-faint transition-colors hover:text-ink">
          <X size={11} strokeWidth={2} />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <EmptyState
          title="No activity yet"
          description="Events will appear here once a migration run writes to the activity stream."
        />
      </div>
    </div>
  );
}

function StatsBar({ onToggleStream }: { onToggleStream: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-bg px-4 py-1.5">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto text-[11px] text-mid">
        <span className="shrink-0 font-semibold text-ink">—/— tasks</span>
        <div className="h-[3px] w-16 shrink-0 overflow-hidden rounded-full bg-line" />
        <span className="shrink-0 text-faint">No progress data</span>
        <span className="shrink-0 select-none text-faint">·</span>
        <span className="flex shrink-0 items-center gap-1 font-mono text-[10px]">
          <Clock size={9} strokeWidth={1.5} />
          progress.json · not synced
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="secondary" size="sm" className="h-7 gap-1 px-2.5 text-[11px]" onClick={onToggleStream}>
          <Activity size={11} strokeWidth={1.75} />
          Activity stream
        </Button>
        <Button size="sm" className="h-7 gap-1 px-2.5 text-[11px]" disabled title="Requires progress / execute API">
          <Play size={10} strokeWidth={2.5} className="fill-current" />
          Continue migration
        </Button>
      </div>
    </div>
  );
}

function StageColumn({ title }: { title: string }) {
  return (
    <div className="flex min-w-[220px] max-w-[280px] flex-1 flex-col gap-2.5 rounded-sm bg-bg-subtle p-3">
      {/* Column header sits outside the lined frame (reference layout) */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-[13px] font-bold text-ink">{title}</h3>
        <span className="shrink-0 rounded-md bg-surface-active px-2 py-0.5 text-[10px] font-medium text-mid">
          No checkpoints
        </span>
      </div>

      {/* Same paper fill as the column — no white inset */}
      <LinedPanel
        className="min-h-[280px] flex-1 bg-bg-subtle"
        contentClassName="flex h-full min-h-[280px] flex-col"
      >
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
          <EmptyState
            icon={<LayoutGrid size={22} strokeWidth={1.5} />}
            title="No tasks yet"
            description={
              title === "Code Refinement"
                ? "Checkpoints are created from review feedback."
                : "Checkpoints and tasks will appear here when the agent writes progress for this project."
            }
          />
        </div>
      </LinedPanel>
    </div>
  );
}

export function CodeRepoKanbanPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const [streamOpen, setStreamOpen] = useState(false);

  useQuery({
    queryKey: ["code-repo", repoId],
    queryFn: ({ signal }) => getCodeRepo(repoId!, signal),
    enabled: Boolean(repoId),
  });

  if (!repoId) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ProjectViewNav repoId={repoId} activeTab="kanban" />
      <StatsBar onToggleStream={() => setStreamOpen((v) => !v)} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-bg">
          <div className="flex items-stretch gap-5 p-5">
            {PIPELINE_STAGES.map((stage) => (
              <StageColumn key={stage.id} title={stage.title} />
            ))}
          </div>
        </div>

        {streamOpen && <ActivityStream onClose={() => setStreamOpen(false)} />}
      </div>
    </div>
  );
}
