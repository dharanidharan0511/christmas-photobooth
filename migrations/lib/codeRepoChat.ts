import type { Dispatch, SetStateAction } from "react";
import type { MindInputField, MindSummary } from "@/types/engine";

/** Prompt-like mind inputs — the chat composer supplies these. */
const CHAT_PROMPT_INPUT_NAMES = new Set([
  "message",
  "user_message",
  "user_input",
  "query",
  "question",
  "prompt",
  "text",
]);

export function isChatPromptInput(name: string): boolean {
  return CHAT_PROMPT_INPUT_NAMES.has(name.toLowerCase());
}

export function mindHasRepoInput(mind: MindSummary): boolean {
  return (mind.inputs ?? []).some((field) => {
    const n = field.name.toLowerCase();
    return n === "repo_id" || n === "repoid";
  });
}

/** Prefer minds that declare `repo_id`; fall back to other minds in the same project. */
export function pickCodeRepoMinds(minds: MindSummary[], projectId: string): MindSummary[] {
  const inProject = minds.filter((mind) => !mind.projectId || mind.projectId === projectId);
  const withRepo = inProject.filter(mindHasRepoInput);
  return withRepo.length > 0 ? withRepo : inProject;
}

/** True when a Mind is tagged/labeled for CodeFlo+ (suite filter). */
export function isCodefloTaggedMind(mind: MindSummary): boolean {
  return (mind.tags ?? []).some((tag) => {
    const t = tag.toLowerCase().replace(/\s+/g, "");
    return t.includes("codeflo") || t === "codeflo+" || t.includes("codeflo+");
  });
}

/** Deduped CodeFlo+-tagged minds from a flat list (e.g. my/access). */
export function listCodefloTaggedMinds(minds: MindSummary[]): MindSummary[] {
  const seen = new Set<string>();
  const out: MindSummary[] = [];
  for (const mind of minds) {
    if (!isCodefloTaggedMind(mind) || seen.has(mind.id)) continue;
    seen.add(mind.id);
    out.push(mind);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCodeRepoChatInputs(
  mind: MindSummary | null,
  repoId: string,
  branch: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of mind?.inputs ?? []) {
    if (isChatPromptInput(field.name)) continue;
    const n = field.name.toLowerCase();
    if (n === "repo_id" || n === "repoid") out[field.name] = repoId;
    else if (n === "branch") out[field.name] = branch;
  }
  if (!Object.keys(out).some((k) => k.toLowerCase() === "repo_id" || k.toLowerCase() === "repoid")) {
    out.repo_id = repoId;
  }
  if (branch && !Object.keys(out).some((k) => k.toLowerCase() === "branch")) {
    out.branch = branch;
  }
  return out;
}

export function codefloOperatorType(mind: MindSummary | null): "orchestrator" | "codeflo_chat" {
  return mind && mindHasRepoInput(mind) ? "codeflo_chat" : "orchestrator";
}

export type ChatFileRef = {
  path: string;
  name: string;
  kind?: "file" | "folder";
  fileCount?: number;
};

export type ChatTextBlock = {
  id: string;
  type: "text";
  content: string;
  streaming?: boolean;
};

export type ChatThinkingBlock = {
  id: string;
  type: "thinking";
  content: string;
  streaming?: boolean;
};

export type ChatToolBlock = {
  id: string;
  type: "tool";
  toolName: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
  inputSummary?: string;
  outputSummary?: string;
  status?: "running" | "success" | "error";
  streaming?: boolean;
};

export type ChatBlock = ChatTextBlock | ChatThinkingBlock | ChatToolBlock;

export interface StreamChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  createdAt: number;
  blocks?: ChatBlock[];
  attachments?: ChatFileRef[];
  meta?: { costUsd?: number; tokens?: number };
}

const TOOL_PATH_KEYS = ["file_path", "path", "filePath", "target_file", "filename", "file"] as const;

