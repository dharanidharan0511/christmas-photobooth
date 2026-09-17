# Business Logic Extraction

**Project**: ai-studio-enterprise
**Analysis Date**: 2026-09-17

All citations reference files under the project root. Line numbers are approximate based on static analysis.

---

## 1. Authentication and Authorization

### File: `src/hooks/useAuth.tsx` (lines 1-120)

**Workflow — Sign-in state machine**:
1. On mount, `AuthProvider` reads `sessionStorage` for `tp-web:admin-key` and `tp-web:local-signout`.
2. If admin key is present → `mode = "key"`, `isSignedIn = true`, whoami query is disabled.
3. If locally signed out → `mode = "none"`, `isSignedIn = false`, whoami query is disabled.
4. Otherwise → `useQuery(["whoami"])` calls `fetchWhoAmI()` (engine `GET /user/whoami`).
   - 200 response with body → `mode = "cookie"`, `isSignedIn = true`.
   - 401 response → function returns `null` → `mode = "none"`, `isSignedIn = false`.

**Business Rules**:
- Admin key (`mode = "key"`) gives full sign-in status without SSO. Used for service-level access (lines 73-85).
- Local sign-out (`tp-web:local-signout`) overrides everything; prevents whoami polling (lines 86-97).
- `whoami` query is stale after 15 seconds and refetched on window focus (`staleTime: 15_000`, `refetchOnWindowFocus: true`, lines 34-41).
- Admin key stored in `sessionStorage` (NOT `localStorage`) — expires on browser close. Source: `src/lib/engineClient.ts` lines 57-74.

**State Machine — AuthMode**:
```
none (not signed in)
  --> [SSO redirect] --> cookie (SSO session)
  --> [paste admin key] --> key (service credential)
cookie
  --> [sign out] --> none (local only, cookie stays alive on engine)
key
  --> [sign out] --> none (key cleared from sessionStorage)
```

### File: `src/App.tsx` (lines 29-33)

**Business Rule — RequireAdmin guard**:
- Pages `/users`, `/users/:id`, `/roles`, `/audit`, `/credits` require admin.
- Admin check: `auth.mode === "key" OR auth.whoami?.isAdmin === true`.
- Non-admins are redirected to `/dashboard` (not a 403 page).

### File: `src/pages/LoginPage.tsx` (lines 53-281)

**Workflow — Login Page**:
1. If `auth.isLoading` → show spinner (prevents flash of login form before redirect, line 95-101).
2. If `auth.isSignedIn` → `<Navigate to="/dashboard">` (lines 103-106).
3. Otherwise render three sign-in methods:
   - **SSO/SAML**: button click calls `goToSsoLogin()` which does `window.location.href` redirect to `${ENGINE_URL}/user/login?redirect_uri=...` (lines 143-155).
   - **Password**: form with email + password fields, calls `POST /user/login/password` via `loginWithPassword()` (lines 63-69, 169-232).
   - **Admin key** (Advanced section): input field stores key in sessionStorage via `auth.useAdminKey()` (lines 244-278).

**Business Rule — SSO error handling** (lines 21-51):
- `?sso_error=<code>` query param is read on mount, stored in local state, then stripped from URL.
- Error codes mapped to human messages: `invalid_assertion`, `replayed_assertion`, `user_disabled`, `state_mismatch`, etc.

**Business Rule — Password login lockout** (lines 39-51):
- `too_many_attempts` error includes `lockedUntil` timestamp; displays as "Try again after HH:MM".
- `invalid_credentials` shows "Incorrect email or password."

---

## 2. Dashboard / Workbench

### File: `src/pages/DashboardPage.tsx` (lines 1-428)

**Workflow — Dashboard data loading**:
1. `listMyAccess()` → `GET /api/v2/my/access` — all Projects/Roles/Minds the user has.
2. `listCodeRepos()` → `GET /api/v2/code-repos` — count of connected repos.
3. `listMySessions(100)` → `GET /api/v2/sessions?limit=100` — recent sessions for "last run" display.

**Business Rule — Mind deduplication** (`flattenMinds`, lines 43-57):
- A user can hold multiple Roles on the same project.
- Minds are deduplicated by `mind.id` using a `Set<string>`; only first occurrence kept.
- Associated `keyPrefix` is the first key prefix from the first matching project.

**Business Rule — "Last run" timestamp** (`buildLastRunMap`, lines 59-66):
- Sessions come newest-first from API.
- Map is built by iterating sessions; first hit per `mindId` wins (most recent).
- Displayed as: "last run today, HH:MM" / "last run yesterday" / "last run N days ago" / date.

