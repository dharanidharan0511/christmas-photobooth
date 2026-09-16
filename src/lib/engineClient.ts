// ─────────────────────────────────────────────────────────────────────────
// HARD PROJECT RULE — read this before adding any network call anywhere in
// this app (focused TP-Web / ai/studio Enterprise).
//
// This file is the ONLY module in this project allowed to call fetch/axios/
// XMLHttpRequest/etc. Every screen, hook, and component MUST import its data
// functions from here instead of talking to the network directly. This is
// not a style preference — it is how we structurally guarantee that this
// client, like TP-Web, calls ONLY the edge engine
// (import.meta.env.VITE_ENGINE_URL) and NEVER the AI Studio gateway or any
// other AI Studio service. If you find yourself typing `fetch(` anywhere
// else in src/, stop and add a function here instead.
//
// Ported from newaistudio/TP-Web/src/lib/engineClient.ts — keep the surface
// aligned with that file unless we intentionally diverge.
// ─────────────────────────────────────────────────────────────────────────

import type { AuditEntry, AuthMode, EngineRole, EngineUser, MindSummary, ProjectAccess, SessionDetail, SessionSummary, SpendCap, TopupRequestResult, WhoAmI } from "../types/engine";
import type {
  CodeRepo,
  CodeRepoBranch,
  CodeRepoFileResponse,
  CodeRepoTreeEntry,
  CodeRepoTreeResponse,
  CreateCodeRepoInput,
} from "../types/codeRepos";

/**
 * Engine base URL.
 *
 * Two modes:
 *  - PROXY mode (recommended): VITE_ENGINE_URL is empty ("").
 *    Vite dev server proxies /api/* and /user/* to VITE_ENGINE_PROXY_TARGET.
 *    The browser sees all requests as same-origin — no CORS, no cert issues.
 *  - DIRECT mode: VITE_ENGINE_URL = "https://<host>".
 *    The engine must have this app's origin in its CORS allow-list.
 */
export const ENGINE_URL: string = (import.meta.env.VITE_ENGINE_URL ?? "").trim();

/** Real engine host — only set in proxy mode; used for display purposes. */
export const ENGINE_PROXY_TARGET: string = (import.meta.env.VITE_ENGINE_PROXY_TARGET ?? "").trim();

/** Default Mind Share Key for code-repo CodeFlo chat (`VITE_CODEFLO_SHARE_KEY`). */
export const CODEFLO_SHARE_KEY = (import.meta.env.VITE_CODEFLO_SHARE_KEY ?? "").trim();

// Sanity check — both vars empty means we have no idea where the engine is.
if (!ENGINE_URL && !ENGINE_PROXY_TARGET) {
  // eslint-disable-next-line no-console
  console.error(
    "[engineClient] Neither VITE_ENGINE_URL nor VITE_ENGINE_PROXY_TARGET is set. " +
    "Copy .env.example to .env and fill in VITE_ENGINE_PROXY_TARGET.",
  );
}

// ── Admin key (fallback auth mode) ─────────────────────────────────────────
// Stored in sessionStorage (NOT localStorage) — it's a real bearer credential
// for the engine's admin endpoints and should not survive a browser restart.
const ADMIN_KEY_STORAGE_KEY = "tp-web:admin-key";