export function extractToolPath(args?: Record<string, unknown> | null): string | null {
  if (!args) return null;
  for (const key of TOOL_PATH_KEYS) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function extractToolDiff(args?: Record<string, unknown> | null): {
  oldString?: string;
  newString?: string;
  content?: string;
} {
  if (!args) return {};
  const asString = (value: unknown) => (typeof value === "string" ? value : undefined);
  return {
    oldString: asString(args.old_string) ?? asString(args.oldString),
    newString: asString(args.new_string) ?? asString(args.newString),
    content: asString(args.content) ?? asString(args.new_content) ?? asString(args.newContent),
  };
}

export function isFileMutatingTool(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("edit") ||
    n.includes("write") ||
    n.includes("strreplace") ||
    n.includes("apply_patch") ||
    n === "create"
  );
}

export type AttachedFileBody = { path: string; body: string };

export function formatAttachedPrompt(
  text: string,
  files: ChatFileRef[],
  bodies: AttachedFileBody[] = [],
): string {
  const folders = files.filter((file) => file.kind === "folder");
  const fileRows = files.filter((file) => file.kind !== "folder");
  if (fileRows.length === 0 && folders.length === 0 && bodies.length === 0) return text;
  const parts = [text];
  if (bodies.length > 0) {
    const blocks = bodies.map((row) => {
      const lang = row.path.includes(".") ? row.path.split(".").pop() ?? "" : "";
      return `### \`${row.path}\`\n\`\`\`${lang}\n${row.body}\n\`\`\``;
    });
    parts.push(`File contents:\n\n${blocks.join("\n\n")}`);
  }
  const inlined = new Set(bodies.map((row) => row.path));
  const listed = fileRows.filter((file) => !inlined.has(file.path));
  if (listed.length > 0) {
    parts.push(`Attached files:\n${listed.map((file) => `- \`${file.path}\``).join("\n")}`);
  }
  if (folders.length > 0) {
    parts.push(
      `Attached folders:\n${folders
        .map((folder) => {
          const count = folder.fileCount;
          const suffix = typeof count === "number" ? ` (${count} file${count === 1 ? "" : "s"})` : "";
          return `- \`${folder.path}\`${suffix}`;
        })
        .join("\n")}`,
    );
  }
  return parts.join("\n\n");
}

function pathBaseName(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const parts = trimmed.split("/");
  return parts[parts.length - 1] || trimmed;
}

/** Basenames that appear more than once in the repo index. */
export function collidingBasenames(files: Array<{ path: string; name?: string }>): Set<string> {
  const counts = new Map<string, number>();
  for (const file of files) {
    const name = (file.name || pathBaseName(file.path)).toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const colliding = new Set<string>();
  for (const [name, count] of counts) {
    if (count > 1) colliding.add(name);
  }
  return colliding;
}

/** `@index.ts` when unique, `@src/index.ts` when the basename collides. Folders always use the path. */
export function mentionAtToken(file: ChatFileRef, colliding: Set<string>): string {
  if (file.kind === "folder") return `@${file.path.replace(/\/+$/, "")}`;
  const name = file.name || pathBaseName(file.path);
  if (colliding.has(name.toLowerCase())) return `@${file.path}`;
  return `@${name}`;
}

export function foldersFromFileIndex(
  files: Array<{ path: string }>,
  query: string,
  limit: number,
): ChatFileRef[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    for (let i = 1; i < parts.length; i += 1) {
      const dir = parts.slice(0, i).join("/");
      counts.set(dir, (counts.get(dir) ?? 0) + 1);
    }
  }
  const q = query.trim().toLowerCase();
  const rank = (path: string) => {
    if (!q) return 0;
    const name = pathBaseName(path).toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.includes(q)) return 1;
    if (path.toLowerCase().includes(q)) return 2;
    return 3;
  };
  return [...counts.entries()]
    .filter(([path]) => {
      if (!q) return true;
      return path.toLowerCase().includes(q) || pathBaseName(path).toLowerCase().includes(q);
    })
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([path, fileCount]) => ({
      path,
      name: `${pathBaseName(path)}/`,
      kind: "folder" as const,
      fileCount,
    }));
}

export function formatTurnCost(meta?: { costUsd?: number; tokens?: number }): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (typeof meta.tokens === "number" && meta.tokens > 0) {
    parts.push(
      meta.tokens >= 1000
        ? `${(meta.tokens / 1000).toFixed(meta.tokens >= 10_000 ? 0 : 1)}k`
        : String(meta.tokens),
    );
  }
  if (typeof meta.costUsd === "number" && meta.costUsd > 0) {
    parts.push(`$${meta.costUsd.toFixed(meta.costUsd < 0.01 ? 4 : 3)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function readTurnCostMeta(
  parsed: Record<string, unknown>,
  current?: { costUsd?: number; tokens?: number },
): { costUsd?: number; tokens?: number } {
  const next = { ...current };
  if (typeof parsed.turn_cost_usd === "number") next.costUsd = parsed.turn_cost_usd;
  else if (typeof parsed.cost_usd === "number") next.costUsd = parsed.cost_usd;
  if (typeof parsed.turn_tokens === "number") next.tokens = parsed.turn_tokens;
  else if (typeof parsed.tokens_used === "number") next.tokens = parsed.tokens_used;
  return next;
}

export function formatSelectionBlock(selection: {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
}): string {
  return `Selection \`${selection.path}\` L${selection.startLine}–L${selection.endLine}\n\`\`\`\n${selection.text}\n\`\`\``;
}

export function assistantPlainText(message: StreamChatMessage): string {
  const texts = (message.blocks ?? [])
    .filter((block): block is ChatTextBlock => block.type === "text")
    .map((block) => block.content)
    .filter(Boolean);
  if (texts.length > 0) return texts.join("\n\n");
  return message.content;
}

function newBlockId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function patchAssistant(
  prev: StreamChatMessage[],
  patch: (msg: StreamChatMessage) => StreamChatMessage,
): StreamChatMessage[] {
  const next = [...prev];
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i]!.role === "assistant") {
      next[i] = patch(next[i]!);
      break;
    }
  }
  return next;
}

