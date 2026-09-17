// ─────────────────────────────────────────────────────────────────────────
// HARD PROJECT RULE — read this before adding any network call anywhere in
// this app (AI Studio Enterprise, Next.js 15 edition).
//
// This file is the ONLY module in this project allowed to call fetch/axios/
// XMLHttpRequest/etc. Every screen, hook, and component MUST import its data
// functions from here instead of talking to the network directly.
//
// SECURITY NOTE (SEC-C-001 FIXED):
// Unlike the Vite version, this client NEVER exposes ENGINE_URL to the browser.
// All requests are routed through Next.js Route Handlers (/api/engine/...)
// which proxy to ENGINE_URL server-side. ENGINE_URL is a server-only env var
// (no NEXT_PUBLIC_ prefix). The browser sees all engine traffic as same-origin
// (/api/engine/...) — no CORS, no URL leakage, no bearer tokens in JS bundles.
// ─────────────────────────────────────────────────────────────────────────

import type { AuditEntry, AuthMode, EngineRole, EngineUser, MindSummary, ProjectAccess, SessionDetail, SessionSummary, SpendCap, TopupRequestResult, WhoAmI } from "@/types/engine";
import type {
  CodeRepo,
  CodeRepoBranch,
  CodeRepoFileResponse,
  CodeRepoTreeEntry,
  CodeRepoTreeResponse,
  CreateCodeRepoInput,
} from "@/types/codeRepos";

/**
 * Client-side engine base path.
 *
 * All requests go through /api/engine/... (Next.js Route Handler proxy).
 * The actual ENGINE_URL is server-only and never touches the browser bundle.
 */
const ENGINE_PROXY_BASE = "/api/engine";

// ── Admin key (fallback auth mode) ─────────────────────────────────────────
// Stored in sessionStorage (NOT localStorage) — it's a real bearer credential
// for the engine's admin endpoints and should not survive a browser restart.
// SEC-H-001: The admin key is also stored as an HttpOnly cookie server-side
// via /api/auth/admin-key for the Route Handler proxy to read.
const ADMIN_KEY_STORAGE_KEY = "tp-web:admin-key";

export function getAdminKey(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminKey(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
}

export function clearAdminKey(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
}

export function currentAuthMode(): AuthMode {
  return getAdminKey() ? "key" : "cookie";
}

// ── Error type ──────────────────────────────────────────────────────────
function engineErrorMessageFromBody(status: number, body: unknown): string {
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object") {
    const rec = detail as { message?: unknown; reason?: unknown };
    if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
    if (rec.reason === "file_too_large") return "File is too large to upload.";
    if (rec.reason === "no_connector") return "This repository has no VCS connector configured.";
    if (rec.reason === "empty_upload") return "That file (or zip) had nothing to upload.";
    if (typeof rec.reason === "string" && rec.reason.trim()) return rec.reason;
  }
  if (status === 402) {
    return "The workspace credit pool is empty. An admin must top up the workspace owner — raising a personal spend cap will not help.";
  }
  return `Engine request failed with status ${status}`;
}

export class EngineApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? engineErrorMessageFromBody(status, body));
    this.name = "EngineApiError";
    this.status = status;
    this.body = body;
  }

  /** True when the engine rejected the request because the signed-in
   * identity is authenticated but not on the admin allow-list. */
  get isNotAdmin(): boolean {
    if (this.status !== 403) return false;
    const body = this.body as { detail?: { code?: string } } | undefined;
    return body?.detail?.code === "NOT_AN_ADMIN";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

async function parseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    return await res.text();
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  body?: unknown;
  /** Extra headers merged onto the request. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * Default `include` (SSO cookie). Pass `omit` only for share-key-only
   * listing (`GET /minds`) so a present identity cookie does not force the
   * Role entitlement gate.
   */
  credentials?: RequestCredentials;
}

/**
 * Low-level request through the Next.js proxy (/api/engine/...).
 * ENGINE_URL lives only in the server environment — never in the browser.
 */
