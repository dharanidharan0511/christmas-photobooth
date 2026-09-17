# Software Requirements Specification (SRS)

**Project**: ai-studio-enterprise (TP-Web Edge Client)
**Version**: 1.0
**Date**: 2026-09-17
**Derived from**: Static analysis of source code

---

## 1. Functional Requirements

### FR-01: Authentication

| ID      | Requirement                                                                              | Source File                     |
|---------|------------------------------------------------------------------------------------------|---------------------------------|
| FR-01-1 | The system must support SSO (SAML) authentication via corporate IdP redirect             | `src/pages/LoginPage.tsx:143`   |
| FR-01-2 | The system must support local email/password authentication as a fallback                | `src/pages/LoginPage.tsx:63`    |
| FR-01-3 | The system must support admin API key authentication for service accounts                | `src/lib/engineClient.ts:57`    |
| FR-01-4 | Admin key must be stored in `sessionStorage` (not persisted across browser restarts)     | `src/lib/engineClient.ts:68`    |
| FR-01-5 | The system must display SSO error codes as human-readable messages                       | `src/pages/LoginPage.tsx:21`    |
| FR-01-6 | The system must handle password lockout with lockedUntil timestamp display               | `src/pages/LoginPage.tsx:39`    |
| FR-01-7 | Sign-out in cookie mode must be a local-only operation (no engine logout endpoint)       | `src/hooks/useAuth.tsx:56`      |
| FR-01-8 | WhoAmI query must refresh every 15 seconds and on window focus                           | `src/hooks/useAuth.tsx:34`      |

### FR-02: Dashboard (Workbench)

| ID      | Requirement                                                                              | Source File                     |
|---------|------------------------------------------------------------------------------------------|---------------------------------|
| FR-02-1 | Dashboard must display three suite cards: CodeFlo+, DocFlo+, Run Minds                  | `src/pages/DashboardPage.tsx:305` |
| FR-02-2 | Dashboard must display the user's granted Minds as app cards, deduplicated by mind ID   | `src/pages/DashboardPage.tsx:43` |
| FR-02-3 | App cards must show "last run" relative time from the user's session history             | `src/pages/DashboardPage.tsx:59` |
| FR-02-4 | Suite cards must prefetch data before navigating to the suite page                       | `src/pages/DashboardPage.tsx:244` |
| FR-02-5 | Admin users must see quick-link buttons to Users, Roles, Credits, Audit Log              | `src/pages/DashboardPage.tsx:401` |

### FR-03: Run Minds

| ID      | Requirement                                                                              | Source File                     |
|---------|------------------------------------------------------------------------------------------|---------------------------------|
| FR-03-1 | Users must be able to select a Mind from the sidebar and execute it in Execute mode      | `src/pages/RunPage.tsx:908`     |
| FR-03-2 | Execute mode must accept a JSON inputs payload and stream SSE events                     | `src/pages/RunPage.tsx:1034`    |
| FR-03-3 | Chat mode must support multi-turn conversation with prior_session_id continuation        | `src/pages/RunPage.tsx:1058`    |
| FR-03-4 | SSE content deltas must be batched via requestAnimationFrame for smooth streaming        | `src/pages/RunPage.tsx:205`     |
| FR-03-5 | The system must display tool use, thinking, and turn_cost as structured activity chips   | `src/pages/RunPage.tsx:295`     |
| FR-03-6 | Non-admin users must never be prompted to paste a key (server resolves stored Role key)  | `src/pages/RunPage.tsx:918`     |
| FR-03-7 | Admin users must be able to browse and run Minds as any other user                       | `src/pages/RunPage.tsx:629`     |
| FR-03-8 | Users must be able to view session detail (input/output/error) in a slide-over panel     | `src/pages/RunPage.tsx:724`     |
| FR-03-9 | Users must be able to soft-delete their own sessions                                     | `src/pages/RunPage.tsx:1016`    |
| FR-03-10| Admin users must see a Fleet Sessions table with all identity-attributed runs             | `src/pages/RunPage.tsx:866`     |

