import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  Send,
  Users2,
  Wrench,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  chatCompletion,
  deleteSession,
  executeMind,
  getSessionDetail,
  listAllSessions,
  listMindsForUser,
  listMyAccess,
  listMyMinds,
  listMySessions,
  listUsers,
} from "../lib/engineClient";
import { creditErrorMessage } from "../lib/credit-errors";
import { MySpendCard } from "../components/credits/MySpendCard";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Badge, statusTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Spinner } from "../components/ui/Spinner";
import { ApiErrorState } from "../components/ui/ApiErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/Table";
import type { MindInputField, MindSummary, SessionDetail, SessionSummary } from "../types/engine";
import {
  SessionInputsForm,
  defaultSessionInputValues,
  missingRequiredSessionInputs,
  normalizeSessionInputs,
  type SessionInputValues,
} from "../components/run/SessionInputsForm";

const KEY_STORAGE = "tp-web:mind-share-key";

/* ─── Event stream — mirrors AI Studio's own Execute page (apps/web/src/
 * app/(dashboard)/execute/), scaled down for a lightweight test client: same
 * icon/color language and "summary line, click to see raw JSON" pattern
 * (mapEventType/eventTypeIcon/eventTypeColor in execute/lib/helpers.ts),
 * without porting its full grouping/nested-loop machinery — this is a test
 * harness, not the mind editor. ──────────────────────────────────────────── */

type UiEventType =
  | "execution_started"
  | "execution_completed"
  | "step_start"
  | "step_complete"
  | "step_error"
  | "output"
  | "log";

interface ParsedEvent {
  raw: string;
  type: UiEventType;
  rawType: string;
  stepId?: string;
  timestamp?: string;
  payload: Record<string, unknown>;
}

function mapEventType(rawType: string): UiEventType {
  if (/waiting_for_input/i.test(rawType)) return "execution_completed";
  if (/turn_completed/i.test(rawType)) return "output";
  if (/start/i.test(rawType) && /execution|orchestrator|codeflo\.chat\.started/i.test(rawType)) {
    return "execution_started";
  }
  if (/complete/i.test(rawType) && /execution|orchestrator/i.test(rawType)) return "execution_completed";
  if (/fail|error|timed_out|cancel/i.test(rawType) && /execution|codeflo\.chat\.error/i.test(rawType)) {
    return "step_error";
  }
  if (/^step\.started$|step_start/i.test(rawType)) return "step_start";
  if (/^step\.completed$|step_complete/i.test(rawType)) return "step_complete";
  if (/^step\.failed$|step_error/i.test(rawType)) return "step_error";
  if (/output/i.test(rawType)) return "output";
  return "log";
}

const EVENT_VISUALS: Record<UiEventType, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  execution_started: { icon: Radio, color: "text-blue-500", bg: "bg-blue-500/10", label: "Execution Started" },
  execution_completed: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", label: "Execution Completed" },
  step_start: { icon: Radio, color: "text-blue-500", bg: "bg-blue-500/10", label: "Step Started" },
  step_complete: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", label: "Step Completed" },
  step_error: { icon: XCircle, color: "text-error", bg: "bg-error/10", label: "Failed" },
  output: { icon: Zap, color: "text-accent", bg: "bg-accent/10", label: "Output" },
  log: { icon: Wrench, color: "text-mid", bg: "bg-surface-hover", label: "Event" },
};

function parseEvent(raw: string): ParsedEvent | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const rawType = String(data.event_type ?? "log");
    return {
      raw,
      type: mapEventType(rawType),
      rawType,
      stepId: typeof data.step_id === "string" ? data.step_id : undefined,
      timestamp: typeof data.timestamp === "string" ? data.timestamp : undefined,
      payload: (data.payload as Record<string, unknown>) ?? {},
    };
  } catch {
    return null;
  }
}

/** One-line summary extracted from an event's payload — the same "never
 * dump raw JSON by default" principle AI Studio's own timeline follows.
 * Raw JSON is still available, just behind an explicit click (see
 * `EventRow` below). */
function eventSummary(event: ParsedEvent): string | null {
  const p = event.payload;
  if (event.type === "step_error") {
    const err = p.error ?? p.error_type;
    if (typeof err === "string") return err;
  }
  if (typeof p.agent_reply === "string" && p.agent_reply.trim()) {
    return p.agent_reply.length > 120 ? `${p.agent_reply.slice(0, 120)}…` : p.agent_reply;
  }
  if (typeof p.operator === "string") {
    const model = typeof p.model === "string" ? ` (${p.model})` : "";
    return `${p.operator}${model}`;
  }
  return null;
}

interface ChatActivity {
  id: string;
  kind: "status" | "thinking" | "tool";
  label: string;
  detail?: string;
  status: "running" | "done" | "error";
}

interface ChatBubble {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  activities?: ChatActivity[];
  meta?: { costUsd?: number; tokens?: number; durationMs?: number };
}

function patchAssistant(
  prev: ChatBubble[],
  patch: (msg: ChatBubble) => ChatBubble,
): ChatBubble[] {
  const next = [...prev];
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i].role === "assistant") {
      next[i] = patch(next[i]);
      break;
    }
  }
  return next;
}

function upsertActivity(activities: ChatActivity[] | undefined, activity: ChatActivity): ChatActivity[] {
  const list = [...(activities ?? [])];
  const idx = list.findIndex((a) => a.id === activity.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...activity };
  } else {
    list.push(activity);
  }
  return list;
}

function toolLabel(parsed: Record<string, unknown>): string {
  const tool = String(parsed.tool ?? parsed.tool_id ?? "tool");
  const input = (parsed.input ?? parsed.args) as Record<string, unknown> | undefined;
  const summary =
    (typeof parsed.input_summary === "string" && parsed.input_summary) ||
    (typeof input?.description === "string" && input.description) ||
    (typeof input?.command === "string" && String(input.command).slice(0, 80)) ||
    (typeof input?.file_path === "string" && `read ${input.file_path}`) ||
    "";
  return summary ? `${tool} · ${summary}` : tool;
}