async function engineRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  // Route through the Next.js Route Handler proxy.
  // Trim the leading slash from path since ENGINE_PROXY_BASE ends without one.
  const proxyPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${ENGINE_PROXY_BASE}${proxyPath}`;
  const headers = new Headers();
  const credentials = opts.credentials ?? "include";
  const adminKey = credentials === "include" ? getAdminKey() : null;
  if (adminKey) {
    headers.set("x-admin-key", adminKey);
  }
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    headers.set(k, v);
  }
  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      credentials,
      body:
        opts.body === undefined
          ? undefined
          : isFormData
            ? (opts.body as FormData)
            : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new EngineApiError(
      0,
      { message: String(err) },
      "Could not reach the engine proxy. Is the Next.js server running?",
    );
  }

  if (!res.ok) {
    const body = await parseBody(res);
    throw new EngineApiError(res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// ── /user/whoami ────────────────────────────────────────────────────────
/**
 * Returns the signed-in identity from the SSO cookie, or null if there is
 * no valid session (engine returns 401 — expected "signed out" state).
 */
export async function fetchWhoAmI(signal?: AbortSignal): Promise<WhoAmI | null> {
  const res = await fetch(`${ENGINE_PROXY_BASE}/user/whoami`, { credentials: "include", signal });
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    const body = await parseBody(res);
    throw new EngineApiError(res.status, body);
  }
  return (await res.json()) as WhoAmI;
}

/**
 * Full-page navigation (NOT a fetch) to kick off the IdP redirect.
 * The redirect_uri points back to this Next.js app's origin so the engine
 * sends the browser here after SSO. basePath is read from the meta tag
 * set by the root layout (for sub-path deployments).
 */
export function goToSsoLogin(): void {
  const basePath =
    typeof document !== "undefined"
      ? (document.querySelector<HTMLMetaElement>('meta[name="base-path"]')?.content ?? "")
      : "";
  const redirectUri = encodeURIComponent(`${window.location.origin}${basePath}`);
  // The proxy forwards to ENGINE_URL/user/login; we just need /api/engine/user/login
  window.location.href = `/api/engine/user/login?redirect_uri=${redirectUri}&_passthrough=1`;
}

/** Password login — calls /api/engine/user/login/password (proxied server-side). */
export async function loginWithPassword(email: string, password: string): Promise<void> {
  await engineRequest<{ ok: true }>("/user/login/password", {
    method: "POST",
    body: { email, password },
  });
}

// ── Admin: users ────────────────────────────────────────────────────────
export async function listUsers(signal?: AbortSignal): Promise<EngineUser[]> {
  const data = await engineRequest<{ users: EngineUser[] }>("/api/v1/admin/user-module/users", { signal });
  return data.users;
}

export async function listUserRoles(userId: string, signal?: AbortSignal): Promise<EngineRole[]> {
  const data = await engineRequest<{ roles: EngineRole[] }>(
    `/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/roles`,
    { signal },
  );
  return data.roles;
}

export async function createUser(
  email: string,
  displayName?: string,
  roleId?: string,
  isAdmin?: boolean,
): Promise<EngineUser> {
  return engineRequest<EngineUser>("/api/v1/admin/user-module/users", {
    method: "POST",
    body: {
      email,
      displayName: displayName || undefined,
      roleId: roleId || undefined,
      isAdmin: isAdmin || undefined,
    },
  });
}

export async function setUserSystemAdmin(
  userId: string,
  isAdmin: boolean,
): Promise<{ ok: true; isAdmin: boolean; adminSource: "env" | "granted" | null }> {
  return engineRequest(`/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/system-admin`, {
    method: "POST",
    body: { isAdmin },
  });
}

export async function assignRole(userId: string, roleId: string): Promise<{ ok: true }> {
  return engineRequest<{ ok: true }>(`/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/roles`, {
    method: "POST",
    body: { roleId },
  });
}

export async function removeRole(userId: string, roleId: string): Promise<{ ok: true }> {
  return engineRequest<{ ok: true }>(
    `/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
    { method: "DELETE" },
  );
}

