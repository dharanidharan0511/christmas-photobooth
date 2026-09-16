import { useEffect, useState } from "react";
import { Check, Copy, Folder, Pencil, RotateCcw, Sparkles } from "lucide-react";
import {
  extractToolPath,
  formatTurnCost,
  type ChatBlock,
  type ChatFileRef,
  type ChatToolBlock,
  type StreamChatMessage,
} from "../../lib/codeRepoChat";
import { fileBaseName, toRepoRelativePath } from "../../lib/code-repo-file-utils";
import { ChatMarkdown } from "./ChatMarkdown";
import { ChatThinkingRow, ChatToolRow } from "./ChatToolRow";

const IDLE_STATUS_LINES = [
  "Working on your request…",
  "Looking through the repository…",
  "Figuring out the next step…",
  "Putting a reply together…",
  "Checking the relevant files…",
  "Still working on this…",
];
const IDLE_STATUS_ROTATE_MS = 3200;

function toolActivityLine(block: ChatToolBlock): string {
  const raw = extractToolPath(block.toolArgs);
  const name = raw ? fileBaseName(toRepoRelativePath(raw)) : block.toolName;
  const running = block.status === "running" || Boolean(block.streaming);
  const n = block.toolName.toLowerCase();
  if (n.includes("read") || n.includes("cat") || n === "open") return running ? `Reading ${name}…` : `Read ${name}`;
  if (n.includes("edit") || n.includes("strreplace") || n.includes("apply_patch")) {
    return running ? `Editing ${name}…` : `Edited ${name}`;
  }
  if (n.includes("write") || n === "create") return running ? `Writing ${name}…` : `Wrote ${name}`;
  if (n.includes("grep") || n.includes("glob") || n.includes("search") || n.includes("find")) {
    return running ? "Searching the repository…" : "Searched the repository";
  }
  if (n.includes("bash") || n.includes("shell") || n.includes("terminal")) {
    return running ? "Running a command…" : "Ran a command";
  }
  return running ? `Using ${block.toolName}…` : `Used ${block.toolName}`;
}

function liveActivityLabel(blocks: ChatBlock[]): string | null {
  const lastTool = [...blocks].reverse().find((block): block is ChatToolBlock => block.type === "tool");
  if (lastTool && (lastTool.status === "running" || lastTool.streaming)) {
    return toolActivityLine(lastTool);
  }
  return null;
}

function AssistantLoader({ activityLabel }: { activityLabel: string | null }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (activityLabel) return;
    const id = window.setInterval(() => setTick((n) => n + 1), IDLE_STATUS_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [activityLabel]);

  const label = activityLabel ?? IDLE_STATUS_LINES[tick % IDLE_STATUS_LINES.length];

  return (
    <div className="flex items-center gap-2.5 py-0.5" role="status" aria-live="polite" aria-label={label}>
      <div className="chat-assistant-loader" aria-hidden />
      <p className="min-w-0 text-xs leading-snug text-mid">{label}</p>
    </div>
  );
}

function AssistantBlocks({
  blocks,
  fallback,
  streaming,
  onOpenFile,
}: {
  blocks: ChatBlock[];
  fallback: string;
  streaming?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const hasRenderable = blocks.some((block) => {
    if (block.type === "text") return Boolean(block.content);
    if (block.type === "thinking") return true;
    return true;
  });

  if (!hasRenderable) {
    if (streaming) return null;
    if (fallback) {
      return <ChatMarkdown content={fallback} onOpenFile={onOpenFile} />;
    }
    return null;
  }

  const lastTextIndex = [...blocks].reverse().findIndex((block) => block.type === "text");
  const lastTextAbs = lastTextIndex >= 0 ? blocks.length - 1 - lastTextIndex : -1;

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "thinking") return <ChatThinkingRow key={block.id} block={block} />;
        if (block.type === "tool") return <ChatToolRow key={block.id} block={block} onOpenFile={onOpenFile} />;
        const showCursor = Boolean(streaming && index === lastTextAbs);
        return (
          <ChatMarkdown
            key={block.id}
            content={block.content}
            streaming={showCursor}
            onOpenFile={onOpenFile}
          />
        );
      })}
    </div>
  );
}