/** Batch OpenAI content deltas onto the last assistant bubble via rAF so
 * React re-renders once per frame instead of once per token — same pattern
 * as AI Studio's ChatExecutePage. Named lifecycle frames flush the buffer
 * first so tool chips / thinking don't land mid-glyph. */
function createChatStreamApplier(
  setMessages: Dispatch<SetStateAction<ChatBubble[]>>,
  onSessionId?: (id: string) => void,
) {
  let pending = "";
  let raf: number | null = null;

  const flush = () => {
    raf = null;
    if (!pending) return;
    const chunk = pending;
    pending = "";
    setMessages((prev) =>
      patchAssistant(prev, (msg) => ({
        ...msg,
        content: msg.content + chunk,
        streaming: true,
      })),
    );
  };

  const queueDelta = (delta: string) => {
    pending += delta;
    if (raf == null) raf = requestAnimationFrame(flush);
  };

  const flushNow = () => {
    if (raf != null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    flush();
  };

  const apply = (data: string, eventName: string | undefined) => {
    if (!data || data === "[DONE]") {
      flushNow();
      setMessages((prev) =>
        patchAssistant(prev, (msg) => ({
          ...msg,
          streaming: false,
          activities: (msg.activities ?? []).map((a) =>
            a.status === "running" ? { ...a, status: "done" as const } : a,
          ),
        })),
      );
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }

    if (eventName === "session_init" && typeof parsed.session_id === "string") {
      onSessionId?.(parsed.session_id);
      return;
    }

    // Named frames — flush token buffer first so order stays chronological.
    if (eventName) flushNow();

    if (eventName === "turn_started") {
      setMessages((prev) => patchAssistant(prev, (msg) => ({ ...msg, streaming: true })));
      return;
    }

    if (eventName === "thinking") {
      const chunk = String(parsed.chunk ?? "");
      if (!chunk) return;
      setMessages((prev) =>
        patchAssistant(prev, (msg) => {
          const existing = (msg.activities ?? []).find((a) => a.id === "thinking");
          return {
            ...msg,
            activities: upsertActivity(msg.activities, {
              id: "thinking",
              kind: "thinking",
              label: "Reasoning",
              detail: (existing?.detail ?? "") + chunk,
              status: "running",
            }),
          };
        }),
      );
      return;
    }

    if (eventName === "tool_use" || eventName === "tool_invocation") {
      const id = String(parsed.tool_use_id ?? parsed.tool ?? `tool-${Date.now()}`);
      setMessages((prev) =>
        patchAssistant(prev, (msg) => ({
          ...msg,
          activities: upsertActivity(msg.activities, {
            id,
            kind: "tool",
            label: toolLabel(parsed),
            detail:
              eventName === "tool_invocation" && typeof parsed.input_summary === "string"
                ? parsed.input_summary
                : undefined,
            status: "running",
          }),
        })),
      );
      return;
    }

    if (eventName === "tool_result") {
      const id = String(parsed.tool_use_id ?? parsed.tool ?? "");
      const failed = parsed.status === "error";
      const summary =
        (typeof parsed.output_summary === "string" && parsed.output_summary) ||
        (typeof parsed.output === "string" && parsed.output.slice(0, 120)) ||
        undefined;
      setMessages((prev) =>
        patchAssistant(prev, (msg) => {
          const existing = (msg.activities ?? []).find((a) => a.id === id);
          return {
            ...msg,
            activities: upsertActivity(msg.activities, {
              id: id || `result-${Date.now()}`,
              kind: "tool",
              label: existing?.label ?? toolLabel(parsed),
              detail: summary,
              status: failed ? "error" : "done",
            }),
          };
        }),
      );
      return;
    }

    if (eventName === "turn_cost") {
      setMessages((prev) =>
        patchAssistant(prev, (msg) => ({
          ...msg,
          meta: {
            ...msg.meta,
            costUsd: typeof parsed.turn_cost_usd === "number" ? parsed.turn_cost_usd : msg.meta?.costUsd,
            tokens: typeof parsed.turn_tokens === "number" ? parsed.turn_tokens : msg.meta?.tokens,
          },
        })),
      );
      return;
    }

    if (eventName === "turn_completed") {
      const reply = String(parsed.agent_reply ?? parsed.content ?? "");
      setMessages((prev) =>
        patchAssistant(prev, (msg) => ({
          ...msg,
          // Prefer live-streamed text; only fill from agent_reply if empty
          // so we don't jump/replace mid-stream glyphs.
          content: msg.content.trim() ? msg.content : reply || msg.content,
          streaming: false,
          activities: (msg.activities ?? []).map((a) =>
            a.status === "running" ? { ...a, status: "done" as const } : a,
          ),
          meta: {
            ...msg.meta,
            costUsd: typeof parsed.cost_usd === "number" ? parsed.cost_usd : msg.meta?.costUsd,
            tokens: typeof parsed.tokens_used === "number" ? parsed.tokens_used : msg.meta?.tokens,
            durationMs: typeof parsed.duration_ms === "number" ? parsed.duration_ms : msg.meta?.durationMs,
          },
        })),
      );
      return;
    }

    if (eventName === "error") {
      const err = String(parsed.error ?? parsed.message ?? "Chat error");
      setMessages((prev) =>
        patchAssistant(prev, (msg) => ({
          ...msg,
          content: msg.content || err,
          streaming: false,
          activities: upsertActivity(msg.activities, {
            id: "error",
            kind: "status",
            label: err,
            status: "error",
          }),
        })),
      );
      return;
    }

    // Unnamed OpenAI content deltas.
    const choice = Array.isArray(parsed.choices)
      ? (parsed.choices[0] as { delta?: { content?: string }; finish_reason?: string | null } | undefined)
      : undefined;
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta) {
      // Drop the italic tool-narration lines the engine also injects into
      // delta.content — we already render those as structured tool chips.
      if (/^\n?\*[^*]+\*\n?$/.test(delta.trim()) || /^\*[^*]+\.\.\.\*$/.test(delta.trim())) {
        return;
      }
      queueDelta(delta);
    }
    if (choice?.finish_reason === "stop" || choice?.finish_reason === "length") {
      flushNow();
      setMessages((prev) =>
        patchAssistant(prev, (msg) => ({
          ...msg,
          streaming: false,
          activities: (msg.activities ?? []).map((a) =>
            a.status === "running" ? { ...a, status: "done" as const } : a,
          ),
        })),
      );
    }
  };

  return { apply, flushNow };
}

