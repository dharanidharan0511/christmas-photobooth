import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AtSign,
  Check,
  ChevronDown,
  Clock,
  Folder,
  GripVertical,
  Infinity,
  Loader2,
  LocateFixed,
  MessageSquare,
  PanelRight,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  assistantPlainText,
  buildCodeRepoChatInputs,
  collidingBasenames,
  createCodeRepoChatStreamApplier,
  extractToolPath,
  foldersFromFileIndex,
  formatAttachedPrompt,
  formatSelectionBlock,
  isFileMutatingTool,
  mentionAtToken,
  pickCodeRepoMinds,
  transcriptFromStoredMessages,
  type AttachedFileBody,
  type ChatFileRef,
  type ChatToolBlock,
  type StreamChatMessage,
} from "../../lib/codeRepoChat";
import {
  archiveCodefloChatSession,
  chatCompletion,
  EngineApiError,
  getCodefloChatSessionMessages,
  getCodeRepoFile,
  isAbortError,
  listCodefloChatSessions,
  listCodeRepoFiles,
  listMyAccess,
  type CodefloChatSessionSummary,
} from "../../lib/engineClient";
import { creditErrorMessage } from "../../lib/credit-errors";
import { fileBaseName, toRepoRelativePath } from "../../lib/code-repo-file-utils";
import { mapFileResponse } from "../../lib/code-repos";
import { useAuth } from "../../hooks/useAuth";
import type { MindSummary } from "../../types/engine";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { ChatTurn, FileChip } from "./ChatTranscript";
import { getFileTextContent, type EditorTextSelection } from "./CodeFileViewer";

interface ChatMessage extends StreamChatMessage {}

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
  /** Stable CodeFlo memory session id — pass as prior_session_id on turn 2+. */
  engineSessionId: string | null;
  mindId: string | null;
}

export interface CodeRepoChatPanelProps {
  repoId: string;
  repoName: string;
  projectId: string;
  branch: string;
  treeSource?: "workspace" | "git" | "vcs";
  selectedFilePath?: string | null;
  openFiles?: ChatFileRef[];
  onOpenFile?: (path: string) => void;
  onRepoFilesChanged?: (paths: string[]) => void;
  editorSelection?: EditorTextSelection | null;
  selectionToAdd?: EditorTextSelection | null;
  onSelectionAdded?: () => void;
}

const MENTION_RESULT_LIMIT = 40;
const MENTION_IDLE_LIMIT = 12;
const FILE_BODY_MAX_CHARS = 16_384;
const FILE_BODY_MAX_FILES = 4;

const COMPOSER_MIN_PX = 40;
const COMPOSER_MAX_PX = 160;
const AUTO_SCROLL_NEAR_BOTTOM_PX = 80;
const CHAT_WIDTH_STORAGE_KEY = "tp-web:code-repo-chat-width";
const CHAT_WIDTH_DEFAULT = 352;
const CHAT_WIDTH_MIN = 280;
const CHAT_WIDTH_MAX = 720;
const FOLLOW_STORAGE_KEY = "tp-web:code-repo-chat-follow";
const TABS_STORAGE_PREFIX = "tp-web:code-repo-chat-tabs:";
const PERSIST_MAX_TABS = 5;
const PERSIST_MAX_MESSAGES = 50;
const PERSIST_TEXT_CHARS = 4000;

type QueuedTurn = { id: string; text: string; files: ChatFileRef[]; selection?: EditorTextSelection | null };

function selectionChipRef(selection: EditorTextSelection): ChatFileRef {
  return {
    path: `${selection.path}#L${selection.startLine}-L${selection.endLine}`,
    name: `${fileBaseName(selection.path)} L${selection.startLine}–${selection.endLine}`,
  };
}

function tabsStorageKey(repoId: string): string {
  return `${TABS_STORAGE_PREFIX}${repoId}`;
}

