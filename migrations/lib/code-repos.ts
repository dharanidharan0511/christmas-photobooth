import type { CodeRepoFileResponse, CodeRepoFileView, CodeRepoListItem, CodeRepoType } from "@/types/codeRepos";

const REPO_TYPE_LABELS: Record<string, string> = {
  internal_gitlab: "Internal GitLab",
  private_gitlab: "Private GitLab",
  github: "GitHub",
  bitbucket: "Bitbucket",
};

export function repoTypeLabel(repoType: CodeRepoType): string {
  return REPO_TYPE_LABELS[repoType] ?? repoType;
}

const REPO_TYPE_TAG_CLASSES: Record<string, string> = {
  internal_gitlab: "bg-accent-soft text-accent-text",
  private_gitlab: "bg-surface-active text-mid",
  github: "bg-surface-active text-mid",
  bitbucket: "bg-surface-active text-mid",
};

export function repoTypeTagClass(repoType: CodeRepoType): string {
  return REPO_TYPE_TAG_CLASSES[repoType] ?? "bg-surface-active text-mid";
}

export function defaultBranchLabel(branch: string | null | undefined): string {
  return branch?.trim() || "main";
}

export function groupReposByProject(
  repos: CodeRepoListItem[],
): { projectId: string; projectName: string; repos: CodeRepoListItem[] }[] {
  const map = new Map<string, { projectName: string; repos: CodeRepoListItem[] }>();
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

export function resolveRepoBrowseSource(
  branch: string,
  defaultBranch: string,
  repo?: { edgeConnectorRef?: string | null } | null,
): { source: "workspace" | "git" | "vcs"; branch?: string } {
  // Match AI Studio: repos with a git connector browse the live remote VCS.
  if (repo?.edgeConnectorRef) {
    return { source: "vcs", branch: branch || defaultBranch };
  }
  if (branch === defaultBranch) {
    return { source: "workspace" };
  }
  return { source: "git", branch };
}

export function mapFileResponse(response: CodeRepoFileResponse | undefined): CodeRepoFileView | null {
  if (!response) return null;
  if (response.tooLarge) {
    return {
      encoding: "utf8",
      content: null,
      sizeBytes: response.sizeBytes ?? 0,
      tooLarge: true,
    };
  }
  if (!response.content || !response.encoding) return null;
  return {
    encoding: response.encoding,
    content: response.content,
    sizeBytes: response.sizeBytes ?? response.content.length,
  };
}
