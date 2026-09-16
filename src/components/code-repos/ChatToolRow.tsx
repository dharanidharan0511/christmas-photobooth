import { useState } from "react";
import { ChevronDown, FileCode2, Loader2, Pencil, Search, Terminal, Wrench } from "lucide-react";
import {
  extractToolDiff,
  extractToolPath,
  type ChatThinkingBlock,
  type ChatToolBlock,
} from "../../lib/codeRepoChat";
import { fileBaseName, stripCodefloWorkspacePaths, toRepoRelativePath } from "../../lib/code-repo-file-utils";
import { cn } from "../../lib/utils";

const DIFF_MAX_CHARS = 2000;

function shellCommand(block: ChatToolBlock): string {
  const args = block.toolArgs;
  if (!args) return block.inputSummary ?? "";
  for (const key of ["command", "cmd", "script"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return block.inputSummary ?? "";
}

type ToolKind = "read" | "write" | "edit" | "search" | "shell" | "other";

const TOOL_TONE: Record<ToolKind, { bar: string; icon: string; label: string }> = {
  read: {
    bar: "border-sky-500",
    icon: "text-sky-600 dark:text-sky-400",
    label: "text-sky-700 dark:text-sky-300",
  },
  write: {
    bar: "border-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
    label: "text-emerald-700 dark:text-emerald-300",
  },
  edit: {
    bar: "border-amber-500",
    icon: "text-amber-600 dark:text-amber-400",
    label: "text-amber-700 dark:text-amber-300",
  },
  search: {
    bar: "border-violet-500",
    icon: "text-violet-600 dark:text-violet-400",
    label: "text-violet-700 dark:text-violet-300",
  },
  shell: {
    bar: "border-orange-500",
    icon: "text-orange-600 dark:text-orange-400",
    label: "text-orange-700 dark:text-orange-300",
  },
  other: {
    bar: "border-line-strong",
    icon: "text-light",
    label: "text-mid",
  },
};

function toolKind(name: string): ToolKind {
  const n = name.toLowerCase();
  if (n.includes("read") || n.includes("cat") || n === "open") return "read";
  if (n.includes("write") || n === "create") return "write";
  if (n.includes("edit") || n.includes("strreplace") || n.includes("apply_patch")) return "edit";
  if (n.includes("grep") || n.includes("glob") || n.includes("search") || n.includes("find")) return "search";
  if (n.includes("bash") || n.includes("shell") || n.includes("terminal") || n === "bash") return "shell";
  return "other";
}

function toolKindLabel(kind: ToolKind, fallback: string): string {
  if (kind === "read") return "Read";
  if (kind === "write") return "Wrote";
  if (kind === "edit") return "Edit";
  if (kind === "search") return "Search";
  if (kind === "shell") return "Bash";
  return fallback;
}

function ToolIcon({ kind, running }: { kind: ToolKind; running: boolean }) {
  if (running) return <Loader2 size={12} className={cn("shrink-0 animate-spin", TOOL_TONE[kind].icon)} />;
  const cls = cn("shrink-0", TOOL_TONE[kind].icon);
  if (kind === "read") return <FileCode2 size={12} className={cls} />;
  if (kind === "write" || kind === "edit") return <Pencil size={12} className={cls} />;
  if (kind === "search") return <Search size={12} className={cls} />;
  if (kind === "shell") return <Terminal size={12} className={cls} />;
  return <Wrench size={12} className={cls} />;
}

function DiffPreview({ label, text, tone }: { label: string; text: string; tone: "add" | "del" | "plain" }) {
  const clipped = text.length > DIFF_MAX_CHARS ? `${text.slice(0, DIFF_MAX_CHARS)}\n…` : text;
  const prefix = tone === "add" ? "+" : tone === "del" ? "-" : "";
  return (
    <div>
      <p className="mb-0.5 text-[10px] uppercase tracking-wide text-light">{label}</p>
      <pre
        className={cn(
          "max-h-28 overflow-auto whitespace-pre-wrap break-all rounded px-2 py-1 font-mono text-[10px] leading-relaxed",
          tone === "add" && "border border-emerald-500/15 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
          tone === "del" && "border border-red-500/15 bg-red-500/5 text-red-700 dark:text-red-400",
          tone === "plain" && "border border-line bg-bg text-mid",
        )}
      >
        {clipped
          .split("\n")
          .map((line) => (prefix ? `${prefix} ${line}` : line))
          .join("\n")}
      </pre>
    </div>
  );
}

export function ChatThinkingRow({ block }: { block: ChatThinkingBlock }) {
  const [open, setOpen] = useState(false);
  const hasBody = Boolean(block.content.trim());
  return (
    <div className="text-[11px] text-mid">
      <button
        type="button"
        disabled={!hasBody}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-1.5 py-0.5",
          hasBody ? "hover:text-ink" : "cursor-default",
        )}
      >
        {block.streaming ? <Loader2 size={11} className="animate-spin text-light" /> : null}
        <span>{block.streaming ? "Thinking" : "Thought"}</span>
        {hasBody ? (
          <ChevronDown size={10} className={cn("transition-transform", !open && "-rotate-90")} />
        ) : null}
      </button>
      {open && hasBody ? (
        <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded border border-line bg-bg px-2 py-1 text-[11px] text-light">
          {block.content}
        </p>
      ) : null}
    </div>
  );
}

