import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FileCode2, Loader2, MessageSquarePlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { highlightLineHtml } from "../../lib/code-repo-line-highlight";
import { fileBaseName, formatFileSize, getLanguage, isMarkdownFile } from "../../lib/code-repo-file-utils";
import type { CodeRepoFileView } from "../../types/codeRepos";

export type EditorTextSelection = {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
};

interface CodeFileViewerProps {
  path: string | null;
  file: CodeRepoFileView | null;
  previewMode?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  onSelectionChange?: (selection: EditorTextSelection | null) => void;
  onAddSelection?: (selection: EditorTextSelection) => void;
}

function positionFromRange(root: HTMLElement, range: Range): { top: number; left: number } {
  const rangeRect = range.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const buttonWidth = 118;
  const buttonHeight = 32;
  let top = rangeRect.top - rootRect.top + root.scrollTop - buttonHeight - 6;
  if (top < root.scrollTop + 4) {
    top = rangeRect.bottom - rootRect.top + root.scrollTop + 6;
  }
  let left = rangeRect.left - rootRect.left + root.scrollLeft;
  const maxLeft = Math.max(8, root.clientWidth - buttonWidth - 8);
  left = Math.max(8, Math.min(left, maxLeft + root.scrollLeft));
  return { top, left };
}

function lineNumberFromNode(node: Node | null): number | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement && current.dataset.line) {
      const n = Number(current.dataset.line);
      return Number.isFinite(n) ? n : null;
    }
    current = current.parentNode;
  }
  return null;
}

function PanelShell({
  children,
  tone = "content",
}: {
  children: ReactNode;
  /** `paper` when idle / no file; `content` (paper cream) when showing file body. */
  tone?: "paper" | "content";
}) {
  return (
    <div
      className={
        tone === "paper"
          ? "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg"
          : "repo-file-viewer flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
      }
    >
      {children}
    </div>
  );
}

