import hljs from "highlight.js";

/** Syntax-highlight a single line (line-numbered repo file viewer). */
export function highlightLineHtml(line: string, language: string): string {
  const lang = hljs.getLanguage(language) ? language : "plaintext";
  if (!line) return "\u00a0";
  try {
    return hljs.highlight(line, { language: lang }).value;
  } catch {
    return hljs.highlight(line, { language: "plaintext" }).value;
  }
}