function CopyReplyButton({ onCopy, label = "Copy" }: { onCopy: () => void; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <button
      type="button"
      title={copied ? "Copied" : label}
      onClick={() => {
        onCopy();
        setCopied(true);
      }}
      className={
        copied
          ? "inline-flex items-center gap-1 rounded p-0.5 text-accent"
          : "rounded p-0.5 text-light hover:bg-surface-hover hover:text-ink"
      }
    >
      {copied ? (
        <>
          <Check size={11} strokeWidth={2} className="chat-copy-pop" />
          <span className="chat-copy-pop text-[10px] font-medium">Copied</span>
        </>
      ) : (
        <Copy size={11} strokeWidth={1.75} />
      )}
    </button>
  );
}

export function ChatTurn({
  message,
  onOpenFile,
  onCopy,
  onRetry,
  onEdit,
  showRetry = false,
  showEdit = false,
}: {
  message: StreamChatMessage;
  onOpenFile?: (path: string) => void;
  onCopy?: () => void;
  onRetry?: () => void;
  onEdit?: () => void;
  showRetry?: boolean;
  showEdit?: boolean;
}) {
  const isUser = message.role === "user";
  const attachments = message.attachments ?? [];

  if (isUser) {
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-light">You</p>
        <div className="w-full rounded-xl border border-line bg-bg-subtle px-3 py-2.5">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {attachments.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  title={file.path}
                  onClick={() => {
                    if (file.kind === "folder") return;
                    onOpenFile?.(file.path.split("#")[0] ?? file.path);
                  }}
                  className="max-w-full truncate rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-mid hover:text-ink"
                >
                  {file.kind === "folder" ? `${file.name || fileBaseName(file.path)}` : file.name || fileBaseName(file.path)}
                </button>
              ))}
            </div>
          )}
          {message.content ? (
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{message.content}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          {onCopy ? <CopyReplyButton onCopy={onCopy} label="Copy message" /> : null}
          {showEdit && onEdit ? (
            <button
              type="button"
              title="Edit and resend"
              onClick={onEdit}
              className="rounded p-0.5 text-light hover:bg-surface-hover hover:text-ink"
            >
              <Pencil size={11} strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const waitingForReply =
    Boolean(message.streaming) &&
    !message.content.trim() &&
    !(message.blocks ?? []).some((block) => block.type === "text" && block.content);
  const costLabel = formatTurnCost(message.meta);

  return (
    <div className="space-y-1.5">
      <p className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-light">
        <Sparkles size={10} strokeWidth={1.75} />
        Assistant
      </p>
      <div className="space-y-2">
        {waitingForReply ? <AssistantLoader activityLabel={liveActivityLabel(message.blocks ?? [])} /> : null}
        <AssistantBlocks
          blocks={message.blocks ?? []}
          fallback={message.content}
          streaming={message.streaming}
          onOpenFile={onOpenFile}
        />
        {!message.streaming && (costLabel || onCopy || (showRetry && onRetry)) ? (
          <div className="flex items-center gap-1.5">
            {onCopy ? <CopyReplyButton onCopy={onCopy} label="Copy reply" /> : null}
            {showRetry && onRetry ? (
              <button
                type="button"
                title="Retry last turn"
                onClick={onRetry}
                className="rounded p-0.5 text-light hover:bg-surface-hover hover:text-ink"
              >
                <RotateCcw size={11} strokeWidth={1.75} />
              </button>
            ) : null}
            {costLabel ? <p className="text-[10px] tabular-nums text-light">{costLabel}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FileChip({
  file,
  onRemove,
  onOpen,
}: {
  file: ChatFileRef;
  onRemove?: () => void;
  onOpen?: () => void;
}) {
  const isFolder = file.kind === "folder";
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-mid">
      {isFolder ? <Folder size={10} strokeWidth={1.75} className="shrink-0 text-light" /> : null}
      <button
        type="button"
        title={file.path}
        onClick={onOpen}
        className="min-w-0 truncate hover:text-ink"
      >
        {file.name || fileBaseName(file.path)}
      </button>
      {onRemove ? (
        <button type="button" title={isFolder ? "Remove folder" : "Remove file"} onClick={onRemove} className="text-light hover:text-ink">
          ×
        </button>
      ) : null}
    </span>
  );
}
