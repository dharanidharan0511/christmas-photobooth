import { fileNode, filesFromContent, type MockTreeRoot } from "./helpers";
import type { MockCodeRepo, MockFileResult, MockTreeEntry } from "./types";

const STORAGE_KEY = "tp-web:local-code-repos";

export interface CreateCodeRepoInput {
  projectId: string;
  projectName: string;
  name: string;
  repoType: MockCodeRepo["repoType"];
  description?: string;
  defaultBranch: string;
  workingDirectory?: string;
}

interface StoredLocalRepo extends MockCodeRepo {
  branchFiles: Record<string, Record<string, string>>;
}

function readStore(): StoredLocalRepo[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredLocalRepo[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(repos: StoredLocalRepo[]): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
}

function treeFromBranchFiles(files: Record<string, string>): MockTreeRoot {
  const root: MockTreeRoot = {};
  for (const path of Object.keys(files)) {
    const parts = path.split("/");
    let current: MockTreeRoot = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!;
      const isFile = i === parts.length - 1;
      if (isFile) {
        current[part] = fileNode(files[path]!);
      } else {
        if (!current[part] || current[part].type !== "dir") {
          current[part] = { type: "dir", children: {} };
        }
        current = (current[part] as { type: "dir"; children: MockTreeRoot }).children;
      }
    }
  }
  return root;
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function resolveDir(root: MockTreeRoot, relPath: string) {
  const parts = normalizePath(relPath).split("/").filter(Boolean);
  let current: MockTreeRoot | Record<string, unknown> = root;
  for (const part of parts) {
    const node = current[part] as { type: string; children?: MockTreeRoot } | undefined;
    if (!node || node.type !== "dir") return null;
    current = node.children ?? {};
  }
  return { type: "dir" as const, children: current as MockTreeRoot };
}

export function isLocalCodeRepo(repoId: string): boolean {
  return repoId.startsWith("local-repo-");
}

export function loadLocalCodeRepos(): MockCodeRepo[] {
  return readStore().map(({ branchFiles: _bf, ...repo }) => repo);
}

export function addLocalCodeRepo(input: CreateCodeRepoInput): MockCodeRepo {
  const branch = input.defaultBranch.trim() || "main";
  const readme = `# ${input.name.trim()}

${input.description?.trim() || "Repository created in TP-Web preview mode."}

> Provider: \`${input.repoType}\`${input.workingDirectory ? `\n> Working directory: \`${input.workingDirectory}\`` : ""}

Engine \`/api/v2/code-repos\` wiring will replace this local preview entry.
`;

  const repo: StoredLocalRepo = {
    id: `local-repo-${crypto.randomUUID()}`,
    projectId: input.projectId,
    projectName: input.projectName,
    name: input.name.trim(),
    repoType: input.repoType,
    description: input.description?.trim() || null,
    defaultBranch: branch,
    branches: [branch],
    branchFiles: {
      [branch]: { "README.md": readme },
    },
  };

  const store = readStore();
  store.unshift(repo);
  writeStore(store);

  return repo;
}

function findStored(repoId: string): StoredLocalRepo | undefined {
  return readStore().find((repo) => repo.id === repoId);
}

export function getLocalRepo(repoId: string): MockCodeRepo | undefined {
  const stored = findStored(repoId);
  if (!stored) return undefined;
  const { branchFiles: _bf, ...repo } = stored;
  return repo;
}

export function getLocalBranches(repoId: string): string[] {
  const stored = findStored(repoId);
  return stored?.branches ?? [];
}

export function getLocalTree(repoId: string, relPath = "", branch?: string): MockTreeEntry[] {
  const stored = findStored(repoId);
  if (!stored) return [];

  const resolvedBranch = branch && stored.branches.includes(branch) ? branch : stored.defaultBranch;
  const files = stored.branchFiles[resolvedBranch] ?? stored.branchFiles[stored.defaultBranch] ?? {};
  const root = treeFromBranchFiles(files);

  const dir = relPath ? resolveDir(root, relPath) : { type: "dir" as const, children: root };
  if (!dir) return [];

  return Object.entries(dir.children)
    .map(([name, node]) => {
      const path = relPath ? `${normalizePath(relPath)}/${name}` : name;
      const entry = node as { type: string; sizeBytes?: number };
      if (entry.type === "dir") return { name, path, type: "dir" as const };
      return { name, path, type: "file" as const, sizeBytes: entry.sizeBytes };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function getLocalFile(repoId: string, relPath: string, branch?: string): MockFileResult | null {
  const stored = findStored(repoId);
  if (!stored) return null;

  const resolvedBranch = branch && stored.branches.includes(branch) ? branch : stored.defaultBranch;
  const files = stored.branchFiles[resolvedBranch] ?? stored.branchFiles[stored.defaultBranch];
  const content = files?.[normalizePath(relPath)];
  if (content == null) return null;
  return filesFromContent({ [normalizePath(relPath)]: content })[normalizePath(relPath)] ?? null;
}

export function mergeReposForDisplay(
  userProjects: { projectId: string; projectName?: string | null }[],
  isAdmin: boolean,
  baseRepos: MockCodeRepo[],
): MockCodeRepo[] {
  const local = loadLocalCodeRepos().filter((repo) => {
    if (isAdmin) return true;
    return userProjects.some((project) => project.projectId === repo.projectId);
  });
  return [...baseRepos, ...local];
}