### FR-04: Code Repository Management (CodeFlo+)

| ID      | Requirement                                                                              | Source File                     |
|---------|------------------------------------------------------------------------------------------|---------------------------------|
| FR-04-1 | Users must be able to list, create, and delete code repositories                         | `src/lib/engineClient.ts:671`   |
| FR-04-2 | Users must be able to browse the file tree of a repository (workspace/git/vcs source)   | `src/lib/engineClient.ts:718`   |
| FR-04-3 | Users must be able to view individual file contents with syntax highlighting             | `src/lib/engineClient.ts:869`   |
| FR-04-4 | Users must be able to upload single files or ZIP archives to a repository                | `src/lib/engineClient.ts:891`   |
| FR-04-5 | The system must skip indexing of standard build/dependency directories                   | `src/lib/engineClient.ts:735`   |
| FR-04-6 | File index must be capped at 2,000 files and 80 API requests                            | `src/lib/engineClient.ts:751`   |
| FR-04-7 | Users must be able to chat with an AI Mind about a repository (CodeFlo chat)            | `src/lib/engineClient.ts:613`   |
| FR-04-8 | Users must be able to view the Kanban board for a repository                            | `src/pages/CodeRepoKanbanPage.tsx` |
| FR-04-9 | Users must be able to view AI-generated code review for a repository                    | `src/pages/CodeRepoReviewPage.tsx` |

### FR-05: DocFlo Agent Management

| ID      | Requirement                                                                              | Source File                     |
|---------|------------------------------------------------------------------------------------------|---------------------------------|
| FR-05-1 | Users must be able to list and select DocFlo agents                                      | `src/pages/DocFloAgentsPage.tsx` |
| FR-05-2 | Users must be able to chat with a selected DocFlo agent                                  | `src/pages/DocFloAgentChatPage.tsx` |
| FR-05-3 | Users must be able to manage the corpus (datasources) for an agent                       | `src/pages/DocFloCorpusPage.tsx` |

### FR-06: Admin — User Management

| ID      | Requirement                                                                              | Source File                     |
|---------|------------------------------------------------------------------------------------------|---------------------------------|
| FR-06-1 | Admins must be able to list all users with their statuses and role assignments           | `src/pages/UsersPage.tsx:287`   |
| FR-06-2 | Admins must be able to create users with optional initial role and auth mode             | `src/pages/UsersPage.tsx:25`    |
| FR-06-3 | Admins must be able to soft-delete and reactivate users                                  | `src/pages/UserDetailPage.tsx`  |
| FR-06-4 | Admins must be able to set/clear local passwords for users                               | `src/pages/UserDetailPage.tsx`  |
| FR-06-5 | Admins must be able to grant/revoke system_admin status                                  | `src/lib/engineClient.ts:318`   |
| FR-06-6 | Admins must be able to assign roles to users inline from the Users list                  | `src/pages/UsersPage.tsx:251`   |

### FR-07: Admin — Role Management

| ID      | Requirement                                                                              | Source File                     |
|---------|------------------------------------------------------------------------------------------|---------------------------------|
| FR-07-1 | Admins must be able to list, create, update, and delete roles                            | `src/lib/engineClient.ts:431`   |
| FR-07-2 | Admins must be able to store raw key values for role prefixes (keyless execution)        | `src/lib/engineClient.ts:447`   |
| FR-07-3 | Admins must be able to resolve which project a pasted key belongs to                     | `src/lib/engineClient.ts:542`   |
| FR-07-4 | Admins must be able to clean up stale project Minds                                      | `src/lib/engineClient.ts:558`   |

### FR-08: Admin — Credits / Spend Caps

