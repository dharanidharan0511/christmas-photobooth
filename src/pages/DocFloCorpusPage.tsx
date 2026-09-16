/**
 * DocFloCorpusPage — /docflo/agents/:agentId/corpus
 *
 * Corpus management shell (Documents / Sources / Jobs).
 * No DocFlo corpus APIs in the engine docs — empty tabs only, no invented rows.
 */
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileStack, FolderOpen, RefreshCw, Upload } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { cn } from "../lib/utils";

type CorpusTab = "documents" | "sources" | "jobs";

function DocumentsTab() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-mid">0 documents · 0 indexed</p>
        <Button size="sm" className="gap-1.5" disabled title="DocFlo corpus API not available">
          <Upload size={13} strokeWidth={2} /> Upload document
        </Button>
      </div>
      <div className="rounded-xl border border-line">
        <EmptyState
          icon={<FileStack size={24} strokeWidth={1.5} />}
          title="No documents"
          description="Uploaded and synced files will list here once the DocFlo corpus API is available."
          footnote="DocFlo corpus API not available on this engine yet"
        />
      </div>
    </div>
  );
}

function SourcesTab() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-mid">0 connected sources</p>
        <Button size="sm" variant="secondary" className="gap-1.5" disabled title="DocFlo sources API not available">
          Add source
        </Button>
      </div>
      <div className="rounded-xl border border-line">
        <EmptyState
          icon={<FolderOpen size={24} strokeWidth={1.5} />}
          title="No data sources"
          description="OneDrive, Google Drive, and other connectors will appear here when DocFlo source APIs are wired."
        />
      </div>
    </div>
  );
}

function JobsTab() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-mid">0 ingestion jobs</p>
        <Button size="sm" variant="secondary" className="gap-1.5" disabled title="DocFlo jobs API not available">
          <RefreshCw size={13} strokeWidth={2} /> Rebuild
        </Button>
      </div>
      <div className="rounded-xl border border-line">
        <EmptyState
          title="No jobs yet"
          description="Ingestion and rebuild jobs will list here after documents are imported."
        />
      </div>
    </div>
  );
}

export function DocFloCorpusPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as CorpusTab) || "documents";

  const tabs: { id: CorpusTab; label: string }[] = [
    { id: "documents", label: "Documents" },
    { id: "sources", label: "Sources" },
    { id: "jobs", label: "Jobs" },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 pt-2">
          <div className="mb-3 flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="text-accent transition-colors hover:text-accent/80"
            >
              Workbench
            </button>
            <span className="text-faint">/</span>
            <button
              type="button"
              onClick={() => navigate("/docflo/agents")}
              className="text-accent transition-colors hover:text-accent/80"
            >
              DocFlo+ · Agents
            </button>
            <span className="text-faint">/</span>
            <button
              type="button"
              onClick={() => navigate(`/docflo/agents/${agentId}`)}
              className="text-accent transition-colors hover:text-accent/80"
            >
              {agentId ?? "Agent"}
            </button>
            <span className="text-faint">/</span>
            <span className="font-medium text-ink">Corpus</span>
          </div>

          <h1 className="text-2xl font-bold text-ink">Manage corpus</h1>
          <p className="mt-1 text-sm text-mid">
            Documents, sources, and ingestion jobs for this agent.
          </p>
        </div>

        <div className="mb-5 flex gap-0 border-b border-line">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSearchParams({ tab: id })}
              className={cn(
                "px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                activeTab === id
                  ? "border-b-2 border-accent text-accent"
                  : "text-mid hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "documents" && <DocumentsTab />}
        {activeTab === "sources" && <SourcesTab />}
        {activeTab === "jobs" && <JobsTab />}
      </div>
    </div>
  );
}
