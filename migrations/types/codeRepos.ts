export type CodeRepoType = "internal_gitlab" | "private_gitlab" | "github" | "bitbucket" | string;

export interface CodeRepo {
  id: string;
  projectId: string;
  workspaceId: string;
  repoType: CodeRepoType;
  name: string;
  description: string | null;
  defaultBranch: string | null;
  gitlabProjectId?: number | null;
  gitlabUrl?: string | null;
  githubRepoFullName?: string | null;
  bitbucketRepoFullName?: string | null;
  bitbucketEmail?: string | null;
  edgeConnectorRef?: string | null;
  clonePath?: string | null;
  workingDirectory?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CodeRepoListItem extends CodeRepo {
  projectName: string;
}

export interface CodeRepoTreeEntry {
  name: string;
  path: string;
  type: "dir" | "file";
  sizeBytes?: number | null;
}

export interface CodeRepoTreeResponse {
  source: "workspace" | "git" | "vcs" | string;
  path: string;
  entries: CodeRepoTreeEntry[];
  truncated?: boolean;
  nextCursor?: string | null;
}

export interface CodeRepoBranch {
  name: string;
  isDefault: boolean;
}

export interface CodeRepoFileResponse {
  source: "workspace" | "git" | "vcs" | string;
  path: string;
  encoding?: "utf8" | "base64";
  content?: string;
  sizeBytes?: number;
  tooLarge?: boolean;
}

/** Normalized file payload for the viewer component. */
export interface CodeRepoFileView {
  encoding: "utf8" | "base64";
  content: string | null;
  sizeBytes: number;
  tooLarge?: boolean;
}

export interface CreateCodeRepoInput {
  projectId: string;
  name: string;
  repoType: CodeRepoType;
  description?: string;
  defaultBranch?: string;
  workingDirectory?: string;
  gitlabUrl?: string;
  gitlabAccessToken?: string;
  githubRepoFullName?: string;
  githubAccessToken?: string;
  bitbucketRepoFullName?: string;
  bitbucketEmail?: string;
  bitbucketAccessToken?: string;
}
