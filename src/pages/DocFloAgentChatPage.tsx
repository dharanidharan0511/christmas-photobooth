/**
 * DocFloAgentChatPage — /docflo/agents/:agentId
 *
 * KG-grounded agent chat shell. No DocFlo chat API in the engine docs —
 * empty sessions / messages / artefacts only; local send stays disabled.
 */
import { useNavigate, useParams } from "react-router-dom";
import { Database, MessageSquare, Send, Share2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

export function DocFloAgentChatPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-bg px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/docflo/agents")}
            className="shrink-0 text-xs text-accent transition-colors hover:text-accent/80"
          >
            ← DocFlo+ · Agents
          </button>
          <span className="text-faint">|</span>
          <span className="truncate text-sm font-semibold text-ink">
            {agentId ? `Agent · ${agentId}` : "Agent"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => navigate(`/docflo/agents/${agentId}/corpus`)}
          >
            <Database size={12} strokeWidth={1.75} />
            Manage corpus
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled title="Share requires DocFlo API">
            <Share2 size={12} strokeWidth={1.75} />
            Share
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sessions */}
        <div className="flex w-52 shrink-0 flex-col border-r border-line">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">Sessions</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" disabled title="DocFlo chat API not available">
              New
            </Button>
          </div>
          <div className="flex flex-1 items-center justify-center p-3">
            <EmptyState
              title="No sessions"
              description="Chat history will appear here once the DocFlo chat API is connected."
            />
          </div>
        </div>

        {/* Chat */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              icon={<MessageSquare size={28} strokeWidth={1.5} />}
              title="Chat not connected"
              description="Messages will stream here when DocFlo chat completions are available on this engine."
              footnote="DocFlo chat API not available yet"
            />
          </div>
          <div className="shrink-0 border-t border-line px-3 py-2">
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                disabled
                placeholder="DocFlo chat API not available…"
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint disabled:opacity-60"
              />
              <Button size="sm" className="h-9 gap-1" disabled title="DocFlo chat API not available">
                <Send size={13} strokeWidth={2} />
              </Button>
            </div>
          </div>
        </div>

        {/* Artefacts */}
        <div className="flex w-64 shrink-0 flex-col border-l border-line">
          <div className="border-b border-line px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">Artefacts</span>
          </div>
          <div className="flex flex-1 items-center justify-center p-3">
            <EmptyState
              title="No artefacts"
              description="Generated reports and exports will show here after a chat run."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