| ID      | Requirement                                                                              | Source File                     |
|---------|------------------------------------------------------------------------------------------|---------------------------------|
| FR-08-1 | Employees must be able to view their own spend cap and current spend                     | `src/lib/engineClient.ts:380`   |
| FR-08-2 | Employees must be able to request a spend cap increase                                   | `src/lib/engineClient.ts:386`   |
| FR-08-3 | Admins must be able to view and set spend caps for any user                              | `src/lib/engineClient.ts:395`   |
| FR-08-4 | The system must display null maxBudgetUsd as "uncapped", not as "$0.00"                 | `src/types/engine.ts:174`       |

### FR-09: Admin — Audit Log

| ID      | Requirement                                                                              | Source File                     |
|---------|------------------------------------------------------------------------------------------|---------------------------------|
| FR-09-1 | Admins must be able to view a paginated audit log of all admin actions                   | `src/lib/engineClient.ts:566`   |
| FR-09-2 | Audit entries must include actor, action, detail (JSON), and timestamp                   | `src/types/engine.ts:49`        |

---

## 2. Non-Functional Requirements

### NFR-01: Performance

| ID       | Requirement                                                                            |
|----------|----------------------------------------------------------------------------------------|
| NFR-01-1 | Dashboard initial paint must show spinner within 100ms; data loads async              |
| NFR-01-2 | SSE content deltas must render at the display frame rate (rAF batching required)       |
| NFR-01-3 | TanStack Query cache staleTime for whoami = 15s; code repos = 120s; sessions = 60s    |
| NFR-01-4 | File index walk is bounded (max 2,000 files, 80 requests, concurrency 8)              |
| NFR-01-5 | QueryClient retry = 1 (one retry on failure); refetchOnWindowFocus disabled globally  |

### NFR-02: Security

| ID       | Requirement                                                                            |
|----------|----------------------------------------------------------------------------------------|
| NFR-02-1 | All network requests must go only to `VITE_ENGINE_URL` (no other origins)             |
| NFR-02-2 | Admin key must NOT survive browser restart (sessionStorage, not localStorage)          |
| NFR-02-3 | Mind Share Key must be cleared from localStorage when non-admin session starts        |
| NFR-02-4 | SSO `redirect_uri` must be encoded before injection into the URL                      |
| NFR-02-5 | Credentials mode must be "include" for all identity-attributed requests                |

### NFR-03: Accessibility

| ID       | Requirement                                                                            |
|----------|----------------------------------------------------------------------------------------|
| NFR-03-1 | Interactive elements must have `tabIndex`, `role`, `aria-*` attributes                |
| NFR-03-2 | Modal dialogs must use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`        |
| NFR-03-3 | Buttons must have descriptive labels or `aria-label` attributes                       |
| NFR-03-4 | Focus must be managed on modal open/close                                             |
| NFR-03-5 | Keyboard shortcuts must be documented and discoverable (ShortcutsModal)               |

### NFR-04: Usability

| ID       | Requirement                                                                            |
|----------|----------------------------------------------------------------------------------------|
| NFR-04-1 | Support dark and light themes persisted in localStorage                               |
| NFR-04-2 | Sidebar must be collapsible; state persisted across navigation                        |
| NFR-04-3 | Error states must show actionable messages with retry options                         |
| NFR-04-4 | Empty states must explain what the section is and how to populate it                  |

### NFR-05: Compatibility

| ID       | Requirement                                                                            |
|----------|----------------------------------------------------------------------------------------|
| NFR-05-1 | Must work in latest Chromium, Firefox, and Safari                                    |
| NFR-05-2 | Must support deployment at a configurable base path (`import.meta.env.BASE_URL`)      |
| NFR-05-3 | TypeScript strict mode must be enabled                                                |

### NFR-06: Maintainability

| ID       | Requirement                                                                            |
|----------|----------------------------------------------------------------------------------------|
| NFR-06-1 | All network calls must go through `src/lib/engineClient.ts` — no direct `fetch()` elsewhere |
| NFR-06-2 | All shared UI must be in `src/components/ui/`                                        |
| NFR-06-3 | All auth state must be managed through `useAuth` hook                                 |