function finalizeLastText(blocks: ChatBlock[]): ChatBlock[] {
  if (blocks.length === 0) return blocks;
  const last = blocks[blocks.length - 1];
  if (!last || last.type !== "text" || !last.streaming) return blocks;
  const next = [...blocks];
  next[next.length - 1] = { ...last, streaming: false };
  return next;
}

function appendTextDelta(msg: StreamChatMessage, chunk: string): StreamChatMessage {
  const blocks = [...(msg.blocks ?? [])];
  const last = blocks[blocks.length - 1];
  if (last?.type === "text") {
    blocks[blocks.length - 1] = { ...last, content: last.content + chunk, streaming: true };
  } else {
    if (last?.type === "thinking" && last.streaming) {
      blocks[blocks.length - 1] = { ...last, streaming: false };
    }
    blocks.push({ id: newBlockId(), type: "text", content: chunk, streaming: true });
  }
  return { ...msg, content: msg.content + chunk, streaming: true, blocks };
}

function upsertToolBlock(msg: StreamChatMessage, parsed: Record<string, unknown>, eventName: string): StreamChatMessage {
  const toolCallId = String(parsed.tool_use_id ?? parsed.tool_call_id ?? "");
  const toolName = String(parsed.tool ?? parsed.tool_name ?? "tool");
  const input = asRecord(parsed.input ?? parsed.args);
  let blocks = finalizeLastText([...(msg.blocks ?? [])]);
  const index = toolCallId
    ? blocks.findIndex((block) => block.type === "tool" && block.toolCallId === toolCallId)
    : -1;

  if (eventName === "tool_use") {
    if (index >= 0) return { ...msg, blocks, streaming: true };
    blocks.push({
      id: newBlockId(),
      type: "tool",
      toolName,
      toolCallId: toolCallId || undefined,
      toolArgs: Object.keys(input).length ? input : undefined,
      status: "running",
      streaming: true,
    });
    return { ...msg, blocks, streaming: true };
  }

  if (eventName === "tool_invocation") {
    const inputSummary = String(parsed.input_summary ?? "");
    const patch: Partial<ChatToolBlock> = {
      inputSummary: inputSummary || undefined,
      toolArgs: Object.keys(input).length ? input : undefined,
      toolName,
    };
    if (index >= 0 && blocks[index]?.type === "tool") {
      const current = blocks[index]!;
      blocks[index] = {
        ...current,
        ...patch,
        toolArgs: patch.toolArgs ?? current.toolArgs,
        inputSummary: patch.inputSummary ?? current.inputSummary,
      };
    } else if (index < 0) {
      blocks.push({
        id: newBlockId(),
        type: "tool",
        toolName,
        toolCallId: toolCallId || undefined,
        toolArgs: patch.toolArgs,
        inputSummary: patch.inputSummary,
        status: "running",
        streaming: true,
      });
    }
    return { ...msg, blocks, streaming: true };
  }

  const status = parsed.status === "error" ? "error" : "success";
  const outputSummary = String(parsed.output_summary ?? parsed.output ?? parsed.error ?? "");
  if (index >= 0 && blocks[index]?.type === "tool") {
    const current = blocks[index]!;
    blocks[index] = {
      ...current,
      status,
      outputSummary: outputSummary || current.outputSummary,
      streaming: false,
      toolArgs: Object.keys(input).length ? input : current.toolArgs,
    };
  } else {
    blocks.push({
      id: newBlockId(),
      type: "tool",
      toolName,
      toolCallId: toolCallId || undefined,
      toolArgs: Object.keys(input).length ? input : undefined,
      outputSummary: outputSummary || undefined,
      status,
      streaming: false,
    });
  }
  return { ...msg, blocks, streaming: true };
}

