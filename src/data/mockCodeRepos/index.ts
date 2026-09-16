import { BACKEND_FILES_BY_BRANCH, BACKEND_TREES_BY_BRANCH } from "./backendData";
import {
  getLocalBranches,
  getLocalFile,
  getLocalRepo,
  getLocalTree,
  isLocalCodeRepo,
} from "./localCodeRepos";
import { CODEFLO_FILES_BY_BRANCH, CODEFLO_TREES_BY_BRANCH } from "./codefloData";
import type { MockDirNode, MockTreeRoot } from "./helpers";
import type { MockCodeRepo, MockFileResult, MockTreeEntry, UserProjectScope } from "./types";
import { WEB_FILES_BY_BRANCH, WEB_TREES_BY_BRANCH } from "./webClientData";

export type { MockCodeRepo, MockFileResult, MockRepoType, MockTreeEntry, UserProjectScope } from "./types";

const REPO_TYPE_LABELS: Record<MockCodeRepo["repoType"], string> = {
  internal_gitlab: "Internal GitLab",
  private_gitlab: "Private GitLab",
  github: "GitHub",
  bitbucket: "Bitbucket",
};

export function repoTypeLabel(repoType: MockCodeRepo["repoType"]): string {
  return REPO_TYPE_LABELS[repoType] ?? repoType;
}

const REPO_TYPE_TAG_CLASSES: Record<MockCodeRepo["repoType"], string> = {
  internal_gitlab: "bg-accent-soft text-accent-text",
  private_gitlab: "bg-surface-active text-mid",
  github: "bg-surface-active text-mid",
  bitbucket: "bg-surface-active text-mid",
};

export function repoTypeTagClass(repoType: MockCodeRepo["repoType"]): string {
  return REPO_TYPE_TAG_CLASSES[repoType] ?? "bg-surface-active text-mid";
}

/** Canonical demo repos — admin / preview mode shows these as-is. */
export const MOCK_CODE_REPOS: MockCodeRepo[] = [
  {
    id: "mock-repo-backend-api",
    projectId: "demo-project-chat-bot",
    projectName: "Chat Bot",
    name: "backend-api",
    repoType: "internal_gitlab",
    description: "FastAPI services and shared utilities for the chat assistant.",
    defaultBranch: "main",
    branches: ["main", "develop"],
  },
  {
    id: "mock-repo-web-client",
    projectId: "demo-project-chat-bot",
    projectName: "Chat Bot",
    name: "web-client",
    repoType: "internal_gitlab",
    description: "React front-end for the chat experience.",
    defaultBranch: "main",
    branches: ["main", "staging"],
  },
  {
    id: "mock-repo-codeflo-samples",
    projectId: "demo-project-codeflo",
    projectName: "CodeFlo Demo",
    name: "codeflo-samples",
    repoType: "internal_gitlab",
    description: "Example minds and operator configs used in workshops.",
    defaultBranch: "develop",
    branches: ["develop", "main"],
  },
];

const MOCK_TREES_BY_BRANCH: Record<string, Record<string, MockTreeRoot>> = {
  "mock-repo-backend-api": BACKEND_TREES_BY_BRANCH,
  "mock-repo-web-client": WEB_TREES_BY_BRANCH,
  "mock-repo-codeflo-samples": CODEFLO_TREES_BY_BRANCH,
};

const MOCK_FILES_BY_BRANCH: Record<string, Record<string, Record<string, MockFileResult>>> = {
  "mock-repo-backend-api": BACKEND_FILES_BY_BRANCH,
  "mock-repo-web-client": WEB_FILES_BY_BRANCH,
  "mock-repo-codeflo-samples": CODEFLO_FILES_BY_BRANCH,
};

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function resolveDir(root: MockTreeRoot, relPath: string): MockDirNode | null {
  const parts = normalizePath(relPath).split("/").filter(Boolean);
  let current: MockTreeRoot | MockDirNode["children"] = root;
  for (const part of parts) {
    const node = current[part];
    if (!node || node.type !== "dir") return null;
    current = node.children;
  }
  return { type: "dir", children: current };
}