export function ChatToolRow({
  block,
  onOpenFile,
}: {
  block: ChatToolBlock;
  onOpenFile?: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(() => {
    const kind = toolKind(block.toolName);
    const diff = extractToolDiff(block.toolArgs);
    return Boolean((kind === "edit" || kind === "write") && (diff.oldString || diff.newString || diff.content));
  });
  const rawPath = extractToolPath(block.toolArgs);
  const path = rawPath ? toRepoRelativePath(rawPath) : null;
  const diff = extractToolDiff(block.toolArgs);
  const kind = toolKind(block.toolName);
  const running = block.status === "running" || Boolean(block.streaming);
  const isError = block.status === "error";
  const command = kind === "shell" ? stripCodefloWorkspacePaths(shellCommand(block)) : "";
  const outputSummary = block.outputSummary ? stripCodefloWorkspacePaths(block.outputSummary) : "";
  const hasDiff = Boolean(diff.oldString || diff.newString || (kind === "write" && diff.content));
  const canExpand = Boolean(
    hasDiff ||
      block.outputSummary ||
      block.inputSummary ||
      command ||
      (block.toolArgs && Object.keys(block.toolArgs).length),
  );
  const label = toolKindLabel(kind, block.toolName);
  const detail =
    kind === "shell" && command
      ? command.split("\n")[0]
      : path
        ? fileBaseName(path)
        : "";
  const tone = TOOL_TONE[kind];

  return (
    <div className={cn("border-l-2 py-0.5 pl-2", isError ? "border-error" : tone.bar)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          disabled={!canExpand}
          onClick={() => canExpand && setExpanded((value) => !value)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left",
            canExpand ? "cursor-pointer" : "cursor-default",
          )}
        >
          <ToolIcon kind={kind} running={running} />
          <span className="min-w-0 truncate font-mono text-[11px]">
            <span className={cn("font-medium", isError ? "text-error" : tone.label)}>{label}</span>
            {detail ? <span className="text-mid"> · {detail}</span> : null}
          </span>
          {canExpand ? (
            <ChevronDown
              size={10}
              className={cn("shrink-0 text-light transition-transform", !expanded && "-rotate-90")}
            />
          ) : null}
        </button>
        {path && onOpenFile ? (
          <button
            type="button"
            title={kind === "edit" || kind === "write" ? `Peek in editor: ${path}` : `Open ${path}`}
            onClick={() => onOpenFile(path)}
            className="min-w-0 max-w-[55%] truncate text-right font-mono text-[10px] text-accent hover:underline"
          >
            {path}
          </button>
        ) : null}
      </div>
      {expanded && (
        <div className="mt-1.5 space-y-1.5">
          {path && !onOpenFile ? <p className="font-mono text-[10px] text-light">{path}</p> : null}
          {command ? <DiffPreview label="Command" text={command} tone="plain" /> : null}
          {hasDiff && (kind === "edit" || kind === "write") ? (
            <div className="space-y-1">
              {diff.oldString ? <DiffPreview label="Removed" text={diff.oldString} tone="del" /> : null}
              {diff.newString ? <DiffPreview label="Added" text={diff.newString} tone="add" /> : null}
              {!diff.newString && diff.content ? <DiffPreview label="Content" text={diff.content} tone="plain" /> : null}
            </div>
          ) : null}
          {block.outputSummary ? (
            <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded border border-line bg-bg px-2 py-1 font-mono text-[10px] text-mid">
              {outputSummary.length > DIFF_MAX_CHARS
                ? `${outputSummary.slice(0, DIFF_MAX_CHARS)}\n…`
                : outputSummary}
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
}