function upsertThinking(msg: StreamChatMessage, parsed: Record<string, unknown>): StreamChatMessage {
  const chunk = String(parsed.chunk ?? parsed.text ?? parsed.content ?? parsed.thinking ?? "");
  const blocks = [...(msg.blocks ?? [])];
  const last = blocks[blocks.length - 1];
  if (last?.type === "thinking") {
    blocks[blocks.length - 1] = {
      ...last,
      content: chunk ? `${last.content}${chunk}` : last.content,
      streaming: true,
    };
  } else {
    if (last?.type === "text" && last.streaming) {
      blocks[blocks.length - 1] = { ...last, streaming: false };
    }
    blocks.push({
      id: newBlockId(),
      type: "thinking",
      content: chunk,
      streaming: true,
    });
  }
  return { ...msg, blocks, streaming: true };
}

function settleBlocks(blocks: ChatBlock[] | undefined): ChatBlock[] | undefined {
  if (!blocks?.length) return blocks;
  return blocks.map((block) => (block.streaming ? { ...block, streaming: false } : block));
}

/** Batch OpenAI content deltas onto the last assistant message via rAF. */
export function createCodeRepoChatStreamApplier(
  setMessages: Dispatch<SetStateAction<StreamChatMessage[]>>,
  onSessionId?: (id: string) => void,
) {
  let pending = "";
  let raf: number | null = null;
  let resumeSessionIdReported = false;

  const reportResumeSessionId = (id: string) => {
    if (!id || resumeSessionIdReported) return;
    resumeSessionIdReported = true;
    onSessionId?.(id);
  };

  const flush = () => {
    raf = null;
    if (!pending) return;
    const chunk = pending;
    pending = "";
    setMessages((prev) => patchAssistant(prev, (msg) => appendTextDelta(msg, chunk)));
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

  const finishStreaming = (extra?: Partial<StreamChatMessage>) => {
    flushNow();
    setMessages((prev) =>
      patchAssistant(prev, (msg) => ({
        ...msg,
        ...extra,
        content: msg.content.trim() ? msg.content : (extra?.content ?? msg.content),
        streaming: false,
        blocks: settleBlocks(extra?.blocks ?? msg.blocks),
        meta: extra?.meta ? { ...msg.meta, ...extra.meta } : msg.meta,
      })),
    );
  };

  const apply = (data: string, eventName: string | undefined) => {
    if (!data || data === "[DONE]") {
      finishStreaming();
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }

    // Prefer CodeFlo's stable memory_session_id for prior_session_id on turn 2+.
    if (typeof parsed.memory_session_id === "string" && parsed.memory_session_id) {
      reportResumeSessionId(parsed.memory_session_id);
    }

    if (eventName === "session_init" && typeof parsed.session_id === "string") {
      if (!resumeSessionIdReported) {
        onSessionId?.(parsed.session_id);
      }
      return;
    }

    if (eventName) flushNow();

    if (eventName === "turn_started") {
      if (typeof parsed.memory_session_id === "string" && parsed.memory_session_id) {
        resumeSessionIdReported = false;
        reportResumeSessionId(parsed.memory_session_id);
      }
      setMessages((prev) => patchAssistant(prev, (msg) => ({ ...msg, streaming: true })));
      return;
    }

    if (eventName === "turn_completed") {
      const reply = String(parsed.agent_reply ?? parsed.content ?? "");
      finishStreaming({
        ...(reply ? { content: reply } : {}),
        meta: readTurnCostMeta(parsed),
      });
      return;
    }

    if (eventName === "error") {
      const err = String(parsed.error ?? parsed.message ?? "Chat error");
      finishStreaming({ content: err });
      return;
    }

    if (eventName === "turn_cost") {
      setMessages((prev) =>
        patchAssistant(prev, (msg) => ({
          ...msg,
          meta: { ...msg.meta, ...readTurnCostMeta(parsed, msg.meta) },
        })),
      );
      return;
    }

    if (eventName === "thinking") {
      setMessages((prev) => patchAssistant(prev, (msg) => upsertThinking(msg, parsed)));
      return;
    }

    if (eventName === "tool_use" || eventName === "tool_invocation" || eventName === "tool_result") {
      setMessages((prev) => patchAssistant(prev, (msg) => upsertToolBlock(msg, parsed, eventName)));
      return;
    }

    const choice = Array.isArray(parsed.choices)
      ? (parsed.choices[0] as { delta?: { content?: string }; finish_reason?: string | null } | undefined)
      : undefined;
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta) {
      if (/^\n?\*[^*]+\*\n?$/.test(delta.trim()) || /^\*[^*]+\.\.\.\*$/.test(delta.trim())) {
        return;
      }
      queueDelta(delta);
    }
    if (choice?.finish_reason === "stop" || choice?.finish_reason === "length") {
      finishStreaming();
    }
  };

  return { apply, flushNow, finishStreaming };
}