function ActivityRow({ activity }: { activity: ChatActivity }) {
  const [open, setOpen] = useState(false);
  const Icon =
    activity.kind === "tool" ? Wrench : activity.kind === "thinking" ? Zap : Loader2;
  const tone = activity.status === "error" ? "text-error" : "text-mid";

  return (
    <div className="rounded-md border border-line/70 bg-bg/80">
      <button
        type="button"
        onClick={() => activity.detail && setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] ${tone}`}
      >
        <Icon
          size={11}
          className={`shrink-0 ${activity.status === "running" && activity.kind !== "tool" ? "animate-spin" : activity.status === "running" ? "animate-pulse" : ""}`}
        />
        <span className="min-w-0 flex-1 truncate font-medium">{activity.label}</span>
        {activity.status === "error" && <XCircle size={11} className="shrink-0 text-error" />}
        {activity.detail && (
          <ChevronRight size={11} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        )}
      </button>
      {open && activity.detail && (
        <pre className="max-h-28 overflow-auto border-t border-line/70 px-2.5 py-1.5 font-mono text-[10px] text-mid whitespace-pre-wrap">
          {activity.detail}
        </pre>
      )}
    </div>
  );
}

function ChatMessageBubble({ msg }: { msg: ChatBubble }) {
  const isUser = msg.role === "user";
  const activities = (msg.activities ?? []).filter((a) => a.kind !== "status");
  const showActivities = !isUser && activities.length > 0;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] space-y-2 ${
          isUser ? "" : "min-w-[12rem]"
        }`}
      >
        {showActivities && (
          <div className="space-y-1.5">
            {activities.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>
        )}

        {(msg.content || msg.streaming) && (
          <div
            className={`rounded-2xl px-3.5 py-2 text-sm break-words transition-[box-shadow] duration-200 ${
              isUser
                ? "bg-accent text-on-accent rounded-br-md"
                : "bg-surface border border-line text-ink rounded-bl-md shadow-sm"
            }`}
          >
            {!msg.content && msg.streaming ? (
              <span className="inline-flex items-center gap-1.5 text-mid">
                <span className="flex gap-0.5" aria-hidden>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mid [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mid [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-mid" />
                </span>
                Thinking…
              </span>
            ) : (
              <span className="whitespace-pre-wrap">
                {msg.content}
                {msg.streaming ? (
                  <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-pulse bg-current align-baseline" />
                ) : null}
              </span>
            )}
          </div>
        )}

        {!isUser && msg.meta && !msg.streaming && (msg.meta.tokens != null || msg.meta.costUsd != null) && (
          <p className="px-1 text-[10px] text-light">
            {msg.meta.tokens != null ? `${msg.meta.tokens} tokens` : null}
            {msg.meta.tokens != null && msg.meta.costUsd != null ? " · " : null}
            {msg.meta.costUsd != null ? `$${msg.meta.costUsd.toFixed(4)}` : null}
            {msg.meta.durationMs != null ? ` · ${(msg.meta.durationMs / 1000).toFixed(1)}s` : null}
          </p>
        )}
      </div>
    </div>
  );
}

/** Mirrors the engine's own `_extract_output_string` (edge_execute_routes.py)
 * byte-for-byte in intent — same heuristic, so a Mind's final answer shows
 * up here the same way it would in any other client reading these events. */
function extractOutputString(outputs: Record<string, unknown>): string {
  const top = Object.values(outputs).filter((v): v is string => typeof v === "string" && v.length > 0);
  if (top.length > 0) return top.join("\n");
  const contentKeys = ["content", "text", "response", "answer", "result", "message", "output"];
  for (const val of Object.values(outputs)) {
    if (val && typeof val === "object") {
      for (const k of contentKeys) {
        const v = (val as Record<string, unknown>)[k];
        if (typeof v === "string" && v) return v;
      }
    }
  }
  for (const val of Object.values(outputs)) {
    if (val && typeof val === "object") {
      const nested = Object.values(val as Record<string, unknown>).filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
      if (nested.length > 0) return nested.join("\n");
    }
  }
  return "";
}

function EventRow({ event }: { event: ParsedEvent }) {
  const [expanded, setExpanded] = useState(false);
  const visuals = EVENT_VISUALS[event.type];
  const Icon = visuals.icon;
  const summary = eventSummary(event);
  const isRunning = event.type === "execution_started" || event.type === "step_start";

  return (
    <div className="border-b border-line/50 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2.5 px-2 py-2 text-left transition-colors hover:bg-surface-hover/50"
      >
        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${visuals.bg}`}>
          <Icon size={12} className={`${visuals.color} ${isRunning ? "animate-pulse" : ""}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${visuals.color}`}>{visuals.label}</span>
            {event.stepId && <span className="truncate font-mono text-[10px] text-light">{event.stepId}</span>}
          </div>
          {summary && (
            <p className={`truncate text-xs ${event.type === "step_error" ? "text-error" : "text-mid"}`}>{summary}</p>
          )}
        </div>
        <span className="shrink-0 font-mono text-[10px] text-light">
          {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ""}
        </span>
        <ChevronRight size={12} className={`mt-0.5 shrink-0 text-light transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <pre className="mx-2 mb-2 max-h-48 overflow-y-auto rounded-md border border-line bg-bg p-2 font-mono text-[10px] text-mid">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

/** Prompt-like mind inputs — the chat composer supplies these. Same set as
 * Studio (`apps/web/.../chat-prompt-inputs.ts`) / gateway CHAT_PROMPT_ALIASES. */
const CHAT_PROMPT_INPUT_NAMES = new Set([
  "message",
  "user_message",
  "user_input",
  "query",
  "question",
  "prompt",
  "text",
]);

function isChatPromptInput(name: string): boolean {
  return CHAT_PROMPT_INPUT_NAMES.has(name.toLowerCase());
}

/** Declared inputs that must be collected as form fields in Chat mode
 * (everything except the prompt aliases the composer already covers). */
function chatFormFields(mind: MindSummary | null): MindInputField[] {
  return (mind?.inputs ?? []).filter((f) => !isChatPromptInput(f.name));
}

function defaultChatInputValues(mind: MindSummary): SessionInputValues {
  return defaultSessionInputValues(chatFormFields(mind));
}

/** Placeholder JSON for a Mind's real declared inputs (schema v37 addition —
 * `MindSummary.inputs`, sourced from the Mind's own `interface.inputs`) —
 * replaces the old one-size-fits-all `{"question": "Football"}` default,
 * which silently produced an empty prompt for any Mind that didn't happen
 * to use a field literally named "question". */
function defaultInputsJson(mind: MindSummary): string {
  if (mind.inputs.length === 0) return "{}";
  const obj: Record<string, string> = {};
  for (const field of mind.inputs) obj[field.name] = "";
  return JSON.stringify(obj, null, 2);
}

/* ─── Admin-only: browse another user's access. The primary "My Minds" tree
 * now lives in the global `Sidebar` (see `components/run/RunMindsNav.tsx`)
 * since it's assigned-access navigation, not page content — this stays here
 * as a small collapsible bar above the Run panel, since "impersonate a
 * different user to test their access" is an admin debugging tool, not
 * something that belongs in the primary nav everyone sees. ───────────────── */

function BrowseAsUserBar({ onPickMind }: { onPickMind: (mind: MindSummary) => void }) {
  const [open, setOpen] = useState(false);
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: ({ signal }) => listUsers(signal), enabled: open });
  const [userId, setUserId] = useState("");

  const mindsQuery = useQuery({
    queryKey: ["mindsForUser", userId],
    queryFn: ({ signal }) => listMindsForUser(userId, signal),
    enabled: Boolean(userId),
    retry: false,
  });

  return (
    <div className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-mid hover:text-ink"
      >
        <Users2 size={13} />
        Browse as user
        <ChevronDown size={13} className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-line px-3 py-3">
          <Select
            value={userId}
            onChange={setUserId}
            options={(usersQuery.data ?? []).map((u) => ({ value: u.id, label: u.email }))}
            placeholder={usersQuery.isLoading ? "Loading…" : "Pick a user"}
            ariaLabel="User to browse as"
            className="w-full max-w-xs"
            triggerClassName="w-full justify-between h-8 text-xs"
          />
          {userId && mindsQuery.isLoading && (
            <div className="flex items-center gap-2 text-xs text-mid">
              <Spinner /> Loading…
            </div>
          )}
          {userId && mindsQuery.isError && <ApiErrorState error={mindsQuery.error} onRetry={() => mindsQuery.refetch()} />}
          {userId && mindsQuery.isSuccess && mindsQuery.data.length === 0 && (
            <p className="text-xs text-mid">No access — no Role assigned, or no published Minds.</p>
          )}
          {userId && mindsQuery.isSuccess && mindsQuery.data.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mindsQuery.data.map((mind) => (
                <button
                  key={mind.id}
                  type="button"
                  onClick={() => onPickMind(mind)}
                  className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-left text-xs text-ink hover:bg-surface-hover transition-colors"
                >
                  <Play size={11} className="shrink-0 text-mid" />
                  {mind.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Session detail — a slide-over. `GET /api/v2/sessions/:id` carries the
 * summary fields plus the actual `input`/`output`/`error_message` the mind
 * ran with/produced, fetched fresh on open (the list row alone never has
 * these — kept out of the list payload to keep it small). ──── */

function JsonBlock({ value, tall = false }: { value: unknown; tall?: boolean }) {
  if (value == null) return <span className="text-mid">—</span>;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  // Output is frequently itself a JSON string (one more layer of encoding) —
  // pretty-print it too when it parses, instead of showing an escaped blob.
  let display = text;
  if (typeof value === "string") {
    try {
      display = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      display = value;
    }
  }
  return (
    <pre
      className={
        tall
          ? "max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-hover p-3 text-xs text-ink"
          : "max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-hover p-3 text-xs text-ink"
      }
    >
      {display}
    </pre>
  );
}

function SessionDetailPanel({ session, onClose }: { session: SessionSummary; onClose: () => void }) {
  const detailQuery = useQuery({
    queryKey: ["sessionDetail", session.sessionId],
    queryFn: ({ signal }) => getSessionDetail(session.sessionId, signal),
  });
  const detail: SessionDetail | undefined = detailQuery.data;

  const rows: Array<[string, React.ReactNode]> = [
    ["Session ID", <span className="font-mono text-xs break-all">{session.sessionId}</span>],
    ["Mind ID", <span className="font-mono text-xs break-all">{session.mindId}</span>],
    ["Status", <Badge tone={statusTone(session.status)}>{session.status}</Badge>],
    ["Total tokens", session.totalTokens],
    ["Cost", session.costUsd != null ? `$${session.costUsd.toFixed(4)}` : "—"],
    ["Created", session.createdAt ? new Date(session.createdAt).toLocaleString() : "—"],
    ["Updated", session.updatedAt ? new Date(session.updatedAt).toLocaleString() : "—"],
  ];
  if (session.email) rows.splice(2, 0, ["Run by", session.email]);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Session details</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-mid hover:bg-surface-hover hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
              <span className="text-mid">{label}</span>
              <span className="text-ink">{value}</span>
            </div>
          ))}

          <div className="border-t border-line pt-3" />

          {detailQuery.isLoading && (
            <div className="flex items-center gap-2 text-xs text-mid">
              <Spinner className="h-3 w-3" /> Loading output…
            </div>
          )}
          {detailQuery.isError && <ApiErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />}

          {detail && (
            <>
              {detail.errorMessage && (
                <div>
                  <p className="mb-1 text-sm font-medium text-ink">Error{detail.errorCode ? ` (${detail.errorCode})` : ""}</p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-error/10 p-3 text-xs text-error">
                    {detail.errorMessage}
                  </pre>
                </div>
              )}
              <div>
                <p className="mb-1 text-sm font-medium text-ink">Input</p>
                <JsonBlock value={detail.input} />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-ink">Output</p>
                <JsonBlock value={detail.output} tall />
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SessionsTable({
  query,
  showUser = false,
  showMind = true,
  onView,
  onDelete,
}: {
  query: ReturnType<typeof useQuery<SessionSummary[]>>;
  showUser?: boolean;
  showMind?: boolean;
  onView: (s: SessionSummary) => void;
  onDelete?: (s: SessionSummary) => void;
}) {
  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-mid">
        <Spinner /> Loading…
      </div>
    );
  }
  if (query.isError) return <ApiErrorState error={query.error} onRetry={() => query.refetch()} />;
  const sessions = query.data ?? [];
  if (sessions.length === 0) {
    return <EmptyState title="No runs yet" description="Execute or chat with a Mind above — it'll show up here." />;
  }
  return (
    <Table>
      <THead>
        <tr>
          {showUser && <TH>User</TH>}
          {showMind && <TH>Mind</TH>}
          <TH>Status</TH>
          <TH>Tokens</TH>
          <TH>Cost</TH>
          <TH>When</TH>
          <TH className="text-right">Action</TH>
        </tr>
      </THead>
      <TBody>
        {sessions.map((s) => (
          <TR key={s.sessionId}>
            {showUser && <TD>{s.email ?? "—"}</TD>}
            {showMind && <TD className="font-mono text-xs">{s.mindId}</TD>}
            <TD>
              <Badge tone={statusTone(s.status)}>{s.status}</Badge>
            </TD>
            <TD>{s.totalTokens}</TD>
            <TD>{s.costUsd != null ? `$${s.costUsd.toFixed(4)}` : "—"}</TD>
            <TD className="text-mid">{s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}</TD>
            <TD className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => onView(s)}>
                  View
                </Button>
                {onDelete && (
                  <Button variant="ghost" size="sm" onClick={() => onDelete(s)}>
                    Delete
                  </Button>
                )}
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

/* ─── Admin-only: every identity-attributed session, filterable by user. ── */

function FleetSessionsPanel({ onView }: { onView: (s: SessionSummary) => void }) {
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: ({ signal }) => listUsers(signal) });
  const [userId, setUserId] = useState("");

  const sessionsQuery = useQuery({
    queryKey: ["fleetSessions", userId],
    queryFn: ({ signal }) => listAllSessions({ userId: userId || undefined, limit: 100 }, signal),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Fleet Sessions</CardTitle>
          <CardDescription>Every identity-attributed run on this cluster, most recent first.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={userId}
            onChange={setUserId}
            options={[{ value: "", label: "All users" }, ...(usersQuery.data ?? []).map((u) => ({ value: u.id, label: u.email }))]}
            ariaLabel="Filter by user"
          />
          <Button variant="ghost" size="sm" onClick={() => sessionsQuery.refetch()}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <SessionsTable query={sessionsQuery} showUser onView={onView} />
      </CardContent>
    </Card>
  );
}

/** Proves the whole entitlement chain end to end: identity (SSO cookie) +
 * a pasted Mind Share Key -> which Minds does this grant -> run one -> see
 * it show up under this person's own history. Layout: a left sidebar of
 * every Mind the signed-in person (or, for an admin, someone they're
 * browsing as) can reach, a Run panel on the right for whichever one is
 * selected, and a Sessions section below with a proper per-session detail
 * view instead of a bare table row. */
export function RunPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isKeyOnlyMode = auth.mode === "key";
  const isAdmin = Boolean(auth.whoami?.isAdmin);
  // `KEY_STORAGE` is a single shared browser-wide slot, not scoped per signed-
  // in user — a key an admin pasted into the "Advanced" box in one session
  // would otherwise get silently picked up and sent by a completely different
  // (non-admin) person signed in later in the same browser, since this state
  // read used to run unconditionally. Only ever read/write it for an admin —
  // a non-admin's activeKey stays permanently "", so their Run always takes
  // the keyless, server-resolved path (schema v37), never a stale leftover.
  const [shareKey, setShareKey] = useState(() => (isAdmin ? localStorage.getItem(KEY_STORAGE) ?? "" : ""));
  const [activeKey, setActiveKey] = useState(() => (isAdmin ? localStorage.getItem(KEY_STORAGE) ?? "" : ""));
  const [mindId, setMindId] = useState("");
  const [pickedMind, setPickedMind] = useState<MindSummary | null>(null);
  const [tab, setTab] = useState<"execute" | "chat">("chat");
  const [inputsJson, setInputsJson] = useState('{\n  "question": "Football"\n}');
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatBubble[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatInputValues, setChatInputValues] = useState<SessionInputValues>({});
  const [events, setEvents] = useState<string[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<SessionSummary | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);

  // Defensive cleanup: a non-admin session never reads the stored key above,
  // but if one happens to be sitting in this browser's storage from an
  // earlier admin session, clear it outright rather than leaving it to
  // confuse the next person who opens the Advanced box here.
  useEffect(() => {
    if (!isAdmin && localStorage.getItem(KEY_STORAGE)) {
      localStorage.removeItem(KEY_STORAGE);
    }
  }, [isAdmin]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [events]);

  useEffect(() => {
    chatLogRef.current?.scrollTo({ top: chatLogRef.current.scrollHeight });
  }, [chatMessages]);

  const applyKey = () => {
    const trimmed = shareKey.trim();
    localStorage.setItem(KEY_STORAGE, trimmed);
    setActiveKey(trimmed);
  };

  // The sidebar's "My Minds" tree lives in the global Sidebar (a sibling
  // component, not a child of this page — see RunMindsNav) and hands off a
  // selection via `?mindId=` rather than a prop. Both it and this page query
  // the SAME `["myAccess"]` cache key, so the match below is always served
  // from cache, never a second network round trip.
  const [searchParams, setSearchParams] = useSearchParams();
  const accessQuery = useQuery({ queryKey: ["myAccess"], queryFn: ({ signal }) => listMyAccess(signal) });

  // Advanced share-key path: list minds that key alone grants (no Role SSO gate).
  const shareKeyMindsQuery = useQuery({
    queryKey: ["shareKeyMinds", activeKey],
    queryFn: ({ signal }) => listMyMinds(activeKey, signal),
    enabled: isAdmin && Boolean(activeKey.trim()),
  });

  const pickMind = (mind: MindSummary) => {
    setMindId(mind.id);
    setPickedMind(mind);
    setInputsJson(defaultInputsJson(mind));
    setChatInputValues(defaultChatInputValues(mind));
    setEvents([]);
    setChatMessages([]);
    setChatSessionId(null);
    setChatMessage("");
    setRunError(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("mindId", mind.id);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    const urlMindId = searchParams.get("mindId");
    if (!urlMindId || urlMindId === mindId) return;
    for (const grant of accessQuery.data ?? []) {
      const found = grant.minds.find((m) => m.id === urlMindId);
      if (found) {
        pickMind(found);
        return;
      }
    }
    const fromKey = (shareKeyMindsQuery.data ?? []).find((m) => m.id === urlMindId);
    if (fromKey) pickMind(fromKey);
  }, [searchParams, accessQuery.data, shareKeyMindsQuery.data, mindId]);

  // Scoped to whichever Mind is loaded in the Run panel — `mindId` in the
  // query key means switching Minds triggers a real refetch (server-side
  // filter, not a client-side slice of one fixed page), instead of always
  // showing the same global cross-Mind feed regardless of what's selected.
  const sessionsQuery = useQuery({
    queryKey: ["mySessions", mindId],
    queryFn: ({ signal }) => listMySessions(50, mindId || undefined, signal),
  });

  const deleteMutation = useMutation({
    mutationFn: (s: SessionSummary) => deleteSession(s.sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mySessions"] });
      void queryClient.invalidateQueries({ queryKey: ["fleetSessions"] });
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      setRunError(null);
      if (!mindId) throw new Error("Pick a Mind first");
      // No client-side "you must have a key" guard, deliberately (schema
      // v37): an empty activeKey is a normal, expected case for a non-admin
      // now — the engine resolves an admin-stored key server-side. If truly
      // nothing is available (no pasted key, nothing stored), the engine's
      // own missing_credentials 401 surfaces below with a real, specific
      // reason instead of a generic client-side block.
      if (tab === "execute") {
        setEvents([]);
        let inputs: Record<string, unknown>;
        try {
          inputs = JSON.parse(inputsJson || "{}");
        } catch {
          throw new Error("Input isn't valid JSON");
        }
        await executeMind(mindId, activeKey, inputs, (data) => setEvents((prev) => [...prev, data]));
      } else {
        const fields = chatFormFields(pickedMind);
        const missing = missingRequiredSessionInputs(fields, chatInputValues);
        if (missing.length > 0) {
          throw new Error(`Fill required input${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
        }
        const text = chatMessage.trim();
        if (!text) throw new Error("Type a message first");
        const userId = `u-${Date.now()}`;
        const assistantId = `a-${Date.now()}`;
        setChatMessages((prev) => [
          ...prev,
          { id: userId, role: "user", content: text },
          { id: assistantId, role: "assistant", content: "", streaming: true },
        ]);
        setChatMessage("");
        const prior = chatSessionId ?? undefined;
        const mindInputs = normalizeSessionInputs(fields, chatInputValues);
        const stream = createChatStreamApplier(setChatMessages, (id) => setChatSessionId(id));
        const minted = await chatCompletion(
          mindId,
          activeKey,
          text,
          (data, eventName) => stream.apply(data, eventName),
          {
            priorSessionId: prior,
            inputs: Object.keys(mindInputs).length > 0 ? mindInputs : undefined,
          },
        );
        stream.flushNow();
        if (minted) setChatSessionId(minted);
        setChatMessages((prev) =>
          patchAssistant(prev, (msg) => ({
            ...msg,
            streaming: false,
            activities: (msg.activities ?? []).map((a) =>
              a.status === "running" ? { ...a, status: "done" as const } : a,
            ),
          })),
        );
      }
    },
    onError: (err) => {
      setRunError(creditErrorMessage(err) ?? (err instanceof Error ? err.message : String(err)));
      setChatMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant" && next[i].streaming) {
            next[i] = {
              ...next[i],
              content:
                next[i].content ||
                (creditErrorMessage(err) ?? (err instanceof Error ? err.message : String(err))),
              streaming: false,
            };
            break;
          }
        }
        return next;
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mySessions"] });
      void queryClient.invalidateQueries({ queryKey: ["fleetSessions"] });
    },
  });

  // Parsed once per render from the raw SSE lines — `events` stays the raw
  // string array (simplest state shape for the streaming append), parsing
  // happens here so a malformed line never breaks the whole feed.
  const parsedEvents = useMemo(
    () => events.map(parseEvent).filter((e): e is ParsedEvent => e !== null),
    [events],
  );
  const isRunning = runMutation.isPending;

  const chatFields = useMemo(() => chatFormFields(pickedMind), [pickedMind]);
  const chatInputsMissing = useMemo(
    () => missingRequiredSessionInputs(chatFields, chatInputValues),
    [chatFields, chatInputValues],
  );
  const chatInputsLocked = chatMessages.length > 0 || Boolean(chatSessionId);
  const chatInputsBlockSend = chatFields.length > 0 && chatInputsMissing.length > 0;
  const hasFailed = parsedEvents.some((e) => e.type === "step_error");
  const hasCompleted = parsedEvents.some((e) => e.type === "execution_completed" || e.type === "output");
  const failureMessage = parsedEvents.find((e) => e.type === "step_error" && typeof e.payload.error === "string")
    ?.payload.error as string | undefined;
  const outputText = useMemo(() => {
    for (let i = parsedEvents.length - 1; i >= 0; i--) {
      const e = parsedEvents[i];
      if (typeof e.payload.agent_reply === "string" && e.payload.agent_reply.trim()) {
        return e.payload.agent_reply;
      }
      if (e.type === "execution_completed" && e.payload.outputs && typeof e.payload.outputs === "object") {
        const text = extractOutputString(e.payload.outputs as Record<string, unknown>);
        if (text) return text;
      }
    }
    return null;
  }, [parsedEvents]);

  if (isKeyOnlyMode) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mb-3 flex items-center gap-1 text-xs text-accent transition-colors hover:text-accent/80"
          >
            ← Workbench
          </button>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-mid">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="text-accent transition-colors hover:text-accent/80"
            >
              Workbench
            </button>
            <span className="text-faint">/</span>
            <span className="font-medium text-ink">Run Minds</span>
          </div>
          <h1 className="text-4xl font-bold text-ink">Run Minds</h1>
          <p className="mt-2 text-sm text-mid">Execute a Mind as the signed-in identity, and see your own history.</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<AlertTriangle className="mx-auto" size={28} strokeWidth={1.5} />}
              title="Sign in via SSO to run a Mind"
              description="The static admin key is a service credential for the management screens (Users/Roles/Audit) — it isn't a per-user identity, so the engine's execute endpoints can't attribute a run to it. Sign out and sign in via SSO instead."
            />
          </CardContent>
        </Card>
      </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="pt-2">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mb-3 flex items-center gap-1 text-xs text-accent transition-colors hover:text-accent/80"
        >
          ← Workbench
        </button>
        <div className="mb-1 flex items-center gap-1.5 text-xs text-mid">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-accent transition-colors hover:text-accent/80"
          >
            Workbench
          </button>
          <span className="text-faint">/</span>
          <span className="font-medium text-ink">Run Minds</span>
        </div>
        <h1 className="text-4xl font-bold text-ink">Run Minds</h1>
        <p className="mt-2 text-sm text-mid">
          Pick a Mind on the left, and run it as{" "}
          <span className="font-medium text-ink">{auth.whoami?.eml}</span> — no key to paste.
        </p>
      </div>

      {/* Minds/Mind Share Keys live in the global left sidebar now (see
       * RunMindsNav) — this whole section runs the full content width. */}
      <div className="space-y-6">
        {isAdmin && <BrowseAsUserBar onPickMind={pickMind} />}

        <MySpendCard compact />


        <Card>
          <CardHeader>
            <CardTitle>{pickedMind ? `Run: ${pickedMind.name}` : "Run"}</CardTitle>
            <CardDescription>
              {!mindId
                  ? "Pick a Mind from the sidebar to get started."
                  : isAdmin
                    ? "Runs with a Role-assigned key automatically when one's stored — the box below is only for testing a different key manually."
                    : "Runs with the key your Role grants — nothing to paste."}
              </CardDescription>
              {isAdmin && (
                <details className="mt-2 group" open={Boolean(activeKey)}>
                  <summary className="cursor-pointer text-xs font-medium text-mid hover:text-ink">
                    Advanced: run with a different key
                  </summary>
                  <div className="mt-2 space-y-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-mid">Mind Share Key</label>
                        <Input
                          placeholder="ask_..."
                          value={shareKey}
                          onChange={(e) => setShareKey(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && applyKey()}
                        />
                      </div>
                      <Button onClick={applyKey} disabled={!shareKey.trim()}>
                        Use key
                      </Button>
                      {activeKey && (
                        <Button variant="ghost" onClick={() => { setShareKey(""); setActiveKey(""); localStorage.removeItem(KEY_STORAGE); }}>
                          Clear
                        </Button>
                      )}
                    </div>

                    {activeKey && (
                      <div className="rounded-md border border-line bg-surface px-3 py-2">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-medium text-mid">
                            Minds this key grants
                          </p>
                          {shareKeyMindsQuery.isFetching && (
                            <Loader2 size={12} className="animate-spin text-faint" />
                          )}
                        </div>
                        {shareKeyMindsQuery.isError && (
                          <ApiErrorState error={shareKeyMindsQuery.error} />
                        )}
                        {shareKeyMindsQuery.isSuccess && (shareKeyMindsQuery.data?.length ?? 0) === 0 && (
                          <p className="text-xs text-mid">No minds returned for this key.</p>
                        )}
                        {shareKeyMindsQuery.isSuccess && (shareKeyMindsQuery.data?.length ?? 0) > 0 && (
                          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                            {(shareKeyMindsQuery.data ?? []).map((mind) => (
                              <li key={mind.id}>
                                <button
                                  type="button"
                                  onClick={() => pickMind(mind)}
                                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors ${
                                    mindId === mind.id
                                      ? "bg-accent/10 text-accent"
                                      : "text-ink hover:bg-surface-hover"
                                  }`}
                                >
                                  <span className="truncate font-medium">{mind.name}</span>
                                  <span className="shrink-0 font-mono text-[10px] text-faint">
                                    {mind.version}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </details>
              )}
              {mindId && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="ml-auto flex rounded-md border border-line p-0.5">
                    <button
                      type="button"
                      onClick={() => setTab("execute")}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${tab === "execute" ? "bg-surface-active text-ink" : "text-mid hover:text-ink"}`}
                    >
                      Execute
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("chat")}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${tab === "chat" ? "bg-surface-active text-ink" : "text-mid hover:text-ink"}`}
                    >
                      Chat
                    </button>
                  </div>
                </div>
              )}
            </CardHeader>
            {!mindId ? (
              <CardContent>
                <EmptyState
                  icon={<Play className="mx-auto" size={28} strokeWidth={1.5} />}
                  title="No Mind selected"
                  description="Pick one from the sidebar on the left."
                />
              </CardContent>
            ) : (
              <CardContent className="space-y-4">
                {tab === "execute" ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-mid">Inputs (JSON)</label>
                    <textarea
                      value={inputsJson}
                      onChange={(e) => setInputsJson(e.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    {pickedMind && pickedMind.inputs.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-mid">
                        {pickedMind.inputs.map((f) => (
                          <span key={f.name}>
                            <span className="font-mono text-ink">{f.name}</span>
                            {f.required && <span className="text-error">*</span>}
                            {f.description ? ` — ${f.description}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3">
                      <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending || !mindId}>
                        {runMutation.isPending ? <Spinner className="mr-1.5" /> : <Play size={14} className="mr-1.5" />}
                        Execute
                      </Button>
                    </div>
                    {runError && <p className="mt-2 text-sm text-error">{runError}</p>}

                    {hasFailed && failureMessage && (
                      <div className="mt-3 flex items-start gap-2.5 rounded-md border border-error/20 bg-error/5 px-3 py-2.5">
                        <XCircle size={16} className="mt-0.5 shrink-0 text-error" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-error">Execution Failed</p>
                          <p className="mt-0.5 text-xs text-error/80 break-words">{failureMessage}</p>
                        </div>
                      </div>
                    )}

                    {outputText && (
                      <div className="mt-3 rounded-md border border-success/20 bg-success/5">
                        <div className="flex items-center gap-1.5 border-b border-success/20 px-3 py-1.5">
                          <CheckCircle2 size={12} className="text-success" />
                          <span className="text-xs font-medium text-success">Output</span>
                        </div>
                        <p className="whitespace-pre-wrap px-3 py-2.5 text-sm text-ink">{outputText}</p>
                      </div>
                    )}

                    {parsedEvents.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs font-medium text-mid">Event stream</p>
                          <span className="rounded-full bg-surface-active px-1.5 py-0.5 text-[10px] text-mid">
                            {parsedEvents.length} events
                          </span>
                        </div>
                        <div
                          ref={logRef}
                          className="max-h-80 overflow-y-auto rounded-md border border-line bg-surface"
                        >
                          {parsedEvents.map((e, i) => (
                            <EventRow key={i} event={e} />
                          ))}
                          <div className="flex items-center gap-1.5 px-2 py-2 text-xs">
                            {isRunning ? (
                              <>
                                <Loader2 size={12} className="animate-spin text-blue-500" />
                                <span className="text-blue-500">Waiting for events…</span>
                              </>
                            ) : hasFailed ? (
                              <>
                                <XCircle size={12} className="text-error" />
                                <span className="text-error">Execution failed</span>
                              </>
                            ) : hasCompleted ? (
                              <>
                                <CheckCircle2 size={12} className="text-success" />
                                <span className="text-success">Turn finished</span>
                              </>
                            ) : (
                              <>
                                <CircleDot size={12} className="text-light" />
                                <span className="text-light">Stream ended</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-mid">
                        Chat like AI Studio — send a message, read the reply, send the next one.
                        {chatSessionId ? (
                          <span className="ml-1 font-mono text-[10px] text-light">session {chatSessionId.slice(0, 8)}…</span>
                        ) : null}
                      </p>
                      {chatMessages.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setChatMessages([]);
                            setChatSessionId(null);
                            setRunError(null);
                            if (pickedMind) setChatInputValues(defaultChatInputValues(pickedMind));
                          }}
                          disabled={runMutation.isPending}
                        >
                          New chat
                        </Button>
                      )}
                    </div>

                    {chatFields.length > 0 && (
                      <SessionInputsForm
                        fields={chatFields}
                        values={chatInputValues}
                        onChange={(name, value) =>
                          setChatInputValues((prev) => ({ ...prev, [name]: value }))
                        }
                        locked={chatInputsLocked}
                        disabled={runMutation.isPending}
                        showRequiredHint={!chatInputsLocked && chatInputsBlockSend}
                      />
                    )}

                    <div
                      ref={chatLogRef}
                      className="flex max-h-[28rem] min-h-[12rem] flex-col gap-2.5 overflow-y-auto rounded-md border border-line bg-bg p-3"
                    >
                      {chatMessages.length === 0 && (
                        <EmptyState
                          icon={<Send className="mx-auto" size={24} strokeWidth={1.5} />}
                          title="Start a conversation"
                          description="Ask the Mind something below — replies stream in as they arrive."
                        />
                      )}
                      {chatMessages.map((msg) => (
                        <ChatMessageBubble key={msg.id} msg={msg} />
                      ))}
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Message…"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !e.shiftKey &&
                              !runMutation.isPending &&
                              !chatInputsBlockSend &&
                              chatMessage.trim()
                            ) {
                              e.preventDefault();
                              runMutation.mutate();
                            }
                          }}
                          disabled={runMutation.isPending}
                        />
                      </div>
                      <Button
                        onClick={() => runMutation.mutate()}
                        disabled={
                          runMutation.isPending ||
                          !mindId ||
                          !chatMessage.trim() ||
                          chatInputsBlockSend
                        }
                      >
                        {runMutation.isPending ? <Spinner className="mr-1.5" /> : <Send size={14} className="mr-1.5" />}
                        Send
                      </Button>
                    </div>
                    {runError && <p className="text-sm text-error">{runError}</p>}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>My Sessions</CardTitle>
                <CardDescription>
                  {pickedMind
                    ? `Your own runs of "${pickedMind.name}", most recent first — AI Studio's own Execution History shows every user's runs; this shows only yours.`
                    : "Runs made with your own signed-in identity, most recent first."}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => sessionsQuery.refetch()}>
                <RefreshCw size={14} />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <SessionsTable
                query={sessionsQuery}
                showMind={!pickedMind}
                onView={setViewingSession}
                onDelete={(s) => deleteMutation.mutate(s)}
              />
            </CardContent>
          </Card>

        {isAdmin && <FleetSessionsPanel onView={setViewingSession} />}
      </div>

      {viewingSession && <SessionDetailPanel session={viewingSession} onClose={() => setViewingSession(null)} />}
    </div>
    </div>
  );
}