export function CodeFileViewer({
  path,
  file,
  previewMode = false,
  isLoading = false,
  errorMessage = null,
  onSelectionChange,
  onAddSelection,
}: CodeFileViewerProps) {
  const fileName = path ? fileBaseName(path) : "";
  const language = path ? getLanguage(fileName) : "plaintext";
  const content = file?.encoding === "utf8" ? file.content : null;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);
  const [popover, setPopover] = useState<{
    selection: EditorTextSelection;
    top: number;
    left: number;
    added?: boolean;
  } | null>(null);

  const lines = useMemo(() => {
    if (!content || previewMode) return [];
    return content.split("\n");
  }, [content, previewMode]);

  const lineHtmlList = useMemo(() => {
    if (!content || previewMode) return [];
    return lines.map((line) => highlightLineHtml(line, language));
  }, [content, lines, language, previewMode]);

  const clearPopover = useCallback(() => {
    rangeRef.current = null;
    setPopover(null);
  }, []);

  useEffect(() => {
    onSelectionChangeRef.current?.(null);
    clearPopover();
  }, [clearPopover, path]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !popover || popover.added) return;
    const sync = () => {
      const range = rangeRef.current;
      if (!range || range.collapsed) {
        clearPopover();
        return;
      }
      setPopover((prev) => (prev ? { ...prev, ...positionFromRange(root, range) } : prev));
    };
    root.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      root.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [clearPopover, popover?.added, popover?.selection]);

  if (!path) {
    return (
      <PanelShell tone="paper">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-mid">
          <FileCode2 size={32} strokeWidth={1} className="text-light" />
          <p className="text-sm">Select a file to view its contents</p>
        </div>
      </PanelShell>
    );
  }

  if (isLoading) {
    return (
      <PanelShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-mid">
          <Loader2 size={20} className="animate-spin text-light" />
          <p className="text-sm">Loading file…</p>
        </div>
      </PanelShell>
    );
  }

  if (errorMessage) {
    return (
      <PanelShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-mid">
          <FileCode2 size={24} strokeWidth={1} className="text-light" />
          <p className="text-sm">{errorMessage}</p>
          <p className="max-w-sm font-mono text-xs text-light">{path}</p>
        </div>
      </PanelShell>
    );
  }

  if (!file) {
    return (
      <PanelShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-mid">
          <FileCode2 size={24} strokeWidth={1} className="text-light" />
          <p className="text-sm">File not found</p>
          <p className="max-w-sm text-center font-mono text-xs text-light">{path}</p>
        </div>
      </PanelShell>
    );
  }

  if (file.tooLarge) {
    return (
      <PanelShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-mid">
          <FileCode2 size={24} strokeWidth={1} className="text-light" />
          <p className="text-sm">File is too large to preview</p>
          <p className="text-xs text-light">{formatFileSize(file.sizeBytes)}</p>
        </div>
      </PanelShell>
    );
  }

  if (file.encoding === "base64") {
    return (
      <PanelShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-mid">
          <FileCode2 size={24} strokeWidth={1} className="text-light" />
          <p className="text-sm">Binary file — use download instead</p>
          <p className="text-xs text-light">{formatFileSize(file.sizeBytes)}</p>
        </div>
      </PanelShell>
    );
  }

  if (content == null) {
    return (
      <PanelShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-mid">
          <p className="text-sm">File not found</p>
        </div>
      </PanelShell>
    );
  }

  if (content.length === 0) {
    return (
      <PanelShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-mid">
          <p className="text-sm">File is empty</p>
        </div>
      </PanelShell>
    );
  }

  if (previewMode && isMarkdownFile(fileName)) {
    return (
      <PanelShell>
        <div className="repo-markdown-preview min-h-0 flex-1 overflow-auto p-6">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <div
        ref={scrollRef}
        className="repo-file-viewer relative min-h-0 flex-1 overflow-auto"
        onMouseUp={(event) => {
          if (!onSelectionChange || !path) return;
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed || !sel.rangeCount) {
            onSelectionChange(null);
            clearPopover();
            return;
          }
          const range = sel.getRangeAt(0);
          const root = event.currentTarget;
          if (!root.contains(range.commonAncestorContainer)) {
            onSelectionChange(null);
            clearPopover();
            return;
          }
          const startLine = lineNumberFromNode(range.startContainer);
          const endLine = lineNumberFromNode(range.endContainer);
          const text = sel.toString().replace(/\u00a0/g, " ");
          if (startLine == null || endLine == null || !text.trim()) {
            onSelectionChange(null);
            clearPopover();
            return;
          }
          const selection = {
            path,
            startLine: Math.min(startLine, endLine),
            endLine: Math.max(startLine, endLine),
            text,
          };
          onSelectionChange(selection);
          if (onAddSelection) {
            rangeRef.current = range.cloneRange();
            setPopover({ selection, ...positionFromRange(root, range) });
          }
        }}
      >
        <div className="flex min-h-full">
          <div className="select-none shrink-0 border-r border-line-subtle bg-bg-subtle/60 px-3 py-2 text-right">
            {lines.map((_, index) => (
              <div key={index} className="font-mono text-xs leading-relaxed text-light">
                {index + 1}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <pre className="m-0 bg-transparent p-2 font-mono text-xs leading-relaxed">
              <code className={`language-${language} hljs`}>
                {lineHtmlList.map((html, index) => (
                  <span
                    key={index}
                    data-line={index + 1}
                    className="block leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ))}
              </code>
            </pre>
          </div>
        </div>
        {popover && onAddSelection ? (
          <button
            type="button"
            style={{ top: popover.top, left: popover.left }}
            onMouseDown={(event) => event.preventDefault()}
            onMouseUp={(event) => event.stopPropagation()}
            onClick={() => {
              onAddSelection(popover.selection);
              setPopover((prev) => (prev ? { ...prev, added: true } : prev));
              window.setTimeout(() => clearPopover(), 900);
            }}
            className="absolute z-20 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-ink shadow-card hover:bg-surface-hover"
          >
            <MessageSquarePlus size={12} strokeWidth={1.75} />
            {popover.added ? "Added" : "Add to chat"}
          </button>
        ) : null}
      </div>
    </PanelShell>
  );
}

export function getFileTextContent(file: CodeRepoFileView | null): string | null {
  if (!file || file.encoding !== "utf8" || file.tooLarge) return null;
  return file.content;
}

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