const STORED_OUTPUT_CLIP = 8000;

export type StoredChatMessage = {
  role: string;
  content: string | unknown[];
};

function clipStoredText(text: string, max = STORED_OUTPUT_CLIP): string {
  return text.length > max ? `${text.slice(0, max)}\n…` : text;
}

function stringifyToolOutput(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return stringifyToolOutput(JSON.parse(trimmed));
      } catch {
        return raw;
      }
    }
    return raw;
  }
  if (typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    if (typeof rec.stdout === "string" || typeof rec.stderr === "string") {
      const parts: string[] = [];
      if (typeof rec.stdout === "string" && rec.stdout) parts.push(rec.stdout);
      if (typeof rec.stderr === "string" && rec.stderr) parts.push(rec.stderr);
      if (rec.exit_code != null && rec.exit_code !== 0) parts.push(`exit ${rec.exit_code}`);
      if (parts.length) return parts.join("\n");
    }
    if (typeof rec.output === "string") return rec.output;
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return String(raw);
    }
  }
  return String(raw);
}

function emptyChatMessage(role: "user" | "assistant"): StreamChatMessage {
  return { id: newBlockId(), role, content: "", createdAt: Date.now(), blocks: [] };
}

/** Fold stored Anthropic-style history (string or tool_use/tool_result lists)
 * into the transcript the live stream builds. Tool-result rows arrive as
 * role=user list content and must not become "You" bubbles. */