**Business Rule — Mind type badge** (`mindTypeBadge`, lines 34-41):
- Tags (lowercase) determine badge: `dag` → "DAG" (warning color); `codeflo`/`code`/`docflo`/`doc`/`orchestrat`/`chat` → "Chat" (accent color); else → "Mind" (neutral).

**Workflow — Navigation prefetch** (`navigateWhenReady`, lines 244-257):
- Before navigating to a suite, the dashboard prefetches the relevant query data.
- A spinner shows on the clicked card during prefetch (via `pendingNav` state).
- Navigation completes after one `requestAnimationFrame` to ensure the spinner paints.

---

## 3. Run Minds (Mind Execution)

### File: `src/pages/RunPage.tsx` (lines 908-1548)

**Workflow — Execute mode**:
1. User selects a Mind from the sidebar (routed via `?mindId=` query param).
2. Inputs JSON field pre-populated with Mind's declared inputs schema.
3. User clicks "Execute" → `POST /api/v2/execute/:mindId` with `stream: true`.
4. SSE stream received; events parsed and displayed in timeline.
5. `execution_completed` event → show output text box.
6. Session appears in "My Sessions" table after invalidation.

**Workflow — Chat mode**:
1. User types message; pressing Enter or "Send" triggers chat completion.
2. `POST /api/v2/chat/completions` with `prior_session_id` on turn 2+ (line 1058-1073).
3. OpenAI-compat SSE streamed; content deltas batched with `requestAnimationFrame` (lines 206-230).
4. Named lifecycle events (`thinking`, `tool_use`, `tool_result`, `turn_cost`, `turn_completed`) handled separately from content chunks.

**Business Rule — Key resolution** (lines 918-923):
- Non-admins always send empty `activeKey`; engine resolves stored Role key server-side.
- Admins may paste a key manually via Advanced section; key stored in `localStorage` (key-mode only).
- Defensive cleanup removes leftover admin key from localStorage on non-admin session start (lines 941-945).