export async function deleteUser(userId: string): Promise<{ deleted: true }> {
  return engineRequest<{ deleted: true }>(`/api/v1/admin/user-module/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function reactivateUser(userId: string): Promise<{ ok: true }> {
  return engineRequest<{ ok: true }>(`/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/reactivate`, {
    method: "POST",
  });
}

export async function setUserPassword(userId: string, password: string | null): Promise<{ ok: true; passwordSet: boolean }> {
  return engineRequest<{ ok: true; passwordSet: boolean }>(
    `/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/password`,
    { method: "POST", body: { password } },
  );
}

// ── Spend caps ─────────────────────────────────────────────────────────────
export async function fetchMySpendCap(signal?: AbortSignal): Promise<SpendCap> {
  return engineRequest<SpendCap>("/user/spend-cap", { signal });
}

export async function requestSpendCapIncrease(amount: number): Promise<TopupRequestResult> {
  return engineRequest<TopupRequestResult>("/user/topup-requests", {
    method: "POST",
    body: { amount },
  });
}

export async function getUserSpendCap(userId: string, signal?: AbortSignal): Promise<SpendCap> {
  return engineRequest<SpendCap>(
    `/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/spend-cap`,
    { signal },
  );
}

export async function setUserSpendCap(
  userId: string,
  maxBudgetUsd: number | null,
  budgetDuration: string | null,
): Promise<{ maxBudgetUsd: number | null; budgetDuration: string | null; live: boolean }> {
  return engineRequest(`/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/spend-cap`, {
    method: "PUT",
    body: { maxBudgetUsd, budgetDuration },
  });
}

// ── Admin: roles ────────────────────────────────────────────────────────
export async function listAllRoles(signal?: AbortSignal): Promise<EngineRole[]> {
  const data = await engineRequest<{ roles: EngineRole[] }>("/api/v1/admin/user-module/roles", { signal });
  return data.roles;
}

export async function createRole(
  name: string,
  projectId: string,
  keyPrefixes: string[],
  opts?: { projectName?: string; keyNames?: Record<string, string>; rawKeys?: Record<string, string> },
): Promise<EngineRole> {
  return engineRequest<EngineRole>("/api/v1/admin/user-module/roles", {
    method: "POST",
    body: {
      name,
      project_id: projectId,
      key_prefixes: keyPrefixes,
      project_name: opts?.projectName,
      key_names: opts?.keyNames,
      raw_keys: opts?.rawKeys,
    },
  });
}

export async function updateRole(
  roleId: string,
  name: string,
  projectId: string,
  keyPrefixes: string[],
  opts?: { projectName?: string; keyNames?: Record<string, string> },
): Promise<EngineRole> {
  return engineRequest<EngineRole>(`/api/v1/admin/user-module/roles/${encodeURIComponent(roleId)}`, {
    method: "PUT",
    body: {
      name,
      project_id: projectId,
      key_prefixes: keyPrefixes,
      project_name: opts?.projectName,
      key_names: opts?.keyNames,
    },
  });
}

export async function deleteRole(roleId: string): Promise<{ deleted: true }> {
  return engineRequest<{ deleted: true }>(`/api/v1/admin/user-module/roles/${encodeURIComponent(roleId)}`, {
    method: "DELETE",
  });
}

export async function createRoleName(name: string): Promise<{ id: string; name: string }> {
  return engineRequest<{ id: string; name: string }>("/api/v1/admin/user-module/role-names", {
    method: "POST",
    body: { name },
  });
}

export async function deleteRoleName(name: string): Promise<{ deleted: true }> {
  return engineRequest<{ deleted: true }>(`/api/v1/admin/user-module/role-names/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export type KnownProject = { id: string; name: string | null };

export async function listKnownProjects(signal?: AbortSignal): Promise<KnownProject[]> {
  const data = await engineRequest<{
    projectIds: string[];
    projects?: { id: string; name: string | null }[];
  }>("/api/v1/admin/user-module/projects", { signal });
  if (data.projects && data.projects.length > 0) {
    return data.projects.map((p) => ({ id: p.id, name: p.name ?? null }));
  }
  return (data.projectIds ?? []).map((id) => ({ id, name: null }));
}

/** @deprecated Prefer `listKnownProjects`. */
export async function listKnownProjectIds(signal?: AbortSignal): Promise<string[]> {
  const projects = await listKnownProjects(signal);
  return projects.map((p) => p.id);
}

export type ResolvedShareKey = {
  found: boolean;
  keyPrefix: string;
  projectId?: string;
  projectName?: string | null;
  keyName?: string | null;
  status?: string | null;
};

export async function resolveShareKey(rawKey: string, signal?: AbortSignal): Promise<ResolvedShareKey> {
  return engineRequest<ResolvedShareKey>("/api/v1/admin/user-module/resolve-share-key", {
    method: "POST",
    body: { raw_key: rawKey },
    signal,
  });
}

export async function deleteProjectMinds(projectId: string): Promise<{ deletedMindCount: number }> {
  return engineRequest<{ deletedMindCount: number }>(
    `/api/v1/admin/user-module/projects/${encodeURIComponent(projectId)}`,
    { method: "DELETE" },
  );
}

// ── Admin: audit log ────────────────────────────────────────────────────
export async function listAudit(limit = 100, signal?: AbortSignal): Promise<AuditEntry[]> {
  const data = await engineRequest<{ entries: AuditEntry[] }>(`/api/v1/admin/user-module/audit?limit=${limit}`, {
    signal,
  });
  return data.entries;
}

// ── Self-service: run a Mind ──────────────────────────────────────────────
export async function listMyMinds(shareKey: string, signal?: AbortSignal): Promise<MindSummary[]> {
  const data = await engineRequest<{ items: MindSummary[] }>("/api/v2/minds", {
    headers: { "mind-share-key": shareKey },
    signal,
    credentials: "omit",
  });
  return data.items;
}

export async function listMySessions(limit = 50, mindId?: string, signal?: AbortSignal): Promise<SessionSummary[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (mindId) params.set("mind_id", mindId);
  const data = await engineRequest<{ items: SessionSummary[] }>(`/api/v2/sessions?${params}`, { signal });
  return data.items;
}

export interface CodefloChatSessionSummary {
  sessionId: string;
  mindId: string | null;
  repoId: string | null;
  title: string | null;
  summary: string | null;
  status: string;
  turnCount: number;
  totalTokens: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function listCodefloChatSessions(
  mindId: string,
  repoId: string,
  signal?: AbortSignal,
): Promise<CodefloChatSessionSummary[]> {
  const params = new URLSearchParams({ mind_id: mindId, repo_id: repoId, limit: "50" });
  const data = await engineRequest<{ items: CodefloChatSessionSummary[] }>(`/api/v2/chat-sessions?${params}`, {
    signal,
  });
  return data.items;
}

export async function getCodefloChatSessionMessages(
  sessionId: string,
  signal?: AbortSignal,
): Promise<Array<{ role: string; content: string | unknown[] }>> {
  const data = await engineRequest<{ messages: Array<{ role: string; content: string | unknown[] }> }>(
    `/api/v2/chat-sessions/${encodeURIComponent(sessionId)}/messages`,
    { signal },
  );
  return data.messages ?? [];
}

export async function archiveCodefloChatSession(sessionId: string): Promise<boolean> {
  const data = await engineRequest<{ archived: boolean }>(
    `/api/v2/chat-sessions/${encodeURIComponent(sessionId)}/archive`,
    { method: "POST" },
  );
  return Boolean(data.archived);
}

export async function getSessionDetail(sessionId: string, signal?: AbortSignal): Promise<SessionDetail> {
  return engineRequest<SessionDetail>(`/api/v2/sessions/${encodeURIComponent(sessionId)}`, { signal });
}

export async function deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
  return engineRequest<{ deleted: boolean }>(`/api/v2/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export async function listMyAccess(signal?: AbortSignal): Promise<ProjectAccess[]> {
  const data = await engineRequest<{ projects: ProjectAccess[] }>("/api/v2/my/access", { signal });
  return data.projects;
}

// ── Code repos (v2, identity-token auth) ─────────────────────────────────

export async function listCodeRepos(signal?: AbortSignal): Promise<CodeRepo[]> {
  const data = await engineRequest<{ data: CodeRepo[] }>("/api/v2/code-repos", { signal });
  return data.data;
}

export async function createCodeRepo(input: CreateCodeRepoInput, signal?: AbortSignal): Promise<CodeRepo> {
  const data = await engineRequest<{ data: CodeRepo }>("/api/v2/code-repos", {
    method: "POST",
    body: input,
    signal,
  });
  return data.data;
}

export async function deleteCodeRepo(repoId: string, signal?: AbortSignal): Promise<void> {
  await engineRequest<void>(`/api/v2/code-repos/${encodeURIComponent(repoId)}`, {
    method: "DELETE",
    signal,
  });
}

export async function getCodeRepo(repoId: string, signal?: AbortSignal): Promise<CodeRepo> {
  const data = await engineRequest<{ data: CodeRepo }>(
    `/api/v2/code-repos/${encodeURIComponent(repoId)}`,
    { signal },
  );
  return data.data;
}

export async function listCodeRepoBranches(
  repoId: string,
  signal?: AbortSignal,
): Promise<CodeRepoBranch[]> {
  const data = await engineRequest<{ data: CodeRepoBranch[] }>(
    `/api/v2/code-repos/${encodeURIComponent(repoId)}/branches`,
    { signal },
  );
  return data.data;
}

export interface CodeRepoBrowseParams {
  path?: string;
  source?: "workspace" | "git" | "vcs";
  branch?: string;
  cursor?: number;
}

export async function getCodeRepoTree(
  repoId: string,
  params: CodeRepoBrowseParams = {},
  signal?: AbortSignal,
): Promise<CodeRepoTreeResponse> {
  const qs = new URLSearchParams();
  if (params.path) qs.set("path", params.path);
  if (params.source) qs.set("source", params.source);
  if (params.branch) qs.set("branch", params.branch);
  if (params.cursor != null) qs.set("cursor", String(params.cursor));
  const suffix = qs.size ? `?${qs}` : "";
  return engineRequest<CodeRepoTreeResponse>(
    `/api/v2/code-repos/${encodeURIComponent(repoId)}/tree${suffix}`,
    { signal },
  );
}

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".venv",
  "venv",
  "__pycache__",
  ".next",
  "coverage",
  "vendor",
  ".turbo",
  ".cache",
  "target",
]);

const FILE_INDEX_MAX = 2000;
const FILE_INDEX_MAX_REQUESTS = 80;
const FILE_INDEX_WALK_CONCURRENCY = 8;

function shouldSkipRepoPath(path: string): boolean {
  return path.split("/").some((part) => SKIP_DIR_NAMES.has(part));
}

function treeEntryToFile(entry: CodeRepoTreeEntry): { path: string; name: string } {
  const path = entry.path;
  return { path, name: entry.name || path.split("/").pop() || path };
}

async function collectTreeEntries(
  repoId: string,
  params: { path: string; source: "workspace" | "git" | "vcs"; branch?: string },
  signal?: AbortSignal,
): Promise<CodeRepoTreeEntry[]> {
  const entries: CodeRepoTreeEntry[] = [];
  let cursor: number | undefined = 0;
  while (true) {
    const page = await getCodeRepoTree(
      repoId,
      { path: params.path, source: params.source, branch: params.branch, cursor },
      signal,
    );
    entries.push(...(page.entries ?? []));
    if (!page.truncated || page.nextCursor == null || page.nextCursor === "") break;
    const next = Number(page.nextCursor);
    if (!Number.isFinite(next) || next === cursor) break;
    cursor = next;
  }
  return entries;
}

async function collectRecursiveGitFiles(
  repoId: string,
  branch: string | undefined,
  signal?: AbortSignal,
): Promise<Array<{ path: string; name: string }>> {
  const page = await getCodeRepoTree(
    repoId,
    { path: "", source: "git", branch, cursor: 0 },
    signal,
  );
  const files: Array<{ path: string; name: string }> = [];
  const seen = new Set<string>();
  for (const entry of page.entries ?? []) {
    if (entry.type !== "file" || !entry.path || shouldSkipRepoPath(entry.path) || seen.has(entry.path)) continue;
    seen.add(entry.path);
    files.push(treeEntryToFile(entry));
    if (files.length >= FILE_INDEX_MAX) break;
  }
  return files;
}

async function walkCodeRepoFiles(
  repoId: string,
  params: { source: "workspace" | "vcs"; branch?: string },
  signal?: AbortSignal,
): Promise<Array<{ path: string; name: string }>> {
  const files: Array<{ path: string; name: string }> = [];
  const seen = new Set<string>();
  let frontier: string[] = [""];
  let requests = 0;
  while (frontier.length > 0 && files.length < FILE_INDEX_MAX && requests < FILE_INDEX_MAX_REQUESTS) {
    const batch = frontier.splice(0, FILE_INDEX_WALK_CONCURRENCY);
    const pages = await Promise.all(
      batch.map((dir) =>
        collectTreeEntries(repoId, { path: dir, source: params.source, branch: params.branch }, signal),
      ),
    );
    requests += batch.length;
    const next: string[] = [];
    for (const entries of pages) {
      for (const entry of entries) {
        if (!entry.path || shouldSkipRepoPath(entry.path)) continue;
        if (entry.type === "dir") {
          next.push(entry.path);
          continue;
        }
        if (seen.has(entry.path)) continue;
        seen.add(entry.path);
        files.push(treeEntryToFile(entry));
        if (files.length >= FILE_INDEX_MAX) break;
      }
      if (files.length >= FILE_INDEX_MAX) break;
    }
    frontier = next.concat(frontier);
  }
  return files;
}

export async function listCodeRepoFiles(
  repoId: string,
  params: { source?: "workspace" | "git" | "vcs"; branch?: string } = {},
  signal?: AbortSignal,
): Promise<Array<{ path: string; name: string }>> {
  const source = params.source ?? "workspace";
  if (source === "git") {
    return collectRecursiveGitFiles(repoId, params.branch, signal);
  }
  if (source === "workspace") {
    try {
      const gitFiles = await collectRecursiveGitFiles(repoId, params.branch, signal);
      if (gitFiles.length > 0) return gitFiles;
    } catch {
      // Uncommitted-only or git-less workspace — walk the working tree instead.
    }
    return walkCodeRepoFiles(repoId, { source: "workspace", branch: params.branch }, signal);
  }
  return walkCodeRepoFiles(repoId, { source: "vcs", branch: params.branch }, signal);
}

export async function getCodeRepoFile(
  repoId: string,
  params: { path: string; source?: "workspace" | "git" | "vcs"; branch?: string },
  signal?: AbortSignal,
): Promise<CodeRepoFileResponse> {
  const qs = new URLSearchParams({ path: params.path });
  if (params.source) qs.set("source", params.source);
  if (params.branch) qs.set("branch", params.branch);
  return engineRequest<CodeRepoFileResponse>(
    `/api/v2/code-repos/${encodeURIComponent(repoId)}/file?${qs}`,
    { signal },
  );
}

export interface CodeRepoUploadResult {
  filesUploaded: number;
  branch: string;
  commitMessage: string;
  commitSha: string | null;
}

export async function uploadCodeRepoFile(
  repoId: string,
  input: { file: File; commitMessage: string; branch: string; targetPath?: string },
  signal?: AbortSignal,
): Promise<CodeRepoUploadResult> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("commitMessage", input.commitMessage);
  form.append("branch", input.branch);
  if (input.targetPath) form.append("targetPath", input.targetPath);
  const data = await engineRequest<{ data: CodeRepoUploadResult }>(
    `/api/v2/code-repos/${encodeURIComponent(repoId)}/upload`,
    { method: "POST", body: form, signal },
  );
  return data.data;
}

export async function uploadCodeRepoFiles(
  repoId: string,
  input: { files: File[]; commitMessage: string; branch: string; targetPath?: string },
  signal?: AbortSignal,
): Promise<CodeRepoUploadResult> {
  if (input.files.length === 0) {
    throw new Error("No files selected");
  }
  let last: CodeRepoUploadResult | undefined;
  for (const file of input.files) {
    last = await uploadCodeRepoFile(
      repoId,
      {
        file,
        commitMessage:
          input.files.length === 1 ? input.commitMessage : `${input.commitMessage} (${file.name})`,
        branch: input.branch,
        targetPath: input.targetPath,
      },
      signal,
    );
  }
  return last!;
}

// ── Admin: fleet-wide visibility ──────────────────────────────────────────
export async function listMindsForUser(userId: string, signal?: AbortSignal): Promise<MindSummary[]> {
  const data = await engineRequest<{ items: MindSummary[] }>(
    `/api/v2/admin/users/${encodeURIComponent(userId)}/minds`,
    { signal },
  );
  return data.items;
}

export async function listAllSessions(
  opts?: { userId?: string; limit?: number },
  signal?: AbortSignal,
): Promise<SessionSummary[]> {
  const params = new URLSearchParams();
  if (opts?.userId) params.set("userId", opts.userId);
  params.set("limit", String(opts?.limit ?? 50));
  const data = await engineRequest<{ items: SessionSummary[] }>(`/api/v2/admin/sessions?${params}`, { signal });
  return data.items;
}

/** Engine/OpenAI frames that mean "this turn is done — unblock the UI". */
const TERMINAL_NAMED_EVENTS = new Set(["turn_completed", "waiting_for_input"]);
const TERMINAL_ENGINE_TYPES = new Set([
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
  "orchestrator.turn_completed",
  "orchestrator.waiting_for_input",
  "codeflo.chat.turn_completed",
  "codeflo.chat.waiting_for_input",
]);

function sseFrameIsTerminal(frame: string, data: string): boolean {
  if (data === "[DONE]") return true;
  const eventName = frame
    .split("\n")
    .find((l) => l.startsWith("event:"))
    ?.slice(6)
    .trim();
  if (eventName && TERMINAL_NAMED_EVENTS.has(eventName)) return true;
  try {
    const obj = JSON.parse(data) as Record<string, unknown>;
    if (typeof obj.event_type === "string" && TERMINAL_ENGINE_TYPES.has(obj.event_type)) {
      return true;
    }
    const choice = Array.isArray(obj.choices) ? (obj.choices[0] as Record<string, unknown> | undefined) : undefined;
    const finish = choice?.finish_reason;
    if (finish === "stop" || finish === "length") return true;
  } catch {
    // not JSON — ignore
  }
  return false;
}

function drainSseReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  void (async () => {
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
      }
    } catch {
      // Connection torn down some other way — best-effort drain.
    }
  })();
}

async function streamSse(
  res: Response,
  onEvent: (data: string, eventName?: string) => void,
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const data = dataLine.slice(5).trim();
        const eventName = frame
          .split("\n")
          .find((l) => l.startsWith("event:"))
          ?.slice(6)
          .trim();
        onEvent(data, eventName);
        if (sseFrameIsTerminal(frame, data)) {
          drainSseReader(reader);
          return;
        }
      }
    }
  } catch (error) {
    if (isAbortError(error)) {
      drainSseReader(reader);
      throw error;
    }
    throw error;
  }
}

async function streamingEngineRequest(
  path: string,
  shareKey: string,
  body: unknown,
  onEvent: (data: string) => void,
): Promise<void> {
  const proxyPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${ENGINE_PROXY_BASE}${proxyPath}`;
  const headers = new Headers({ "Content-Type": "application/json" });
  if (shareKey) {
    headers.set("mind-share-key", shareKey);
  }
  const adminKey = getAdminKey();
  if (adminKey) {
    headers.set("x-admin-key", adminKey);
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new EngineApiError(0, { message: String(err) }, "Could not reach the engine proxy.");
  }
  if (!res.ok) {
    const errBody = await parseBody(res);
    throw new EngineApiError(res.status, errBody);
  }
  await streamSse(res, onEvent);
}

/** `POST /api/v2/execute/:mindId`, inline SSE (`stream: true`). */
export async function executeMind(
  mindId: string,
  shareKey: string,
  inputs: Record<string, unknown>,
  onEvent: (data: string) => void,
): Promise<void> {
  await streamingEngineRequest(`/api/v2/execute/${encodeURIComponent(mindId)}`, shareKey, { inputs, stream: true }, onEvent);
}

/** `POST /api/v2/chat/completions`, OpenAI-compat SSE. */
export async function chatCompletion(
  mindId: string,
  shareKey: string,
  message: string,
  onEvent: (data: string, eventName?: string) => void,
  opts?: {
    priorSessionId?: string;
    sessionId?: string;
    inputs?: Record<string, unknown>;
    operatorType?: "orchestrator" | "codeflo_chat";
    signal?: AbortSignal;
  },
): Promise<string | null> {
  const proxyUrl = `${ENGINE_PROXY_BASE}/api/v2/chat/completions`;
  const headers = new Headers({ "Content-Type": "application/json" });
  if (shareKey) {
    headers.set("mind-share-key", shareKey);
  }
  const adminKey = getAdminKey();
  if (adminKey) {
    headers.set("x-admin-key", adminKey);
  }
  const body: Record<string, unknown> = {
    model: mindId,
    messages: [{ role: "user", content: message }],
    stream: true,
  };
  if (opts?.priorSessionId) body.prior_session_id = opts.priorSessionId;
  if (opts?.sessionId) body.session_id = opts.sessionId;
  if (opts?.inputs && Object.keys(opts.inputs).length > 0) body.inputs = opts.inputs;
  if (opts?.operatorType) body.operator_type = opts.operatorType;

  let res: Response;
  try {
    res = await fetch(proxyUrl, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(body),
      signal: opts?.signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new EngineApiError(0, { message: String(err) }, "Could not reach the engine proxy.");
  }
  if (!res.ok) {
    const errBody = await parseBody(res);
    throw new EngineApiError(res.status, errBody);
  }
  const sessionId = res.headers.get("X-Session-Id") ?? res.headers.get("x-session-id");
  await streamSse(res, onEvent);
  return sessionId;
}