export function transcriptFromStoredMessages(rows: StoredChatMessage[]): StreamChatMessage[] {
  const out: StreamChatMessage[] = [];

  const lastAssistant = (): StreamChatMessage | undefined => {
    const last = out[out.length - 1];
    return last?.role === "assistant" ? last : undefined;
  };

  const ensureAssistant = (): StreamChatMessage => {
    const existing = lastAssistant();
    if (existing) return existing;
    const created = emptyChatMessage("assistant");
    out.push(created);
    return created;
  };

  const applyToolUse = (block: Record<string, unknown>) => {
    const asst = ensureAssistant();
    const blocks = [...(asst.blocks ?? [])];
    const toolCallId = String(block.id ?? "");
    if (toolCallId && blocks.some((row) => row.type === "tool" && row.toolCallId === toolCallId)) return;
    const input = asRecord(block.input);
    blocks.push({
      id: newBlockId(),
      type: "tool",
      toolName: String(block.name ?? "tool"),
      toolCallId: toolCallId || undefined,
      toolArgs: Object.keys(input).length ? input : undefined,
      status: "success",
      streaming: false,
    });
    asst.blocks = blocks;
  };

  const applyToolResult = (block: Record<string, unknown>) => {
    const asst = lastAssistant();
    if (!asst) return;
    const toolCallId = String(block.tool_use_id ?? "");
    const output = clipStoredText(stringifyToolOutput(block.content));
    const isError = Boolean(block.is_error);
    const blocks = [...(asst.blocks ?? [])];
    const index = toolCallId
      ? blocks.findIndex((row) => row.type === "tool" && row.toolCallId === toolCallId)
      : -1;
    if (index >= 0 && blocks[index]?.type === "tool") {
      const current = blocks[index]!;
      blocks[index] = {
        ...current,
        outputSummary: output || current.outputSummary,
        status: isError ? "error" : "success",
        streaming: false,
      };
    } else {
      blocks.push({
        id: newBlockId(),
        type: "tool",
        toolName: "tool",
        toolCallId: toolCallId || undefined,
        outputSummary: output || undefined,
        status: isError ? "error" : "success",
        streaming: false,
      });
    }
    asst.blocks = blocks;
  };

  const appendAssistantText = (text: string) => {
    const asst = ensureAssistant();
    asst.content = asst.content ? `${asst.content}\n${text}` : text;
    asst.blocks = [...(asst.blocks ?? []), { id: newBlockId(), type: "text", content: text }];
  };

  for (const row of rows) {
    const role = row.role === "agent" ? "assistant" : row.role;
    const content = row.content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== "object") continue;
        const block = item as Record<string, unknown>;
        const type = String(block.type ?? "");
        if (type === "tool_use") applyToolUse(block);
        else if (type === "tool_result") applyToolResult(block);
        else if (type === "text") {
          const text = String(block.text ?? block.content ?? "").trim();
          if (!text) continue;
          if (role === "user") out.push({ ...emptyChatMessage("user"), content: text, blocks: undefined });
          else appendAssistantText(text);
        }
      }
      continue;
    }
    if (typeof content !== "string" || !content.trim()) continue;
    if (role === "user") out.push({ ...emptyChatMessage("user"), content, blocks: undefined });
    else if (role === "assistant") appendAssistantText(content);
  }

  return out.filter((msg) => Boolean(msg.content.trim()) || Boolean(msg.blocks?.length));
}

export type { MindInputField };