**Business Rule — Terminal SSE events** (engineClient.ts lines 972-1003):
- `[DONE]` data value, named events `turn_completed`/`waiting_for_input`, engine types `execution.completed`/`execution.failed`/`codeflo.chat.turn_completed`, and OpenAI `finish_reason: "stop"/"length"` all terminate the stream.
- After terminal event, stream is drained without cancelling the connection (avoids cutting engine's `finally` session-complete write).

**Business Rule — Chat prompt aliases** (RunPage.tsx lines 586-603):
- Input fields named `message`, `user_message`, `user_input`, `query`, `question`, `prompt`, `text` are consumed by the chat composer itself; not rendered as extra form fields.

**Business Rule — "Browse as user" (admin only)** (lines 629-691):
- Admins can select any user and see their granted Minds.
- Uses `GET /api/v2/admin/users/:id/minds` endpoint (no share key involved — discovery only).

**Calculation — Output string extraction** (`extractOutputString`, lines 521-542):
- Prefers top-level string values in `outputs` object.
- Falls back to checking keys `content`, `text`, `response`, `answer`, `result`, `message`, `output` inside nested objects.
- Mirrors engine's own `_extract_output_string` function.

---

## 4. User Management (Admin)

### File: `src/pages/UsersPage.tsx` (lines 287-407)

**Workflow — Add user**:
1. Admin enters email (required), optional display name.
2. Selects auth mode: SSO (default) or Local password.
3. Optionally assigns a Role or `system_admin` flag.
4. `createUser()` → `POST /api/v1/admin/user-module/users`.
5. If password mode and `password.length >= 8`: `setUserPassword()` → `POST /api/v1/admin/user-module/users/:id/password`.

**Business Rule — Role deduplication** (`InlineRoleAssign`, lines 251-285):
- Roles may map to multiple projects (each its own row in `edge_roles`).
- Already-assigned role NAMES are tracked to prevent re-assigning the same logical role.
- Picker excludes roles whose name is already in `assignedNames`.

**Business Rule — Inline role assignment**:
- Users table supports inline role assignment without navigating to the detail page.
- `Select` dropdown lists unassigned catalog roles; selecting one fires `POST /api/v1/admin/user-module/users/:id/roles`.

### File: `src/pages/UserDetailPage.tsx` (admin user detail)

**Business Rules**:
- Admin can soft-delete a user (`deleteUser` → sets `status = "disabled"`, revokes live session).
- `reactivateUser` restores access without re-setup (Role assignments preserved).
- `setUserSystemAdmin` grants/revokes system admin flag.
- `setUserPassword` clears lockout when a new password is issued.

---

## 5. Roles and Key Management (Admin)

### File: `src/pages/RolesPage.tsx`

**Business Rules**:
- A Role maps a NAME to a (projectId, keyPrefixes[]) tuple.
- Roles can be "bare" (name reserved, no project mapping) — must not be offered in "assign to user" pickers.
- `createRoleName` creates a bare Role; `createRole` creates with project mapping.
- Admin can store a raw key value (`rawKeys`) for a prefix — enables keyless execution by non-admin users (schema v37).
- `resolveShareKey` looks up which project a pasted raw key belongs to.
- `deleteProjectMinds` soft-deletes all Minds for a stale projectId.

**Business Rule — Role option labels** (`src/lib/utils.ts`):
- Format: `<roleName> · <projectName or projectId>` when a project is associated.
- Disambiguates multiple roles with the same name across different projects.

---

## 6. Credit / Spend Cap Management

### File: `src/pages/CreditsPage.tsx` and `src/lib/engineClient.ts` (lines 370-423)

**Business Rules**:
- Employees have NO wallet; they draw on workspace owner's credit pool.
- `maxBudgetUsd: null` = uncapped (default) — materially different from `0` (full block).
- A non-null `maxBudgetUsd` REQUIRES a `budgetDuration`; engine rejects 400 otherwise.
- Setting a cap with no reset window would permanently block the employee on hitting the limit.
- `spentUsd` is LiteLLM-sourced, best-effort, only on self-read — `null` means UNKNOWN, not zero.
- `requestSpendCapIncrease` creates a PENDING request; does not change cap immediately.
- `setUserSpendCap` 200 with `live: false` = cap saved but LiteLLM push not confirmed — cap applies at next key mint, not lost.

---

## 7. Code Repository Management (CodeFlo+)

### File: `src/lib/engineClient.ts` (lines 669-930)

**Workflow — File index for @-mentions** (`listCodeRepoFiles`, lines 847-867):
1. If source = "git": call `collectRecursiveGitFiles` (single `ls-tree -r` call, recursive).
2. If source = "workspace": try git path first; fall back to bounded directory walk on failure.
3. If source = "vcs" (GitHub/GitLab/Bitbucket): directory-by-directory walk.

**Business Rule — Directory walk limits**:
- Max 2,000 files (`FILE_INDEX_MAX = 2000`).
- Max 80 API requests (`FILE_INDEX_MAX_REQUESTS = 80`).
- Concurrency: 8 directories fetched in parallel (`FILE_INDEX_WALK_CONCURRENCY = 8`).

**Business Rule — Skipped directories**:
- `node_modules`, `.git`, `dist`, `build`, `.venv`, `venv`, `__pycache__`, `.next`, `coverage`, `vendor`, `.turbo`, `.cache`, `target` are never indexed.

**Workflow — File upload** (`uploadCodeRepoFiles`, lines 909-932):
- One file uploaded per API call (engine accepts single file per request).
- Multiple files uploaded sequentially.
- Commit message suffixed with `(filename)` for each file in a multi-file batch.

---

## 8. DocFlo Agent Chat

### File: `src/pages/DocFloAgentChatPage.tsx`

**Workflow — Agent chat**:
1. User selects a DocFlo agent from the agents list.
2. Chat uses `chatCompletion()` with `operatorType: "codeflo_chat"` or similar.
3. `priorSessionId` passed on turn 2+ to resume same session.
4. Session ID returned from `X-Session-Id` response header.

---

## 9. Theme and UI State

### File: `src/hooks/useTheme.tsx`

**Business Rules**:
- Theme persisted to `localStorage`.
- System preference respected as default.
- Controlled via `ThemeProvider` context.

### File: `src/hooks/useKeyboardShortcuts.ts`

**Business Rules**:
- Global keyboard shortcuts registered via `useKeyboardShortcuts` hook.
- Shortcuts modal accessible via `ShortcutsContext`.

---

## 10. External Integrations

| Integration              | Type        | Where                                    | Endpoint(s)                              |
|--------------------------|-------------|------------------------------------------|------------------------------------------|
| Edge Engine REST API     | REST + SSE  | `src/lib/engineClient.ts` (all)          | `VITE_ENGINE_URL` (configurable)         |
| SSO/SAML Identity Provider | OAuth redirect | `src/lib/engineClient.ts:goToSsoLogin` | `GET /user/login?redirect_uri=...`       |
| VCS providers (GitHub, GitLab, Bitbucket) | Mediated via engine | engineClient.ts code-repo functions | `/api/v2/code-repos/:id/tree` etc. |
| LiteLLM proxy (spend caps) | Backend service | Spend cap data (spentUsd) | Engine proxies; not directly called by client |

No direct payment gateway, email service, or push notification integration in the frontend codebase.
