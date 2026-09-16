export type MockRepoType = "internal_gitlab" | "private_gitlab" | "github" | "bitbucket";

export interface MockCodeRepo {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  repoType: MockRepoType;
  description: string | null;
  defaultBranch: string;
  branches: string[];
}

export interface MockTreeEntry {
  name: string;
  path: string;
  type: "dir" | "file";
  sizeBytes?: number;
}

export interface MockFileResult {
  encoding: "utf8" | "base64";
  content: string;
  sizeBytes: number;
}

export interface UserProjectScope {
  projectId: string;
  projectName?: string | null;
}
