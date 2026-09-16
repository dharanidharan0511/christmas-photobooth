/**
 * ProjectViewNav
 * ──────────────
 * Single-row secondary header for CodeFlo+ project views:
 *   ← Projects · repo-name  GitHub     [KANBAN] REVIEW  CODE
 *
 * Breadcrumb stays left; tabs are truly centered in the bar (not a second row).
 * Active tab = solid filled accent pill.
 */
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, GitBranch } from "lucide-react";
import { getCodeRepo } from "../../lib/engineClient";
import { repoTypeLabel } from "../../lib/code-repos";
import { cn } from "../../lib/utils";

export type ProjectTab = "kanban" | "review" | "code";

interface ProjectViewNavProps {
  repoId: string;
  activeTab: ProjectTab;
  right?: React.ReactNode;
}

const TABS: { id: ProjectTab; label: string }[] = [
  { id: "kanban", label: "Kanban" },
  { id: "review", label: "Review" },
  { id: "code",   label: "Code"   },
];

export function ProjectViewNav({ repoId, activeTab, right }: ProjectViewNavProps) {
  const navigate = useNavigate();

  const repoQuery = useQuery({
    queryKey: ["code-repo", repoId],
    queryFn: ({ signal }) => getCodeRepo(repoId, signal),
    staleTime: 60_000,
  });

  const repo     = repoQuery.data;
  const repoName = repo?.name ?? repoId;
  const srcLabel = repo?.repoType ? repoTypeLabel(repo.repoType) : null;

  return (
    <div className="relative flex h-11 shrink-0 items-center border-b border-line bg-bg px-4">

      {/* Left: breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => navigate("/code-repos")}
          className="flex shrink-0 items-center gap-0.5 text-accent transition-colors hover:text-accent/80"
        >
          <ChevronLeft size={13} strokeWidth={2.5} />
          <span className="font-medium">Projects</span>
        </button>

        <span className="shrink-0 text-faint">·</span>

        <span className="max-w-[160px] truncate font-semibold text-ink">
          {repoName}
        </span>

        {srcLabel && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-mid">
            <GitBranch size={11} strokeWidth={1.75} />
            {srcLabel}
          </span>
        )}
      </div>

      {/* Center: tabs — absolute so they sit in the true middle of the header */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto flex items-center gap-0.5">
          {TABS.map(({ id, label }) => (
            <Link
              key={id}
              to={`/code-repos/${repoId}/${id}`}
              className={cn(
                "rounded-sm px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors",
                activeTab === id
                  ? "bg-accent text-on-accent"
                  : "text-mid hover:bg-surface-hover hover:text-ink",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Right: optional slot (keeps left/right balance for true centering) */}
      <div className="flex flex-1 items-center justify-end">
        {right}
      </div>
    </div>
  );
}
