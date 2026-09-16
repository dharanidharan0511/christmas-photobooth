/**
 * CodeRepoReviewPage — /code-repos/:repoId/review
 *
 * Review tab for agent-generated analysis reports.
 * No review/report API is documented yet — show an honest empty state, never
 * invent sample reports.
 */
import { useParams } from "react-router-dom";
import { FileSearch } from "lucide-react";
import { ProjectViewNav } from "../components/code-repos/ProjectViewNav";
import { EmptyState } from "../components/ui/EmptyState";

export function CodeRepoReviewPage() {
  const { repoId } = useParams<{ repoId: string }>();

  if (!repoId) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ProjectViewNav repoId={repoId} activeTab="review" />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: report list (empty until API exists) */}
        <div className="w-56 shrink-0 overflow-y-auto border-r border-line p-2">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
            Generated Reports
          </p>
          <p className="px-2 pt-2 text-[11px] leading-relaxed text-faint">
            Reports written by the Mind and committed to the repo will list here.
          </p>
        </div>

        {/* Right: detail */}
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <EmptyState
            icon={<FileSearch size={28} strokeWidth={1.5} />}
            title="No reports to review"
            description="When analysis or migration checkpoints produce review documents, they will show up here for approve / request-changes."
            footnote="Review API not available on this engine yet"
          />
        </div>
      </div>
    </div>
  );
}
