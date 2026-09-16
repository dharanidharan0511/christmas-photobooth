import { useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import hljs from "highlight.js";
import { toRepoRelativePath } from "../../lib/code-repo-file-utils";
import { cn } from "../../lib/utils";

const PATH_RE = /^[A-Za-z0-9_./@+-]+$/;

function looksLikeRepoPath(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 240) return false;
  if (text.includes("://") || text.startsWith("#") || text.startsWith("mailto:")) return false;
  if (!PATH_RE.test(text)) return false;
  if (text.startsWith(".") && !text.startsWith("./") && !text.startsWith("../")) return false;
  return text.includes("/") || /\.[A-Za-z0-9]{1,12}$/.test(text);
}

function highlightBlock(code: string, language: string): string {
  try {
    const lang = hljs.getLanguage(language) ? language : "plaintext";
    return hljs.highlight(code, { language: lang }).value;
  } catch {
    return hljs.highlight(code, { language: "plaintext" }).value;
  }
}

export function ChatMarkdown({
  content,
  streaming = false,
  onOpenFile,
}: {
  content: string;
  streaming?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const components = useMemo(
    () => ({
      code({ className, children }: { className?: string; children?: ReactNode }) {
        const text = String(children ?? "").replace(/\n$/, "");
        const language = /language-(\w+)/.exec(className ?? "")?.[1];
        if (language) {
          return (
            <code
              className={`language-${language} hljs`}
              dangerouslySetInnerHTML={{ __html: highlightBlock(text, language) }}
            />
          );
        }
        if (onOpenFile && looksLikeRepoPath(text)) {
          const repoPath = toRepoRelativePath(text);
          return (
            <button
              type="button"
              title={`Open ${repoPath}`}
              onClick={() => onOpenFile(repoPath)}
              className="rounded-sm bg-surface-hover px-1 py-0.5 font-mono text-[0.92em] text-accent hover:underline"
            >
              {repoPath}
            </button>
          );
        }
        return <code className={className}>{children}</code>;
      },
    }),
    [onOpenFile],
  );

  if (!content && streaming) return null;

  return (
    <div className={cn("chat-markdown text-sm text-ink", streaming && "opacity-95")}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
      {streaming ? (
        <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-pulse bg-current align-baseline" />
      ) : null}
    </div>
  );
}