function readFollowAgent(): boolean {
  try {
    return localStorage.getItem(FOLLOW_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function clampChatWidth(width: number): number {
  const viewportCap =
    typeof window !== "undefined" ? Math.floor(window.innerWidth * 0.55) : CHAT_WIDTH_MAX;
  const max = Math.max(CHAT_WIDTH_MIN, Math.min(CHAT_WIDTH_MAX, viewportCap));
  return Math.max(CHAT_WIDTH_MIN, Math.min(max, Math.round(width)));
}

function readStoredChatWidth(): number {
  try {
    const raw = localStorage.getItem(CHAT_WIDTH_STORAGE_KEY);
    if (!raw) return CHAT_WIDTH_DEFAULT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return CHAT_WIDTH_DEFAULT;
    return clampChatWidth(parsed);
  } catch {
    return CHAT_WIDTH_DEFAULT;
  }
}

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isSameDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function engineDetailReason(error: unknown): string | null {
  if (!(error instanceof EngineApiError) || !error.body || typeof error.body !== "object") return null;
  const detail = (error.body as { detail?: unknown }).detail;
  if (detail && typeof detail === "object" && typeof (detail as { reason?: unknown }).reason === "string") {
    return (detail as { reason: string }).reason;
  }
  return null;
}

function identityChatError(error: unknown): string | null {
  const reason = engineDetailReason(error);
  if (reason === "missing_credentials") {
    return "Your Role has no stored Mind Share Key. Ask an admin to paste the full key on Roles and Save.";
  }
  if (reason === "no_role_grants_key" || reason === "no_role_on_mind") {
    return "Your Role does not grant this agent. Ask an admin to assign a Role for this project.";
  }
  return null;
}

function formatSessionStamp(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const date = new Date(ms);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (isSameDay(ms, Date.now())) return time;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${day}, ${time}`;
}

function HistorySessionRow({
  session,
  active,
  label,
  onOpen,
}: {
  session: CodefloChatSessionSummary;
  active: boolean;
  label: string;
  onOpen: () => void;
}) {
  const stamp = formatSessionStamp(session.updatedAt ?? session.createdAt);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full flex-col gap-0.5 px-2.5 py-1.5 text-left hover:bg-surface-hover",
        active ? "bg-surface-active text-ink" : "text-mid",
      )}
    >
      <span className="flex min-w-0 items-center gap-2 text-xs">
        <Check size={12} className="shrink-0 text-light" />
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{label}</span>
        {stamp ? (
          <span className="shrink-0 tabular-nums text-[10px] text-light" title={stamp}>
            {stamp}
          </span>
        ) : null}
      </span>
      <span className="pl-5 text-[10px] text-light">
        {session.status}
        {session.turnCount > 0 ? ` · ${session.turnCount} turns` : ""}
      </span>
    </button>
  );
}

function createSession(mindId: string | null = null): ChatSession {
  return {
    id: newId(),
    title: "New chat",
    createdAt: Date.now(),
    messages: [],
    engineSessionId: null,
    mindId,
  };
}

function initialChat(mindId: string | null = null) {
  const session = createSession(mindId);
  return { sessions: [session], openTabIds: [session.id], activeId: session.id };
}

function clipPersistedMessage(message: ChatMessage): ChatMessage {
  const clip = (value: string | undefined, max = PERSIST_TEXT_CHARS) =>
    value && value.length > max ? `${value.slice(0, max)}\n…` : value;
  return {
    ...message,
    streaming: false,
    content: clip(message.content) ?? "",
    blocks: (message.blocks ?? []).slice(-30).map((block) => {
      if (block.type === "text") return { ...block, content: clip(block.content) ?? "", streaming: false };
      if (block.type === "thinking") return { ...block, content: clip(block.content, 800) ?? "", streaming: false };
      if (block.type === "tool") {
        const args = block.toolArgs;
        const kept: Record<string, unknown> = {};
        if (args) {
          for (const key of ["file_path", "path", "filePath", "target_file", "filename", "file", "command", "cmd"]) {
            if (args[key] != null) kept[key] = args[key];
          }
        }
        return {
          ...block,
          streaming: false,
          outputSummary: clip(block.outputSummary, 1500),
          inputSummary: clip(block.inputSummary, 500),
          toolArgs: Object.keys(kept).length ? kept : undefined,
        };
      }
      return block;
    }),
  };
}

function readPersistedChat(repoId: string): { sessions: ChatSession[]; openTabIds: string[]; activeId: string } | null {
  try {
    const raw = localStorage.getItem(tabsStorageKey(repoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      sessions?: ChatSession[];
      openTabIds?: string[];
      activeId?: string;
    };
    const sessions = (parsed.sessions ?? [])
      .filter((session) => session?.id && (session.engineSessionId || (session.messages?.length ?? 0) > 0))
      .slice(0, PERSIST_MAX_TABS)
      .map((session) => ({
        ...session,
        messages: (session.messages ?? []).slice(-PERSIST_MAX_MESSAGES).map((message) => ({
          ...message,
          streaming: false,
        })),
      }));
    const rawOpen = parsed.openTabIds;
    const openTabIds = Array.isArray(rawOpen)
      ? rawOpen.filter((id) => sessions.some((session) => session.id === id))
      : sessions[0]
        ? [sessions[0].id]
        : [];
    const activeId =
      openTabIds.includes(parsed.activeId ?? "") ? parsed.activeId! : (openTabIds[0] ?? "");
    return { sessions, openTabIds, activeId };
  } catch {
    return null;
  }
}

function writePersistedChat(
  repoId: string,
  state: { sessions: ChatSession[]; openTabIds: string[]; activeId: string },
) {
  const worthSaving = state.sessions.filter(
    (session) => Boolean(session.engineSessionId) || session.messages.length > 0,
  );
  const sessions = worthSaving.slice(0, PERSIST_MAX_TABS).map((session) => ({
    ...session,
    messages: session.messages.slice(-PERSIST_MAX_MESSAGES).map(clipPersistedMessage),
  }));
  const openTabIds = state.openTabIds.filter((id) => sessions.some((session) => session.id === id));
  const payload = {
    v: 1,
    activeId: openTabIds.includes(state.activeId) ? state.activeId : (openTabIds[0] ?? ""),
    openTabIds,
    sessions,
  };
  try {
    localStorage.setItem(tabsStorageKey(repoId), JSON.stringify(payload));
  } catch {
    try {
      const slim = {
        ...payload,
        sessions: payload.sessions.map((session) => ({ ...session, messages: session.messages.slice(-8) })),
      };
      localStorage.setItem(tabsStorageKey(repoId), JSON.stringify(slim));
    } catch {
      // quota
    }
  }
}

function ArchiveChatDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, open]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-chat-title"
        className="w-full max-w-sm rounded-xl border border-line bg-surface shadow-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line px-4 py-3">
          <h2 id="archive-chat-title" className="text-sm font-semibold text-ink">
            Start a new chat?
          </h2>
        </div>
        <p className="px-4 py-4 text-sm text-mid">
          This archives the current conversation. You can still reopen it from history.
        </p>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm}>
            Archive & new
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function atQueryAtCursor(value: string, cursor: number): { start: number; query: string } | null {
  const before = value.slice(0, cursor);
  const match = before.match(/@([^\s@]*)$/);
  if (!match || match.index == null) return null;
  return { start: match.index, query: match[1] ?? "" };
}

export function CodeRepoChatPanel({
  repoId,
  repoName,
  projectId,
  branch,
  treeSource = "workspace",
  selectedFilePath = null,
  openFiles = [],
  onOpenFile,
  onRepoFilesChanged,
  editorSelection = null,
  selectionToAdd = null,
  onSelectionAdded,
}: CodeRepoChatPanelProps) {
  const auth = useAuth();
  const hasIdentity = auth.mode === "cookie" && Boolean(auth.whoami);

  const [open, setOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(CHAT_WIDTH_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);
  const [{ sessions: initialSessions, openTabIds: initialTabs, activeId: initialActive }] = useState(() =>
    readPersistedChat(repoId) ?? initialChat(null),
  );
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [openTabIds, setOpenTabIds] = useState<string[]>(initialTabs);
  const [activeId, setActiveId] = useState(initialActive);
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mindId, setMindId] = useState(() => {
    const stored = readPersistedChat(repoId);
    return stored?.sessions.find((session) => session.id === stored.activeId)?.mindId ?? "";
  });
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<ChatFileRef[]>([]);
  const [followAgent, setFollowAgent] = useState(readFollowAgent);
  const [sendQueue, setSendQueue] = useState<QueuedTurn[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [selectionChip, setSelectionChip] = useState<EditorTextSelection | null>(null);
  const [archivePrompt, setArchivePrompt] = useState<{ nextMindId?: string } | null>(null);

  const shouldAutoScrollRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const agentMenuRef = useRef<HTMLDivElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);
  const mentionFromAtRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const sendingRef = useRef(false);
  const sendQueueRef = useRef<QueuedTurn[]>([]);
  const runTurnRef = useRef<(text: string, files: ChatFileRef[], selection?: EditorTextSelection | null) => Promise<void>>(
    async () => {},
  );
  const seenMutationKeysRef = useRef(new Set<string>());
  const lastFollowKeyRef = useRef("");
  const mentionItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const skipPersistRef = useRef(true);
  const prevRepoIdRef = useRef(repoId);

  const accessQuery = useQuery({
    queryKey: ["myAccess", "code-repo-chat"],
    queryFn: ({ signal }) => listMyAccess(signal),
    enabled: hasIdentity,
    staleTime: 60_000,
  });

  const availableMinds = useMemo(() => {
    const minds: MindSummary[] = [];
    const seen = new Set<string>();
    for (const grant of accessQuery.data ?? []) {
      if (grant.projectId !== projectId) continue;
      for (const mind of grant.minds) {
        if (seen.has(mind.id)) continue;
        seen.add(mind.id);
        minds.push({ ...mind, projectId: mind.projectId ?? grant.projectId });
      }
    }
    return pickCodeRepoMinds(minds, projectId);
  }, [accessQuery.data, projectId]);

  const selectedMind = availableMinds.find((mind) => mind.id === mindId) ?? availableMinds[0] ?? null;

  useEffect(() => {
    if (!selectedMind) return;
    if (!mindId || !availableMinds.some((mind) => mind.id === mindId)) {
      setMindId(selectedMind.id);
    }
  }, [availableMinds, mindId, selectedMind]);

  const currentFileRef: ChatFileRef | null = selectedFilePath
    ? { path: selectedFilePath, name: fileBaseName(selectedFilePath) }
    : null;

  const composerFiles = useMemo(() => {
    const files: ChatFileRef[] = [];
    const seen = new Set<string>();
    for (const file of attachedFiles) {
      if (!file.path || seen.has(file.path)) continue;
      seen.add(file.path);
      files.push(file);
    }
    return files;
  }, [attachedFiles]);

  const repoFilesQuery = useQuery({
    queryKey: ["code-repo-file-index", repoId, treeSource, branch],
    queryFn: ({ signal }) => listCodeRepoFiles(repoId, { source: treeSource, branch }, signal),
    enabled: open && Boolean(repoId),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const mentionCandidates = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    const matches = (file: ChatFileRef) => {
      if (!file.path) return false;
      if (!q) return true;
      return file.path.toLowerCase().includes(q) || file.name.toLowerCase().includes(q);
    };
    const rank = (file: ChatFileRef) => {
      if (!q) return 0;
      const name = file.name.toLowerCase();
      if (name.startsWith(q)) return 0;
      if (name.includes(q)) return 1;
      return 2;
    };
    const seen = new Set<string>();
    const openMatched: ChatFileRef[] = [];
    const folderMatched: ChatFileRef[] = [];
    const repoMatched: ChatFileRef[] = [];
    const add = (file: ChatFileRef | null | undefined, into: ChatFileRef[]) => {
      if (!file || seen.has(file.path) || !matches(file)) return;
      seen.add(file.path);
      into.push({
        path: file.path,
        name: file.name || fileBaseName(file.path),
        kind: file.kind,
        fileCount: file.fileCount,
      });
    };
    add(currentFileRef, openMatched);
    for (const file of openFiles) add(file, openMatched);
    const folderLimit = q ? 8 : 4;
    for (const folder of foldersFromFileIndex(repoFilesQuery.data ?? [], mentionQuery, folderLimit)) {
      add(folder, folderMatched);
    }
    const repoRows = q
      ? [...(repoFilesQuery.data ?? [])].sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path))
      : (repoFilesQuery.data ?? []);
    const limit = q ? MENTION_RESULT_LIMIT : MENTION_IDLE_LIMIT;
    for (const file of repoRows) {
      add(file, repoMatched);
      if (openMatched.length + folderMatched.length + repoMatched.length >= limit) break;
    }
    return [...openMatched, ...folderMatched, ...repoMatched].slice(0, limit);
  }, [currentFileRef, mentionQuery, openFiles, repoFilesQuery.data]);

  const mentionColliding = useMemo(
    () => collidingBasenames(repoFilesQuery.data ?? []),
    [repoFilesQuery.data],
  );

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionQuery, mentionOpen]);

  useEffect(() => {
    setMentionIndex((index) => {
      if (mentionCandidates.length === 0) return 0;
      return Math.min(index, mentionCandidates.length - 1);
    });
  }, [mentionCandidates.length]);

  useEffect(() => {
    mentionItemRefs.current[mentionIndex]?.scrollIntoView({ block: "nearest" });
  }, [mentionIndex, mentionCandidates]);

  const attachFile = useCallback((file: ChatFileRef, replaceAtToken = false) => {
    setAttachedFiles((prev) => (prev.some((row) => row.path === file.path) ? prev : [...prev, file]));
    setMentionOpen(false);
    setMentionQuery("");
    mentionFromAtRef.current = false;

    const mention = mentionAtToken(file, mentionColliding);
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? draft.length;
    const token = replaceAtToken ? atQueryAtCursor(draft, cursor) : null;
    let next: string;
    let caret: number;
    if (token) {
      next = `${draft.slice(0, token.start)}${mention} ${draft.slice(cursor)}`;
      caret = token.start + mention.length + 1;
    } else {
      const before = draft.slice(0, cursor);
      const pad = before.length > 0 && !/\s$/.test(before) ? " " : "";
      next = `${before}${pad}${mention} ${draft.slice(cursor)}`;
      caret = cursor + pad.length + mention.length + 1;
    }
    setDraft(next);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(caret, caret);
    });
  }, [draft, mentionColliding]);

  const removeComposerFile = useCallback((path: string) => {
    setAttachedFiles((prev) => prev.filter((file) => file.path !== path));
  }, []);

  const sessionsQuery = useQuery({
    queryKey: ["codeflo-chat-sessions", selectedMind?.id ?? "", repoId],
    queryFn: ({ signal }) => listCodefloChatSessions(selectedMind!.id, repoId, signal),
    enabled: Boolean(hasIdentity && selectedMind?.id && repoId),
    staleTime: 30_000,
  });

  const persistStateRef = useRef({ sessions, openTabIds, activeId });
  persistStateRef.current = { sessions, openTabIds, activeId };

  useEffect(() => {
    if (prevRepoIdRef.current === repoId) return;
    writePersistedChat(prevRepoIdRef.current, persistStateRef.current);
    prevRepoIdRef.current = repoId;
    skipPersistRef.current = true;
    const stored = readPersistedChat(repoId);
    const next = stored ?? initialChat(null);
    setSessions(next.sessions);
    setOpenTabIds(next.openTabIds);
    setActiveId(next.activeId);
    setDraft("");
    setSendError(null);
    setAttachedFiles([]);
    const restoredMind = next.sessions.find((session) => session.id === next.activeId)?.mindId;
    if (restoredMind) setMindId(restoredMind);
  }, [repoId]);

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const id = repoId;
    const snapshot = persistStateRef.current;
    const timer = window.setTimeout(() => writePersistedChat(id, snapshot), 400);
    return () => window.clearTimeout(timer);
  }, [activeId, openTabIds, repoId, sessions]);

  useEffect(() => {
    return () => {
      writePersistedChat(prevRepoIdRef.current, persistStateRef.current);
    };
  }, []);

  useEffect(() => {
    setPanelWidth(readStoredChatWidth());
  }, []);

  useEffect(() => {
    const onResize = () => setPanelWidth((prev) => clampChatWidth(prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      resizeStartRef.current = { x: event.clientX, width: panelWidth };
      setIsResizing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [panelWidth],
  );

  const onResizePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return;
    const next = clampChatWidth(resizeStartRef.current.width + (resizeStartRef.current.x - event.clientX));
    setPanelWidth(next);
  }, []);

  const endResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return;
    resizeStartRef.current = null;
    setIsResizing(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    setPanelWidth((prev) => {
      const clamped = clampChatWidth(prev);
      try {
        localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(clamped));
      } catch {
        // ignore
      }
      return clamped;
    });
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  const openTabs = openTabIds
    .map((id) => sessions.find((session) => session.id === id))
    .filter((session): session is ChatSession => Boolean(session));
  const activeSession = openTabs.find((session) => session.id === activeId) ?? openTabs[0];

  // Keep a ref so sendMessage always uses the latest resume id (memory session),
  // even if turn_started updates state mid-stream / between rapid turns.
  const resumeSessionIdRef = useRef<string | null>(activeSession?.engineSessionId ?? null);
  useEffect(() => {
    resumeSessionIdRef.current = activeSession?.engineSessionId ?? null;
  }, [activeSession?.engineSessionId, activeSession?.id]);

  useEffect(() => {
    const assistant = [...(activeSession?.messages ?? [])]
      .reverse()
      .find((message) => message.role === "assistant");
    if (!assistant) return;
    const tools = (assistant.blocks ?? []).filter((block): block is ChatToolBlock => block.type === "tool");
    const changed: string[] = [];
    for (const tool of tools) {
      if (!isFileMutatingTool(tool.toolName)) continue;
      if (tool.status !== "success") continue;
      const raw = extractToolPath(tool.toolArgs);
      if (!raw) continue;
      const path = toRepoRelativePath(raw);
      const key = `${assistant.id}:${tool.id}:done`;
      if (seenMutationKeysRef.current.has(key)) continue;
      seenMutationKeysRef.current.add(key);
      changed.push(path);
    }
    if (changed.length > 0) onRepoFilesChanged?.(changed);

    if (!followAgent || !onOpenFile) return;
    const latest = [...tools].reverse().find((tool) => extractToolPath(tool.toolArgs));
    if (!latest) return;
    if (!assistant.streaming && latest.status !== "running") return;
    const raw = extractToolPath(latest.toolArgs);
    if (!raw) return;
    const path = toRepoRelativePath(raw);
    const followKey = `${latest.id}:${latest.status ?? ""}:${latest.streaming ? "s" : ""}`;
    if (lastFollowKeyRef.current === followKey) return;
    lastFollowKeyRef.current = followKey;
    onOpenFile(path);
  }, [activeSession?.messages, followAgent, onOpenFile, onRepoFilesChanged]);

  const bindResumeSessionId = useCallback(
    (sessionLocalId: string, resumeId: string) => {
      resumeSessionIdRef.current = resumeId;
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionLocalId ? { ...session, engineSessionId: resumeId } : session,
        ),
      );
    },
    [],
  );

  const resizeComposer = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, COMPOSER_MIN_PX), COMPOSER_MAX_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_PX ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizeComposer();
  }, [draft, resizeComposer]);

  const scrollToBottom = useCallback((force = false) => {
    const el = scrollRef.current;
    if (!el) return;
    if (!force && !shouldAutoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= AUTO_SCROLL_NEAR_BOTTOM_PX;
    shouldAutoScrollRef.current = nearBottom;
    setIsNearBottom(nearBottom);
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    scrollToBottom();
  }, [activeSession?.messages, scrollToBottom]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
    setIsNearBottom(true);
    requestAnimationFrame(() => scrollToBottom(true));
  }, [activeId, scrollToBottom]);

  useEffect(() => {
    if (!historyOpen && !agentMenuOpen && !mentionOpen) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (historyOpen && !historyRef.current?.contains(target)) setHistoryOpen(false);
      if (agentMenuOpen && !agentMenuRef.current?.contains(target)) setAgentMenuOpen(false);
      if (mentionOpen && !mentionRef.current?.contains(target)) setMentionOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [agentMenuOpen, historyOpen, mentionOpen]);

  const engineHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    const items = (sessionsQuery.data ?? []).filter((session) => {
      if (!q) return true;
      const title = (session.title ?? "").toLowerCase();
      const summary = (session.summary ?? "").toLowerCase();
      return (
        title.includes(q) ||
        summary.includes(q) ||
        session.sessionId.toLowerCase().includes(q) ||
        session.status.toLowerCase().includes(q)
      );
    });
    const now = Date.now();
    const today: CodefloChatSessionSummary[] = [];
    const older: CodefloChatSessionSummary[] = [];
    for (const session of items) {
      const stamp = session.updatedAt ?? session.createdAt;
      const created = stamp ? Date.parse(stamp) : 0;
      if (created && isSameDay(created, now)) today.push(session);
      else older.push(session);
    }
    return { today, older };
  }, [historyQuery, sessionsQuery.data]);

  const openSession = useCallback((id: string) => {
    setActiveId(id);
    setOpenTabIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setHistoryOpen(false);
    setSendError(null);
  }, []);

  const conversationLabel = useCallback((session: CodefloChatSessionSummary) => {
    const title = (session.title ?? "").trim();
    if (title) return title;
    const summary = (session.summary ?? "").trim();
    if (summary) return summary.slice(0, 48);
    return "Untitled chat";
  }, []);

  const openEngineSession = useCallback(
    async (engineSession: CodefloChatSessionSummary) => {
      const existing = sessions.find((session) => session.engineSessionId === engineSession.sessionId);
      if (existing) {
        openSession(existing.id);
        const streaming = existing.messages.some((msg) => msg.streaming);
        const hasTools = existing.messages.some((msg) => (msg.blocks ?? []).some((block) => block.type === "tool"));
        if (streaming || hasTools || !hasIdentity) return;
      }
      if (!hasIdentity) {
        setSendError("Sign in to restore conversation history.");
        return;
      }

      setHistoryOpen(false);
      setSendError(null);
      const created = engineSession.createdAt ? Date.parse(engineSession.createdAt) : Date.now();
      const session: ChatSession = existing ?? {
        id: newId(),
        title: conversationLabel(engineSession),
        createdAt: Number.isFinite(created) ? created : Date.now(),
        messages: [],
        engineSessionId: engineSession.sessionId,
        mindId: engineSession.mindId,
      };
      if (!existing) {
        setSessions((prev) => [session, ...prev]);
        setOpenTabIds((prev) => [...prev, session.id]);
        setActiveId(session.id);
      }
      resumeSessionIdRef.current = engineSession.sessionId;
      if (engineSession.mindId) setMindId(engineSession.mindId);

      try {
        const loaded = await getCodefloChatSessionMessages(engineSession.sessionId);
        const messages: ChatMessage[] = transcriptFromStoredMessages(loaded);
        setSessions((prev) =>
          prev.map((row) => (row.id === session.id ? { ...row, messages } : row)),
        );
        requestAnimationFrame(() => scrollToBottom(true));
      } catch (error) {
        const message =
          error instanceof EngineApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Could not load conversation";
        setSendError(message);
      }
    },
    [conversationLabel, hasIdentity, openSession, scrollToBottom, sessions],
  );

  const closeTab = useCallback(
    (id: string) => {
      const closingActive = id === activeId;
      if (closingActive && sendingRef.current) {
        abortRef.current?.abort();
        sendQueueRef.current = [];
        setSendQueue([]);
        setQueueOpen(false);
      }
      setOpenTabIds((prev) => {
        const next = prev.filter((tabId) => tabId !== id);
        if (closingActive) {
          const fallback = next[next.length - 1] ?? "";
          setActiveId(fallback);
          resumeSessionIdRef.current = fallback
            ? sessions.find((session) => session.id === fallback)?.engineSessionId ?? null
            : null;
        }
        return next;
      });
      if (closingActive) {
        setSendError(null);
        setHistoryOpen(false);
      }
    },
    [activeId, sessions],
  );

  const startNewSession = useCallback(
    async (nextMindId?: string) => {
      const prior = resumeSessionIdRef.current ?? activeSession?.engineSessionId ?? null;
      if (prior && hasIdentity) {
        try {
          await archiveCodefloChatSession(prior);
        } catch {
          // Best-effort — gateway/engine sweep is the safety net.
        }
      }
      const session = createSession(nextMindId ?? selectedMind?.id ?? null);
      resumeSessionIdRef.current = null;
      if (nextMindId) setMindId(nextMindId);
      setSessions((prev) => [session, ...prev]);
      setOpenTabIds((prev) => [...prev, session.id]);
      setActiveId(session.id);
      setDraft("");
      setSendError(null);
      setHistoryOpen(false);
      setArchivePrompt(null);
      void sessionsQuery.refetch();
    },
    [activeSession?.engineSessionId, hasIdentity, selectedMind?.id, sessionsQuery],
  );

  const requestNewSession = useCallback(
    (nextMindId?: string) => {
      if (!activeSession) {
        void startNewSession(nextMindId);
        return;
      }
      const prior = resumeSessionIdRef.current ?? activeSession.engineSessionId ?? null;
      const hasWork = Boolean(prior) || activeSession.messages.length > 0;
      if (hasWork) {
        setArchivePrompt({ nextMindId });
        return;
      }
      void startNewSession(nextMindId);
    },
    [activeSession, startNewSession],
  );

  const selectAgent = useCallback(
    (nextMindId: string) => {
      setAgentMenuOpen(false);
      const currentMindId = activeSession?.mindId ?? selectedMind?.id ?? null;
      if (nextMindId === currentMindId) {
        setMindId(nextMindId);
        return;
      }
      requestNewSession(nextMindId);
    },
    [activeSession?.mindId, requestNewSession, selectedMind?.id],
  );

  const updateActiveMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeId ? { ...session, messages: updater(session.messages) } : session,
        ),
      );
    },
    [activeId],
  );

  const fetchAttachedBodies = useCallback(
    async (files: ChatFileRef[], signal?: AbortSignal): Promise<AttachedFileBody[]> => {
      const take = files.filter((file) => file.kind !== "folder").slice(0, FILE_BODY_MAX_FILES);
      const bodies: AttachedFileBody[] = [];
      for (const file of take) {
        try {
          const response = await getCodeRepoFile(repoId, {
            path: file.path,
            source: treeSource,
            branch,
          }, signal);
          const text = getFileTextContent(mapFileResponse(response));
          if (!text) continue;
          bodies.push({
            path: file.path,
            body: text.length > FILE_BODY_MAX_CHARS ? `${text.slice(0, FILE_BODY_MAX_CHARS)}\n…` : text,
          });
        } catch {
          // Skip unreadable / binary files — path list still goes in the prompt.
        }
      }
      return bodies;
    },
    [branch, repoId, treeSource],
  );

  const runTurn = useCallback(
    async (text: string, files: ChatFileRef[], selection?: EditorTextSelection | null) => {
      if ((!text.trim() && !selection) || !activeSession) return;
      if (!selectedMind) {
        setSendError(
          hasIdentity
            ? "No published CodeFlo agent on this project. Ask an admin to assign a Role with a stored Mind Share Key."
            : "Sign in to chat against this repository.",
        );
        return;
      }
      if (!hasIdentity) {
        setSendError("Sign in to chat against this repository.");
        return;
      }

      sendingRef.current = true;
      setSending(true);
      setSendError(null);
      setMentionOpen(false);

      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
        attachments: selection ? [...files, selectionChipRef(selection)] : files,
      };
      const assistantMessage: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: "",
        streaming: true,
        createdAt: Date.now(),
        blocks: [],
      };
      const titleFromText = text.split("\n")[0]?.slice(0, 42) || (selection ? selectionChipRef(selection).name : "New chat");

      shouldAutoScrollRef.current = true;
      setIsNearBottom(true);
      const controller = new AbortController();
      abortRef.current = controller;
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession.id
            ? {
                ...session,
                title: session.messages.length === 0 ? titleFromText : session.title,
                mindId: selectedMind.id,
                messages: [...session.messages, userMessage, assistantMessage],
              }
            : session,
        ),
      );

      const stream = createCodeRepoChatStreamApplier(
        (updater) => {
          updateActiveMessages((prev) => (typeof updater === "function" ? updater(prev) : updater));
        },
        (resumeSessionId) => {
          bindResumeSessionId(activeSession.id, resumeSessionId);
        },
      );

      const priorSessionId = resumeSessionIdRef.current ?? activeSession.engineSessionId ?? undefined;

      try {
        const bodies = await fetchAttachedBodies(files, controller.signal);
        const attached = formatAttachedPrompt(text, files, bodies);
        const outgoing = selection ? `${attached}\n\n${formatSelectionBlock(selection)}`.trim() : attached;
        const minted = await chatCompletion(
          selectedMind.id,
          "",
          outgoing,
          (data, eventName) => stream.apply(data, eventName),
          {
            priorSessionId,
            operatorType: "codeflo_chat",
            inputs: buildCodeRepoChatInputs(selectedMind, repoId, branch),
            signal: controller.signal,
          },
        );
        stream.flushNow();
        if (minted && !resumeSessionIdRef.current) {
          bindResumeSessionId(activeSession.id, minted);
        }
        updateActiveMessages((prev) =>
          prev.map((msg, index) =>
            index === prev.length - 1 && msg.role === "assistant" ? { ...msg, streaming: false } : msg,
          ),
        );
        void sessionsQuery.refetch();
      } catch (error) {
        if (isAbortError(error)) {
          stream.finishStreaming();
        } else {
          const message =
            identityChatError(error) ??
            creditErrorMessage(error) ??
            (error instanceof EngineApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Chat failed");
          setSendError(message);
          updateActiveMessages((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].role === "assistant" && next[i].streaming) {
                next[i] = { ...next[i], content: next[i].content || message, streaming: false };
                break;
              }
            }
            return next;
          });
        }
      } finally {
        abortRef.current = null;
        sendingRef.current = false;
        setSending(false);
        requestAnimationFrame(() => {
          if (textareaRef.current) textareaRef.current.style.height = `${COMPOSER_MIN_PX}px`;
          scrollToBottom(true);
        });
        const next = sendQueueRef.current.find((row) => row.text.trim() || row.selection);
        if (next) {
          sendQueueRef.current = sendQueueRef.current.filter((row) => row.id !== next.id);
          setSendQueue(sendQueueRef.current);
          void runTurnRef.current(next.text, next.files, next.selection);
        } else if (sendQueueRef.current.length > 0) {
          sendQueueRef.current = [];
          setSendQueue([]);
          setQueueOpen(false);
        }
      }
    },
    [
      activeSession,
      bindResumeSessionId,
      branch,
      fetchAttachedBodies,
      hasIdentity,
      repoId,
      scrollToBottom,
      selectedMind,
      sessionsQuery,
      updateActiveMessages,
    ],
  );

  useEffect(() => {
    runTurnRef.current = runTurn;
  }, [runTurn]);

  const sendMessage = useCallback(
    (preset?: string, filesOverride?: ChatFileRef[]) => {
      const fromComposer = preset == null;
      const selection = fromComposer ? selectionChip : null;
      const text = (preset ?? draft).trim();
      if (!text && !selection) return;
      const files = filesOverride ?? composerFiles;
      if (sendingRef.current) {
        sendQueueRef.current = [...sendQueueRef.current, { id: newId(), text, files, selection }];
        setSendQueue(sendQueueRef.current);
        if (fromComposer) {
          setDraft("");
          setMentionOpen(false);
          setSelectionChip(null);
        }
        return;
      }
      if (fromComposer) {
        setDraft("");
        setMentionOpen(false);
        setSelectionChip(null);
      }
      void runTurn(text, files, selection);
    },
    [composerFiles, draft, runTurn, selectionChip],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearSendQueue = useCallback(() => {
    sendQueueRef.current = [];
    setSendQueue([]);
    setQueueOpen(false);
  }, []);

  const updateQueuedTurn = useCallback((id: string, text: string) => {
    sendQueueRef.current = sendQueueRef.current.map((row) => (row.id === id ? { ...row, text } : row));
    setSendQueue(sendQueueRef.current);
  }, []);

  const removeQueuedTurn = useCallback((id: string) => {
    sendQueueRef.current = sendQueueRef.current.filter((row) => row.id !== id);
    setSendQueue(sendQueueRef.current);
    if (sendQueueRef.current.length === 0) setQueueOpen(false);
  }, []);

  const copyTurn = useCallback(async (message: ChatMessage) => {
    const text =
      message.role === "assistant"
        ? assistantPlainText(message)
        : message.content.trim() ||
          (message.attachments ?? []).map((file) => file.name || file.path).join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard unavailable
    }
  }, []);

  const retryLastUser = useCallback(() => {
    const lastUser = [...(activeSession?.messages ?? [])].reverse().find((message) => message.role === "user");
    if (!lastUser?.content.trim()) return;
    sendMessage(lastUser.content, lastUser.attachments ?? []);
  }, [activeSession?.messages, sendMessage]);

  const editUserMessage = useCallback(
    (message: ChatMessage) => {
      if (sendingRef.current) return;
      setDraft(message.content);
      setAttachedFiles(message.attachments ?? []);
      updateActiveMessages((prev) => {
        const index = prev.findIndex((row) => row.id === message.id);
        if (index < 0) return prev;
        return prev.slice(0, index);
      });
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [updateActiveMessages],
  );

  const insertSelection = useCallback((sel?: EditorTextSelection | null) => {
    const selection = sel ?? editorSelection;
    if (!selection) return;
    setSelectionChip(selection);
  }, [editorSelection]);

  const insertSelectionRef = useRef(insertSelection);
  insertSelectionRef.current = insertSelection;

  useEffect(() => {
    if (!selectionToAdd) return;
    insertSelectionRef.current(selectionToAdd);
    onSelectionAdded?.();
  }, [onSelectionAdded, selectionToAdd]);

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && mentionCandidates.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((index) => (index + 1) % mentionCandidates.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((index) => (index - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        attachFile(mentionCandidates[mentionIndex] ?? mentionCandidates[0], true);
        return;
      }
    }
    if (event.key === "Escape" && mentionOpen) {
      event.preventDefault();
      setMentionOpen(false);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const token = atQueryAtCursor(value, cursor);
    if (token) {
      mentionFromAtRef.current = true;
      setMentionQuery(token.query);
      setMentionOpen(true);
    } else if (mentionFromAtRef.current) {
      mentionFromAtRef.current = false;
      setMentionQuery("");
      setMentionOpen(false);
    }
  };

  const emptyPrompts = [
    currentFileRef ? `Explain ${currentFileRef.name}` : `What does ${repoName} contain?`,
    currentFileRef ? `Find call sites of symbols in ${currentFileRef.name}` : "How is this repository structured?",
    "Summarize recent changes a new contributor should know",
  ];

  if (!open) {
    return (
      <div className="flex h-full w-10 shrink-0 flex-col items-center border-l border-line bg-bg-subtle py-2">
        <button
          type="button"
          title="Open chat"
          onClick={() => setOpen(true)}
          className="rounded-md p-1.5 text-mid hover:bg-surface-hover hover:text-ink"
        >
          <MessageSquare size={16} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-line bg-bg-subtle"
      style={{ width: panelWidth }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat panel"
        title="Drag to resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        className={cn(
          "group absolute left-0 top-0 z-20 hidden h-full w-2 -translate-x-1/2 cursor-col-resize touch-none md:flex md:items-center md:justify-center",
          "bg-transparent transition-colors hover:bg-accent/15",
          isResizing && "bg-accent/25",
        )}
      >
        <span
          className={cn(
            "pointer-events-none flex h-7 w-2.5 items-center justify-center rounded-sm border border-line bg-surface shadow-sm",
            "text-light transition-colors group-hover:border-accent/40 group-hover:text-accent",
            isResizing && "border-accent/50 text-accent",
          )}
        >
          <GripVertical size={10} strokeWidth={1.75} />
        </span>
      </div>

      <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-line px-1.5">
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
          {openTabs.map((tab) => {
            const active = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => openSession(tab.id)}
                className={cn(
                  "group flex max-w-[9.5rem] shrink-0 items-center gap-1 border-r border-line px-2 py-2 text-[11px]",
                  active ? "bg-bg-subtle text-ink" : "text-mid hover:bg-surface-hover hover:text-ink",
                )}
                title={tab.title}
              >
                <MessageSquare size={11} strokeWidth={1.5} className="shrink-0" />
                <span className="min-w-0 truncate">{tab.title}</span>
                <span
                  role="button"
                  tabIndex={0}
                  title="Close session"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.stopPropagation();
                      closeTab(tab.id);
                    }
                  }}
                  className={cn(
                    "rounded p-0.5 text-light hover:bg-surface-active hover:text-ink",
                    active || openTabs.length === 1 ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <X size={10} strokeWidth={1.5} />
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          title="New chat"
          onClick={() => requestNewSession()}
          disabled={sending}
          className="rounded p-1 text-light hover:bg-surface-hover hover:text-ink disabled:opacity-40"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          title={followAgent ? "Following the agent in the editor" : "Follow the agent in the editor"}
          onClick={() => {
            setFollowAgent((prev) => {
              const next = !prev;
              try {
                localStorage.setItem(FOLLOW_STORAGE_KEY, next ? "1" : "0");
              } catch {
                // ignore
              }
              return next;
            });
          }}
          className={cn(
            "rounded p-1 hover:bg-surface-hover",
            followAgent ? "text-accent" : "text-light hover:text-ink",
          )}
        >
          <LocateFixed size={14} strokeWidth={1.5} />
        </button>

        <div className="relative" ref={historyRef}>
          <button
            type="button"
            title="Session history"
            onClick={() => setHistoryOpen((value) => !value)}
            className={cn(
              "rounded p-1 text-light hover:bg-surface-hover hover:text-ink",
              historyOpen && "bg-surface-active text-ink",
            )}
          >
            <Clock size={14} strokeWidth={1.5} />
          </button>
          {historyOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border border-line bg-surface shadow-card">
              <div className="flex items-center gap-1.5 border-b border-line px-2 py-1.5">
                <Search size={12} className="shrink-0 text-light" />
                <input
                  value={historyQuery}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                  placeholder="Search sessions…"
                  className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-light"
                />
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {sessionsQuery.isLoading && (
                  <p className="flex items-center gap-1.5 px-2.5 py-3 text-xs text-light">
                    <Loader2 size={12} className="animate-spin" /> Loading…
                  </p>
                )}
                {engineHistory.today.length > 0 && (
                  <div>
                    <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-light">Today</p>
                    {engineHistory.today.map((session) => (
                      <HistorySessionRow
                        key={session.sessionId}
                        session={session}
                        active={session.sessionId === activeSession?.engineSessionId}
                        label={conversationLabel(session)}
                        onOpen={() => void openEngineSession(session)}
                      />
                    ))}
                  </div>
                )}
                {engineHistory.older.length > 0 && (
                  <div>
                    <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-light">Older</p>
                    {engineHistory.older.map((session) => (
                      <HistorySessionRow
                        key={session.sessionId}
                        session={session}
                        active={session.sessionId === activeSession?.engineSessionId}
                        label={conversationLabel(session)}
                        onOpen={() => void openEngineSession(session)}
                      />
                    ))}
                  </div>
                )}
                {!sessionsQuery.isLoading &&
                  engineHistory.today.length === 0 &&
                  engineHistory.older.length === 0 && (
                    <p className="px-2.5 py-3 text-xs text-light">No conversations for this repository yet</p>
                  )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          title="Collapse chat"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-light hover:bg-surface-hover hover:text-ink"
        >
          <PanelRight size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={handleMessagesScroll} className="h-full overflow-y-auto px-5 py-4">
          {!activeSession ? (
            <div className="flex h-full flex-col justify-center py-6">
              <MessageSquare size={18} className="mb-2 text-light" strokeWidth={1.5} />
              <p className="text-sm font-medium text-ink">No open chats</p>
              <p className="mt-1 text-xs text-mid">
                Closed conversations stay in history. Start a new chat when you need one.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-4 self-start"
                onClick={() => requestNewSession()}
                disabled={sending}
              >
                <Plus size={14} strokeWidth={1.5} />
                New chat
              </Button>
            </div>
          ) : activeSession.messages.length ? (
            <div className="space-y-5">
              {activeSession.messages.map((message) => {
                const lastAssistant = [...activeSession.messages]
                  .reverse()
                  .find((row) => row.role === "assistant");
                return (
                  <ChatTurn
                    key={message.id}
                    message={message}
                    onOpenFile={onOpenFile}
                    onCopy={() => void copyTurn(message)}
                    onRetry={retryLastUser}
                    onEdit={() => editUserMessage(message)}
                    showRetry={message.role === "assistant" && message.id === lastAssistant?.id && !sending}
                    showEdit={message.role === "user" && !sending}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center py-6">
              <Sparkles size={18} className="mb-2 text-light" strokeWidth={1.5} />
              <p className="text-sm font-medium text-ink">Ask about this repository</p>
              <p className="mt-1 text-xs text-mid">
                {selectedMind
                  ? "Attach files with @. Enter sends, Shift+Enter adds a line."
                  : hasIdentity
                    ? "No CodeFlo agent on this project for your Role."
                    : "Sign in to chat against this repository."}
              </p>
              {activeSession.engineSessionId && (
                <p className="mt-2 text-[11px] text-light">
                  Resuming session {activeSession.engineSessionId.slice(0, 8)}… — send a message to continue.
                </p>
              )}
              {selectedMind && hasIdentity && (
                <div className="mt-4 flex flex-col items-stretch gap-1.5">
                  {emptyPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="rounded-md border border-line bg-bg px-2.5 py-1.5 text-left text-xs text-mid hover:border-accent/40 hover:text-ink"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {!isNearBottom && (activeSession?.messages.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => {
              shouldAutoScrollRef.current = true;
              setIsNearBottom(true);
              scrollToBottom(true);
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-mid shadow-card hover:text-ink"
          >
            Jump to latest
          </button>
        )}
      </div>

      <div className="shrink-0 border-t border-line p-2">
        {sendError && (
          <div className="mb-2 rounded-md border border-line bg-bg px-2 py-1.5 text-[11px] text-error">{sendError}</div>
        )}
        {sendQueue.length > 0 && (
          <div className="mb-2 overflow-hidden rounded-md border border-line bg-bg">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setQueueOpen((value) => !value)}
                className="flex min-w-0 flex-1 items-center gap-1 text-left text-[11px] text-mid hover:text-ink"
              >
                <ChevronDown
                  size={12}
                  className={cn("shrink-0 text-light transition-transform", !queueOpen && "-rotate-90")}
                />
                <span>Queued ({sendQueue.length})</span>
              </button>
              <button
                type="button"
                title="Drop queued messages"
                onClick={clearSendQueue}
                className="rounded p-0.5 text-light hover:bg-surface-hover hover:text-ink"
              >
                <X size={12} strokeWidth={1.5} />
              </button>
            </div>
            {queueOpen ? (
              <div className="space-y-1.5 border-t border-line px-2 py-1.5">
                {sendQueue.map((item, index) => (
                  <div key={item.id} className="rounded-md border border-line bg-surface px-2 py-1.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-light">
                        {index + 1} of {sendQueue.length}
                      </span>
                      <button
                        type="button"
                        title="Remove from queue"
                        onClick={() => removeQueuedTurn(item.id)}
                        className="rounded p-0.5 text-light hover:bg-surface-hover hover:text-ink"
                      >
                        <X size={11} strokeWidth={1.5} />
                      </button>
                    </div>
                    {(item.files.length > 0 || item.selection) && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {item.files.map((file) => (
                          <FileChip key={file.path} file={file} />
                        ))}
                        {item.selection ? <FileChip file={selectionChipRef(item.selection)} /> : null}
                      </div>
                    )}
                    <textarea
                      value={item.text}
                      onChange={(event) => updateQueuedTurn(item.id, event.target.value)}
                      rows={2}
                      className="block w-full resize-y rounded border border-line bg-bg px-2 py-1 text-xs text-ink outline-none placeholder:text-light"
                      placeholder="Queued message…"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {(!hasIdentity || accessQuery.isError) && !selectedMind ? (
          <div className="mb-2 rounded-md border border-line bg-bg px-2 py-1.5 text-[11px] text-error">
            {!hasIdentity
              ? "Sign in to chat against this repository."
              : accessQuery.error instanceof Error
                ? accessQuery.error.message
                : "Could not load agents for your Role."}
          </div>
        ) : null}
        <div className="rounded-lg border border-line bg-bg">
          {composerFiles.length > 0 || selectionChip ? (
            <div className="flex flex-wrap gap-1 px-2 pt-2">
              {composerFiles.map((file) => (
                <FileChip
                  key={file.path}
                  file={file}
                  onOpen={file.kind === "folder" ? undefined : onOpenFile ? () => onOpenFile(file.path) : undefined}
                  onRemove={() => removeComposerFile(file.path)}
                />
              ))}
              {selectionChip ? (
                <FileChip
                  file={selectionChipRef(selectionChip)}
                  onOpen={onOpenFile ? () => onOpenFile(selectionChip.path) : undefined}
                  onRemove={() => setSelectionChip(null)}
                />
              ) : null}
            </div>
          ) : null}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={
              !activeSession
                ? "Start a new chat to ask about this repository…"
                : !hasIdentity
                  ? "Sign in to chat…"
                  : selectedMind
                    ? "Ask about this repository…  (@ to attach a file)"
                    : accessQuery.isLoading
                      ? "Loading agents…"
                      : "No agent available…"
            }
            rows={1}
            disabled={!activeSession || !selectedMind || !hasIdentity}
            className="block w-full resize-none bg-transparent px-3 pt-2.5 pb-1.5 text-sm text-ink outline-none placeholder:text-light disabled:opacity-50"
            style={{ minHeight: COMPOSER_MIN_PX, maxHeight: COMPOSER_MAX_PX }}
          />
          <div className="flex items-center justify-between gap-2 px-1.5 pb-1.5">
            <div className="flex min-w-0 items-center gap-1">
            <div className="relative min-w-0" ref={agentMenuRef}>
              <button
                type="button"
                title={selectedMind?.name ?? "Select agent"}
                disabled={availableMinds.length === 0}
                onClick={() => setAgentMenuOpen((value) => !value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-mid",
                  "hover:bg-surface-hover hover:text-ink disabled:opacity-40",
                  agentMenuOpen && "bg-surface-active text-ink",
                )}
              >
                <Infinity size={12} strokeWidth={1.5} className="shrink-0" />
                <span>Agent</span>
                <ChevronDown size={11} strokeWidth={1.5} className="shrink-0 opacity-70" />
              </button>
              {agentMenuOpen && availableMinds.length > 0 && (
                <div className="absolute bottom-full left-0 z-30 mb-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-card">
                  {availableMinds.map((mind) => (
                    <button
                      key={mind.id}
                      type="button"
                      onClick={() => selectAgent(mind.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-surface-hover",
                        mind.id === selectedMind?.id ? "bg-surface-active text-ink" : "text-mid",
                      )}
                    >
                      <Infinity size={11} className="shrink-0 text-light" />
                      <span className="min-w-0 flex-1 truncate">{mind.name}</span>
                      {mind.id === selectedMind?.id && <Check size={11} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative" ref={mentionRef}>
              <button
                type="button"
                title="Attach a file"
                disabled={!activeSession}
                onClick={() => {
                  mentionFromAtRef.current = false;
                  setMentionQuery("");
                  setMentionOpen((value) => !value);
                }}
                className={cn(
                  "rounded-full border border-line bg-surface p-1 text-mid hover:bg-surface-hover hover:text-ink disabled:opacity-40",
                  mentionOpen && "bg-surface-active text-ink",
                )}
              >
                <AtSign size={12} strokeWidth={1.5} />
              </button>
              {mentionOpen && (
                <div className="absolute bottom-full left-0 z-30 mb-1 w-72 overflow-hidden rounded-lg border border-line bg-surface shadow-card">
                  {mentionCandidates.length === 0 ? (
                    <p className="px-2.5 py-2 text-[11px] text-light">
                      {repoFilesQuery.isFetching
                        ? "Loading files…"
                        : repoFilesQuery.isError
                          ? "Couldn't load repository files"
                          : "No matching files or folders"}
                    </p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
                      {mentionCandidates.map((file, index) => (
                        <button
                          key={file.path}
                          ref={(node) => {
                            mentionItemRefs.current[index] = node;
                          }}
                          type="button"
                          onClick={() => attachFile(file, true)}
                          className={cn(
                            "flex w-full flex-col px-2.5 py-1.5 text-left hover:bg-surface-hover",
                            index === mentionIndex && "bg-surface-active",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            {file.kind === "folder" ? (
                              <Folder size={11} strokeWidth={1.75} className="shrink-0 text-light" />
                            ) : null}
                            <span className="truncate text-xs text-ink">{file.name}</span>
                            {file.kind === "folder" && typeof file.fileCount === "number" ? (
                              <span className="shrink-0 text-[10px] text-light">{file.fileCount}</span>
                            ) : null}
                          </span>
                          <span className="truncate font-mono text-[10px] text-light">{file.path}</span>
                        </button>
                      ))}
                      {repoFilesQuery.isFetching ? (
                        <p className="px-2.5 py-1.5 text-[10px] text-light">Loading files…</p>
                      ) : !mentionQuery.trim() ? (
                        <p className="px-2.5 py-1.5 text-[10px] text-light">Type to search all files</p>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
            <div className="flex items-center gap-0.5">
              {sending ? (
                <button
                  type="button"
                  title="Stop"
                  onClick={stopStreaming}
                  className="rounded p-1 text-mid hover:bg-surface-hover hover:text-ink"
                >
                  <span className="block h-2.5 w-2.5 rounded-[1px] bg-current" />
                </button>
              ) : null}
              <button
                type="button"
                title={sending ? "Queue (Enter)" : "Send (Enter)"}
                onClick={() => sendMessage()}
                disabled={!activeSession || (!draft.trim() && !selectionChip) || !selectedMind || !hasIdentity}
                className="rounded p-1 text-accent hover:bg-accent/10 disabled:opacity-30"
              >
                <Send size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <ArchiveChatDialog
        open={Boolean(archivePrompt)}
        onCancel={() => setArchivePrompt(null)}
        onConfirm={() => void startNewSession(archivePrompt?.nextMindId)}
      />
    </aside>
  );
}
