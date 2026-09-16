const EXT_LANG_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  go: "go",
  rs: "rust",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  css: "css",
  html: "html",
  xml: "xml",
  md: "markdown",
  mdx: "markdown",
  sql: "sql",
  java: "java",
  cpp: "cpp",
  c: "cpp",
  h: "cpp",
  hpp: "cpp",
  cs: "csharp",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  vue: "xml",
  scss: "scss",
  less: "less",
  toml: "ini",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  dockerfile: "dockerfile",
  env: "plaintext",
  log: "plaintext",
  txt: "plaintext",
};

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif",
  "pdf", "zip", "tar", "gz", "rar", "7z",
  "exe", "dll", "so", "dylib",
  "mp4", "avi", "mov", "mkv", "mp3", "wav",
  "woff", "woff2", "ttf", "eot", "otf",
]);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getLanguage(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  if (base === "Dockerfile" || base.startsWith("Dockerfile.")) return "dockerfile";
  const ext = base.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANG_MAP[ext] ?? "plaintext";
}

export function isMarkdownFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext === "md" || ext === "mdx";
}

export function isPreviewableFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ["md", "mdx", "html", "htm"].includes(ext);
}

export function isBinaryFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return BINARY_EXTENSIONS.has(ext);
}

export function fileBaseName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Drop the engine workspace prefix `/mnt/codeflo/{repo-id}/` so the UI
 * shows the path inside the repo (`src/app.ts`), not the disk location. */
const CODEFLO_WORKSPACE_ID =
  "mnt/codeflo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CODEFLO_WORKSPACE_PREFIX = new RegExp(`^(?:/)?${CODEFLO_WORKSPACE_ID}/?`, "i");

export function toRepoRelativePath(path: string): string {
  const trimmed = path.trim().replace(/\\/g, "/");
  const stripped = trimmed.replace(CODEFLO_WORKSPACE_PREFIX, "").replace(/^\/+/, "");
  return stripped || trimmed;
}

/** Strip `/mnt/codeflo/{id}/` anywhere in free text (bash commands, output). */
export function stripCodefloWorkspacePaths(text: string): string {
  return text
    .replace(/\\/g, "/")
    .replace(new RegExp(`(?:/)?${CODEFLO_WORKSPACE_ID}/`, "gi"), "")
    .replace(new RegExp(`(?:/)?${CODEFLO_WORKSPACE_ID}(?=\\s|$)`, "gi"), ".")
    .replace(/[ \t]{2,}/g, " ");
}