export function getMockRepo(repoId: string): MockCodeRepo | undefined {
  if (isLocalCodeRepo(repoId)) return getLocalRepo(repoId);
  return MOCK_CODE_REPOS.find((repo) => repo.id === repoId);
}

export function getMockBranches(repoId: string): string[] {
  if (isLocalCodeRepo(repoId)) return getLocalBranches(repoId);
  const repo = getMockRepo(repoId);
  return repo?.branches ?? [];
}

/** Normalize branch to one the mock dataset actually has. */
export function resolveMockBranch(repoId: string, branch: string | null | undefined): string {
  const repo = getMockRepo(repoId);
  if (!repo) return branch ?? "main";
  if (branch && repo.branches.includes(branch)) return branch;
  return repo.defaultBranch;
}

function treeForBranch(repoId: string, branch: string): MockTreeRoot | undefined {
  const repo = getMockRepo(repoId);
  const byBranch = MOCK_TREES_BY_BRANCH[repoId];
  if (!byBranch) return undefined;
  return byBranch[branch] ?? (repo ? byBranch[repo.defaultBranch] : undefined);
}

export function getMockTree(repoId: string, relPath = "", branch?: string): MockTreeEntry[] {
  if (isLocalCodeRepo(repoId)) return getLocalTree(repoId, relPath, branch);

  const resolvedBranch = resolveMockBranch(repoId, branch);
  const root = treeForBranch(repoId, resolvedBranch);
  if (!root) return [];

  const dir = relPath ? resolveDir(root, relPath) : { type: "dir" as const, children: root };
  if (!dir) return [];

  return Object.entries(dir.children)
    .map(([name, node]) => {
      const path = relPath ? `${normalizePath(relPath)}/${name}` : name;
      if (node.type === "dir") {
        return { name, path, type: "dir" as const };
      }
      return { name, path, type: "file" as const, sizeBytes: node.sizeBytes };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function getMockFile(repoId: string, relPath: string, branch?: string): MockFileResult | null {
  if (isLocalCodeRepo(repoId)) return getLocalFile(repoId, relPath, branch);

  const resolvedBranch = resolveMockBranch(repoId, branch);
  const path = normalizePath(relPath);
  const repo = getMockRepo(repoId);
  const byBranch = MOCK_FILES_BY_BRANCH[repoId];
  if (!byBranch) return null;

  const branchFile = byBranch[resolvedBranch]?.[path];
  if (branchFile) return branchFile;

  if (repo && resolvedBranch !== repo.defaultBranch) {
    return byBranch[repo.defaultBranch]?.[path] ?? null;
  }
  return null;
}

/** Map demo repos onto the signed-in user's Role projects so the list feels
 * scoped even though the file tree is still static sample content. */
export function scopeMockRepos(userProjects: UserProjectScope[], isAdmin: boolean): MockCodeRepo[] {
  if (isAdmin) return MOCK_CODE_REPOS;
  if (userProjects.length === 0) return [];

  return MOCK_CODE_REPOS.map((repo, index) => {
    const project = userProjects[index % userProjects.length];
    return {
      ...repo,
      projectId: project.projectId,
      projectName: project.projectName ?? project.projectId,
    };
  });
}

export { addLocalCodeRepo, isLocalCodeRepo, loadLocalCodeRepos, mergeReposForDisplay } from "./localCodeRepos";
export type { CreateCodeRepoInput } from "./localCodeRepos";

export function groupReposByProject(
  repos: MockCodeRepo[],
): { projectId: string; projectName: string; repos: MockCodeRepo[] }[] {
  const map = new Map<string, { projectName: string; repos: MockCodeRepo[] }>();
  for (const repo of repos) {
    const existing = map.get(repo.projectId);
    if (existing) {
      existing.repos.push(repo);
    } else {
      map.set(repo.projectId, { projectName: repo.projectName, repos: [repo] });
    }
  }
  return Array.from(map.entries()).map(([projectId, group]) => ({
    projectId,
    projectName: group.projectName,
    repos: group.repos,
  }));
}