export function getAdminKey(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminKey(key: string): void {
  sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
}

export function clearAdminKey(): void {
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
  /** Extra headers merged onto the request — used by the self-service run
   * endpoints below, which need a `mind-share-key` header the admin surfaces
   * never send. */
  headers?: Record<string, string>;
  /**
   * Forwarded straight to `fetch`. Every GET-style function below takes this
   * as its last param so a `useQuery`'s `queryFn: ({ signal }) => ...` can
   * pass it through. Without it, React 18 StrictMode's dev-only mount ->
   * unmount -> remount cycle still lets the first mount's request run to
   * completion (nothing told `fetch` to actually abort it) while the second
   * mount fires its own — two real network calls for one query, visible as
   * duplicates in the Network tab. Wiring the signal through makes the first
   * one a real aborted request instead, matching TanStack Query's own
   * documented fix for this exact StrictMode symptom.
   */
  signal?: AbortSignal;
  /**
   * Default `include` (SSO cookie). Pass `omit` only for share-key-only
   * listing (`GET /minds`) so a present identity cookie does not force the
   * Role entitlement gate.
   */
  credentials?: RequestCredentials;
}

/**
 * The single low-level request function. Every exported data function in
 * this file goes through this. Always sends credentials so the httpOnly SSO
 * cookie is attached automatically when present; also attaches the admin
 * key bearer token when one is set. Callers never need to know which auth
 * mode is active.
 */
async function engineRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = `${ENGINE_URL}${path}`;
  const headers = new Headers();
  const credentials = opts.credentials ?? "include";
  // Admin bearer is an alternate login mode — do not attach it on share-key-only
  // requests (`credentials: "omit"`), or it can confuse engine auth.
  const adminKey = credentials === "include" ? getAdminKey() : null;
  if (adminKey) {
    headers.set("Authorization", `Bearer ${adminKey}`);
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
      `Could not reach the engine at ${ENGINE_URL}. Is it running, and does its CORS config allow this origin (${window.location.origin})?`,
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
 * no valid session (engine returns 401 with a plain-text body in that case
 * — that's an expected "signed out" state, not an error, so we swallow it
 * here rather than throwing).
 */
export async function fetchWhoAmI(signal?: AbortSignal): Promise<WhoAmI | null> {
  const res = await fetch(`${ENGINE_URL}/user/whoami`, { credentials: "include", signal });
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
 *
 * Passes this app's own base URL as `redirect_uri` so the engine's `/user/sso/acs`
 * (or `/user/sso/callback`) sends the browser straight back here after the IdP
 * round trip — on success to this base (which then routes to `/dashboard` once the
 * session cookie is confirmed via `fetchWhoAmI`), on failure to `<base>?sso_error=<reason>`
 * so `LoginPage` can render it. The engine only honors `redirect_uri` when its
 * origin is on the engine's own CORS allow-list (`AISTUDIO_CORS_ORIGINS`) —
 * otherwise it falls back to its own `/user/session` landing page.
 *
 * `window.location.origin` alone is wrong whenever this app is served at a
 * *path* under a shared origin rather than its own dedicated origin (e.g.
 * `https://host/tp-web/` behind the main app's nginx, vs. its own dev port)
 * — it silently drops the path and sends the browser back to whatever else
 * lives at that origin's root instead of back here. `import.meta.env.BASE_URL`
 * is the same Vite base path `main.tsx` already uses for the router's own
 * `basename`, so this stays correct under either deployment shape with no
 * separate config.
 */
export function goToSsoLogin(): void {
  const redirectUri = encodeURIComponent(`${window.location.origin}${import.meta.env.BASE_URL}`);
  window.location.href = `${ENGINE_URL}/user/login?redirect_uri=${redirectUri}`;
}

/** An ADDITIONAL sign-in method alongside SSO, not a replacement — only
 * works for a user a system_admin has explicitly set a password for
 * (`setUserPassword`); anyone else gets the same generic 401 a wrong
 * password would. On success the engine sets the identity cookie itself —
 * call `refetch()` (useAuth) right after, same as the post-SSO landing flow. */
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

/** Admin-initiated user creation — the only other writer of `edge_local_users`
 * besides real SSO sign-in's JIT provisioning. `roleId` is optional so
 * "add a person + give them a Role" is a single round trip from the
 * Dashboard's "+ Add User" form. */
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

/** Soft delete — flips the person's status to `disabled` and revokes any
 * live session (so access is gone immediately, not just at next sign-in).
 * Their Role assignments and session-attribution history are left intact —
 * `reactivateUser` undoes this with zero re-setup. */
export async function deleteUser(userId: string): Promise<{ deleted: true }> {
  return engineRequest<{ deleted: true }>(`/api/v1/admin/user-module/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

/** Undoes `deleteUser` — flips status back to `active`. Role assignments
 * were never touched by the delete, so this alone restores full access. */
export async function reactivateUser(userId: string): Promise<{ ok: true }> {
  return engineRequest<{ ok: true }>(`/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/reactivate`, {
    method: "POST",
  });
}

/** Admin sets (or, with `password: null`, clears) a user's password — an
 * additional login method alongside SSO. Also resets any existing lockout,
 * since issuing a new password is implicitly un-blocking the account. */
export async function setUserPassword(userId: string, password: string | null): Promise<{ ok: true; passwordSet: boolean }> {
  return engineRequest<{ ok: true; passwordSet: boolean }>(
    `/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/password`,
    { method: "POST", body: { password } },
  );
}

// ── Spend caps (S131 credit management) ─────────────────────────────────
// An edge employee has NO wallet — they draw on the workspace owner's credit
// pool, and their only personal limit is a LiteLLM `max_budget` on their own
// virtual key. So "top up" for this population means RAISING A CAP, never
// adding credits. Two audiences, two endpoints:
//   - the person themselves  -> GET /user/spend-cap        (self-scoped)
//   - an admin, for someone  -> /api/v1/admin/user-module/users/:id/spend-cap

/** The signed-in employee's own cap + spend-to-date. Self-scoped: the engine
 * takes the id from the verified identity token, never a parameter. */
export async function fetchMySpendCap(signal?: AbortSignal): Promise<SpendCap> {
  return engineRequest<SpendCap>("/user/spend-cap", { signal });
}

/** Ask an admin to raise this employee's cap. Creates a pending request; it
 * does NOT change the cap. Approval happens on the admin side. */
export async function requestSpendCapIncrease(amount: number): Promise<TopupRequestResult> {
  return engineRequest<TopupRequestResult>("/user/topup-requests", {
    method: "POST",
    body: { amount },
  });
}

/** Admin: read one employee's cap. `spentUsd` is not returned here — only the
 * self-read endpoint reports spend. */
export async function getUserSpendCap(userId: string, signal?: AbortSignal): Promise<SpendCap> {
  return engineRequest<SpendCap>(
    `/api/v1/admin/user-module/users/${encodeURIComponent(userId)}/spend-cap`,
    { signal },
  );
}

/** Admin: set or clear one employee's cap.
 *
 * Pass `(null, null)` to CLEAR it (back to uncapped). A non-null
 * `maxBudgetUsd` REQUIRES a `budgetDuration` — the engine returns 400
 * otherwise, deliberately: a cap with no reset window blocks the person
 * permanently the moment they reach it.
 *
 * A `200` with `live: false` is a SUCCESS, not a failure — it means the cap was
 * saved to the engine's database but the push to the LiteLLM proxy could not be
 * confirmed. The stored value is re-applied automatically the next time the
 * employee's key is minted, so the cap starts late rather than being lost. A
 * genuine "nothing was saved" is a 500, not a 200. */
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

// ── Admin: roles (cross-project catalog + authoring) ────────────────────
// Reversed decision (was gateway-only): the engine's /roles endpoints now
// accept the SAME admin credential this app uses everywhere else, not just
// AISTUDIO_ENGINE_API_KEY. The wire body is snake_case (project_id,
// key_prefixes) — a deliberate exception matching the gateway's own wire
// contract with this same endpoint, so both callers share one shape.
export async function listAllRoles(signal?: AbortSignal): Promise<EngineRole[]> {
  const data = await engineRequest<{ roles: EngineRole[] }>("/api/v1/admin/user-module/roles", { signal });
  return data.roles;
}

/** `keyNames`/`projectName` are best-effort labels — TP-Web itself never
 * knows AI Studio's real names for a project/key it didn't create, so a
 * TP-Web-originated mapping legitimately omits them (the engine just stores
 * the id/prefix, same as before). Only AI Studio's own gateway push
 * actually supplies these.
 *
 * `rawKeys` (schema v37): the admin-pasted FULL raw key for a prefix,
 * encrypted at rest by the engine — never AI Studio's push (it never has
 * the raw value to give after key creation). This is what lets a signed-in
 * user's Run Mind skip pasting a key entirely; see RolesPage's "Map Roles
 * to Mind Share Keys" section for where this gets populated. */
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

/** Reserves a Role NAME with zero project mapping (schema v36) — lets
 * "create a Role" be a genuinely separate, persisted action from mapping it
 * to a project + keys (`createRole` above). Idempotent. */
export async function createRoleName(name: string): Promise<{ id: string; name: string }> {
  return engineRequest<{ id: string; name: string }>("/api/v1/admin/user-module/role-names", {
    method: "POST",
    body: { name },
  });
}

/** Deletes a Role NAME entirely — every project mapping that shares it,
 * cascading their keys and user assignments. */
export async function deleteRoleName(name: string): Promise<{ deleted: true }> {
  return engineRequest<{ deleted: true }>(`/api/v1/admin/user-module/role-names/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

/** Known cluster projects for Role mapping pickers. Ids always come from
 * local minds; `name` is filled when any Role for that project already has
 * a `project_name` (usually from an AI Studio push). */
export type KnownProject = { id: string; name: string | null };

export async function listKnownProjects(signal?: AbortSignal): Promise<KnownProject[]> {
  const data = await engineRequest<{
    projectIds: string[];
    projects?: { id: string; name: string | null }[];
  }>("/api/v1/admin/user-module/projects", { signal });
  if (data.projects && data.projects.length > 0) {
    return data.projects.map((p) => ({ id: p.id, name: p.name ?? null }));
  }
  // Older engines only returned UUIDs.
  return (data.projectIds ?? []).map((id) => ({ id, name: null }));
}

/** @deprecated Prefer `listKnownProjects` — kept for any caller that only needs ids. */
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

/** Look up which project a pasted Mind Share Key belongs to (cluster api_keys). */
export async function resolveShareKey(rawKey: string, signal?: AbortSignal): Promise<ResolvedShareKey> {
  return engineRequest<ResolvedShareKey>("/api/v1/admin/user-module/resolve-share-key", {
    method: "POST",
    body: { raw_key: rawKey },
    signal,
  });
}

/** Soft-deletes every Mind this cluster has for `projectId` — the fix for a
 * project deleted in AI Studio BEFORE the gateway started propagating that
 * to the cluster: those Minds never went away here, so this project id kept
 * showing up in the list above forever. Also useful for a third-party
 * integrator cleaning up directly, with no dependency on AI Studio's own
 * delete flow at all. Backs Roles' "Clean up a stale project" utility (the
 * standalone Projects page this used to live on was removed — everything
 * else it showed was a redundant re-slice of what Roles already displays). */
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

// ── Self-service: run a Mind (S132 Phase 5) ──────────────────────────────
// These go through the v2 self-service surface, not the admin one above —
// identity comes from the SAME SSO cookie every other call already sends
// (credentials: "include"). Signed-in execute/chat with no share-key header
// uses the admin-stored Role key on the engine (`resolve_stored_share_key`).
// `listMyMinds` is the leftover share-key listing path (Run → Advanced).
// The admin-key fallback (sessionStorage) is a service credential, not a
// per-user identity — employee chat only works while signed in via SSO.

export async function listMyMinds(shareKey: string, signal?: AbortSignal): Promise<MindSummary[]> {
  const data = await engineRequest<{ items: MindSummary[] }>("/api/v2/minds", {
    headers: { "mind-share-key": shareKey },
    signal,
    // Share-key-only listing — omit SSO cookie so Role gate is not applied.
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

/** CodeFlo conversation rows (one per chat), not per-turn execution jobs. */
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

/** Full detail for one of the caller's own sessions — input/output/error,
 * not just the summary row `listMySessions` carries. Ownership-checked
 * server-side the same way the list is (via `edge_session_attribution`), so
 * this 404s rather than leaks another person's session content. */
export async function getSessionDetail(sessionId: string, signal?: AbortSignal): Promise<SessionDetail> {
  return engineRequest<SessionDetail>(`/api/v2/sessions/${encodeURIComponent(sessionId)}`, { signal });
}

/** Soft-deletes one session — same `deleted_at` mechanism AI Studio's own
 * Execution History delete uses, so it disappears from both UIs. */
export async function deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
  return engineRequest<{ deleted: boolean }>(`/api/v2/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

/** Self-service discovery — no share key needed. Every project the
 * signed-in caller has ANY Role in, the key prefix(es) that Role grants
 * there, and that project's published Minds. Answers "what do I even have
 * access to" before the person has to already know a raw key value. */
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
  // One page is enough for @-mentions — git `ls-tree -r` is already recursive.
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

/** Flat file index for @-mentions. Git listings are recursive (`ls-tree -r`);
 * workspace uses that when possible, then falls back to a bounded directory walk.
 * VCS (GitHub/GitLab/Bitbucket) is walked directory-by-directory. */
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

/** Upload one file or zip to `POST /api/v2/code-repos/:id/upload`. */
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

/** Sequential uploads when the modal has several files (engine accepts one `file` per request). */
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

// ── Admin: fleet-wide visibility (S132 Phase 6) ──────────────────────────
// Browsing is keyless — derived from the target user's own Roles, not a
// pasted key — but RUNNING whatever's found still goes through the same
// executeMind/chatCompletion above with the ADMIN'S OWN key: the local
// Role-membership bypass for admins does not touch the engine's central
// key-scope/allowed-mind-ids check, so a mind only actually runs if the
// admin's own key is centrally scoped to cover its project. Surface that
// 403 plainly rather than implying broader access than actually exists.

/** What Minds can `userId` access, via their Roles — for the admin "browse
 * as" picker. No share key involved; this is discovery, not execution. */
export async function listMindsForUser(userId: string, signal?: AbortSignal): Promise<MindSummary[]> {
  const data = await engineRequest<{ items: MindSummary[] }>(
    `/api/v2/admin/users/${encodeURIComponent(userId)}/minds`,
    { signal },
  );
  return data.items;
}

/** Fleet-wide execution history — every identity-attributed session,
 * optionally narrowed to one user. Admin-only on the engine side. */
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

/** Engine/OpenAI frames that mean "this turn is done — unblock the UI".
 * CodeFlo chat minds emit `event: turn_completed` then park the HTTP
 * connection on `: keepalive` for up to `session_timeout_seconds` waiting
 * for Redis follow-up input. The Test Client has no Redis follow-up path,
 * so treating those frames as terminal is what makes Chat feel like a
 * normal messenger instead of a hung curl dump. */
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
  // Resolve the caller immediately, but do NOT `reader.cancel()` — that
  // tears down the fetch connection and can cancel the engine's still-
  // running generator mid-flight, including its `finally` session-complete
  // write. Drain in the background so the server closes on its own terms.
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

/** Parses one `fetch` response body as a `text/event-stream` — split on the
 * blank-line frame boundary, take each frame's `data:` line. No SSE
 * library needed for this shape.
 *
 * `onEvent` gets `(data, eventName?)` so Chat can distinguish OpenAI content
 * chunks from named lifecycle frames (`turn_completed`, `session_init`, …). */
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
  const headers = new Headers({ "Content-Type": "application/json" });
  // Schema v37: an empty/absent shareKey is a deliberate, valid call — the
  // request goes out on the identity cookie alone, and the engine falls
  // back to an admin-stored key for a Role this person holds (see
  // authz.resolve_stored_share_key). Setting the header to an empty string
  // would defeat that fallback (the engine would see "a key was presented,
  // and it's blank" rather than "no key was presented at all").
  if (shareKey) {
    headers.set("mind-share-key", shareKey);
  }
  let res: Response;
  try {
    res = await fetch(`${ENGINE_URL}${path}`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new EngineApiError(0, { message: String(err) }, `Could not reach the engine at ${ENGINE_URL}.`);
  }
  if (!res.ok) {
    const errBody = await parseBody(res);
    throw new EngineApiError(res.status, errBody);
  }
  await streamSse(res, onEvent);
}

/** `POST /api/v2/execute/:mindId`, inline SSE (`stream: true`) — every
 * yielded event's raw `data:` payload is handed to `onEvent` as-is (a JSON
 * string); the caller parses whatever shape it needs. */
export async function executeMind(
  mindId: string,
  shareKey: string,
  inputs: Record<string, unknown>,
  onEvent: (data: string) => void,
): Promise<void> {
  await streamingEngineRequest(`/api/v2/execute/${encodeURIComponent(mindId)}`, shareKey, { inputs, stream: true }, onEvent);
}

/** `POST /api/v2/chat/completions`, OpenAI-compat SSE.
 *
 * Pass `priorSessionId` on turn 2+ so CodeFlo can resume the same memory
 * row (same contract as AI Studio's ChatExecutePage). Returns the
 * `X-Session-Id` the engine minted for this turn when present.
 * Non-prompt Mind `interface.inputs` (e.g. `repo_id`) go in `inputs`.
 * `operatorType: "codeflo_chat"` selects the CodeFlo chat path (Studio parity). */
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
  const headers = new Headers({ "Content-Type": "application/json" });
  // Empty shareKey is valid: identity cookie only; engine unwraps the Role key.
  if (shareKey) {
    headers.set("mind-share-key", shareKey);
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
    res = await fetch(`${ENGINE_URL}/api/v2/chat/completions`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(body),
      signal: opts?.signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new EngineApiError(0, { message: String(err) }, `Could not reach the engine at ${ENGINE_URL}.`);
  }
  if (!res.ok) {
    const errBody = await parseBody(res);
    throw new EngineApiError(res.status, errBody);
  }
  const sessionId = res.headers.get("X-Session-Id") ?? res.headers.get("x-session-id");
  await streamSse(res, onEvent);
  return sessionId;
}
