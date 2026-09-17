// Types for the shapes documented (and verified) against the edge engine's
// user-module API. See lib/engineClient.ts for the single client that
// produces these.

export interface WhoAmI {
  uid: string;
  eml: string;
  sid: string;
  roles: string[];
  isAdmin: boolean;
  /** `"env"` = listed in USER_MODULE_ADMIN_EMAILS; `"granted"` = DB flag. */
  adminSource?: "env" | "granted" | null;
}

export interface EngineUser {
  id: string;
  email: string;
  displayName: string;
  status: string;
  /** Superuser — env allow-list or a grant from another system_admin. Never a Role row. */
  isAdmin: boolean;
  adminSource?: "env" | "granted" | null;
}

export interface EngineRole {
  id: string;
  name: string;
  /** Absent on the per-user roles list (users/:id/roles) — present on the
   * catalog list (admin/user-module/roles) and create/update responses.
   * Also absent on a BARE Role — a name reserved via `createRoleName` with
   * no project mapping yet (schema v36: `edge_roles.project_id` is nullable
   * now). A bare Role should never be offered in an "assign to user"
   * picker — it grants nothing. */
  projectId?: string;
  /** Best-effort label cache — only populated once AI Studio's gateway has
   * pushed a mapping for this project at least once (edge-roles.ts sends
   * it on every push). Falls back to showing `projectId` when absent. */
  projectName?: string;
  keyPrefixes?: string[];
  /** Same data as `keyPrefixes`, paired with each key's best-effort cached
   * `name` (also only populated via an AI Studio gateway push) and whether
   * an admin has stored its raw value (schema v37, `hasStoredKey`) — the
   * latter is what determines whether a user assigned this Role can Run a
   * Mind with zero key input, vs. only via manual paste. Prefer this over
   * `keyPrefixes` wherever a label is being shown to a person. */
  keys?: { prefix: string; name?: string; hasStoredKey: boolean }[];
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export type AuthMode = "cookie" | "key" | "none";

/** One declared input field on a Mind's `interface.inputs` — what Run Mind
 * needs to build a correct inputs form instead of guessing field names.
 * Guessing wrong (e.g. always sending `{"question": ...}`) silently produces
 * an empty prompt for a Mind that actually expects `{"topic": ...}`, which
 * then fails deep inside the LLM call with a confusing provider-level error
 * instead of a clear "you're missing a required field" one. */
/** Mirrors Studio `InputConstraints` — only the bits the Test Client form uses. */
export interface MindInputConstraints {
  max_size_bytes?: number;
  max_length?: number;
  pattern?: string;
  allowed_mime_types?: string[];
  max_files?: number;
  max_total_size_bytes?: number;
  allow_multiple?: boolean;
}

/** Optional JSON Schema fragment on an input (enum / oneOf → dropdown). */
export interface MindInputSchema {
  enum?: unknown[];
  enumNames?: unknown[];
  oneOf?: { const?: unknown; title?: string }[];
}

export interface MindInputField {
  name: string;
  type: string;
  description: string;
  required: boolean;
  constraints?: MindInputConstraints;
  schema?: MindInputSchema;
}

/** `GET /api/v2/minds` — a published Mind the signed-in caller can run with
 * the share key they presented. `projectId` is present only from the admin
 * "browse as user" endpoint (`GET /api/v2/admin/users/:id/minds`) — a user
 * with Roles across multiple projects needs it to disambiguate; absent from
 * the plain self-service `/api/v2/minds` response, which is always scoped
 * to a single project already (the presented key's own). */
export interface MindSummary {
  id: string;
  name: string;
  version: string;
  description: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  inputs: MindInputField[];
}

/** `GET /api/v2/sessions` — one of the signed-in caller's own past runs.
 * `userId`/`email` are present only from the admin fleet-wide endpoint
 * (`GET /api/v2/admin/sessions`) — the self-service version omits them,
 * since it's always implicitly "me". */
export interface SessionSummary {
  sessionId: string;
  mindId: string;
  status: string;
  totalTokens: number;
  costUsd: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  userId?: string;
  email?: string;
}

/** `GET /api/v2/sessions/:id` — the full row behind one `SessionSummary`,
 * fetched on demand when a person opens a session's detail slide-over.
 * `input`/`output` are whatever JSON the mind actually ran with/produced —
 * unstructured on purpose, since every Mind's shape differs. */
export interface SessionDetail extends SessionSummary {
  input: unknown;
  output: unknown;
  errorCode: string | null;
  errorMessage: string | null;
}

/** `GET /api/v2/my/access` — one Role the signed-in caller holds, the
 * project it's scoped to, the key prefixes it grants there (`keyNames` is
 * index-aligned with `keyPrefixes` — same position, friendly label instead
 * of a bare 12-char prefix, `null` where an admin hasn't named that key),
 * and that project's published Minds. No share key needed to see this —
 * it's pure discovery. One row per Role, not per project — a person with
 * two Roles on the same project gets two entries. Backs the Run sidebar's
 * "Mind Share Key" grouping (`roleName` IS the group label; a Role is
 * exactly what TP-Web calls a Mind Share Key group everywhere else in this
 * app, see RolesPage). */
export interface ProjectAccess {
  roleId: string;
  roleName: string;
  projectId: string;
  projectName: string | null;
  keyPrefixes: string[];
  keyNames: (string | null)[];
  minds: MindSummary[];
}

/** An employee's spend limit, as returned by `GET /user/spend-cap` (their own,
 * self-scoped) and `GET /api/v1/admin/user-module/users/:id/spend-cap` (an
 * admin reading someone else's).
 *
 * `maxBudgetUsd: null` means UNCAPPED — the default and the common case — and
 * is materially different from a cap of `0`, which blocks every call. Never
 * collapse the two when rendering.
 *
 * `budgetDuration` is the reset window (e.g. `"30d"`). A cap REQUIRES one: an
 * un-resetting cap blocks the person permanently once reached, so the engine
 * rejects `maxBudgetUsd` without it.
 *
 * `spentUsd` is best-effort and only present on the self-read — it lives in
 * LiteLLM rather than the engine's own database, so it is `null` when the proxy
 * is unreachable or no key has been minted yet. `null` means UNKNOWN, never
 * zero: rendering it as 0 would wrongly show a full budget remaining. */
export interface SpendCap {
  maxBudgetUsd: number | null;
  budgetDuration: string | null;
  spentUsd?: number | null;
}

/** `POST /user/topup-requests` — an employee asking an admin to raise their cap.
 * Fulfilment raises a LiteLLM budget; it never credits a wallet, because an
 * edge employee does not have one. */
export interface TopupRequestResult {
  requestId: string;
  status: string;
}
