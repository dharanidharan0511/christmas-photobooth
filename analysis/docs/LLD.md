# Low-Level Design (LLD)

**Project**: ai-studio-enterprise (TP-Web Edge Client)
**Version**: 1.0
**Date**: 2026-09-17

---

## 1. Module Breakdown (Current)

### 1.1 Entry and Bootstrapping

| Module              | File                 | Responsibility                                              |
|---------------------|----------------------|-------------------------------------------------------------|
| HTML Shell          | `index.html`         | Vite entry; injects `<script type="module" src="/src/main.tsx">` |
| React Root          | `src/main.tsx`       | Creates QueryClient; wraps app in ThemeProvider, BrowserRouter, AuthProvider, SidebarCollapseProvider |
| Route Tree          | `src/App.tsx`        | Declares all routes; RequireAdmin guard; GlobalShortcutListener |

### 1.2 Network Layer

| Module              | File                         | Functions                                                     |
|---------------------|------------------------------|---------------------------------------------------------------|
| Engine Client       | `src/lib/engineClient.ts`    | `engineRequest<T>()` (base), `fetchWhoAmI()`, `goToSsoLogin()`, `loginWithPassword()`, `listUsers()`, `listUserRoles()`, `createUser()`, `setUserSystemAdmin()`, `assignRole()`, `removeRole()`, `deleteUser()`, `reactivateUser()`, `setUserPassword()`, `fetchMySpendCap()`, `requestSpendCapIncrease()`, `getUserSpendCap()`, `setUserSpendCap()`, `listAllRoles()`, `createRole()`, `updateRole()`, `deleteRole()`, `createRoleName()`, `deleteRoleName()`, `listKnownProjects()`, `resolveShareKey()`, `deleteProjectMinds()`, `listAudit()`, `listMyMinds()`, `listMySessions()`, `listCodefloChatSessions()`, `getCodefloChatSessionMessages()`, `archiveCodefloChatSession()`, `getSessionDetail()`, `deleteSession()`, `listMyAccess()`, `listCodeRepos()`, `createCodeRepo()`, `deleteCodeRepo()`, `getCodeRepo()`, `listCodeRepoBranches()`, `getCodeRepoTree()`, `listCodeRepoFiles()`, `getCodeRepoFile()`, `uploadCodeRepoFile()`, `uploadCodeRepoFiles()`, `listMindsForUser()`, `listAllSessions()`, `executeMind()`, `chatCompletion()` |

### 1.3 Contexts and Hooks

| Hook/Context              | File                              | State Provided                                         |
|---------------------------|-----------------------------------|--------------------------------------------------------|
| AuthProvider / useAuth    | `src/hooks/useAuth.tsx`           | mode, whoami, isLoading, isSignedIn, error, useAdminKey, signOut, refetch |
| ThemeProvider / useTheme  | `src/hooks/useTheme.tsx`          | theme ("light"/"dark"), setTheme                       |
| SidebarCollapseProvider   | `src/hooks/useSidebarCollapse.tsx`| collapsed, setCollapsed                                |
| ShortcutsContext          | `src/context/ShortcutsContext.tsx`| isOpen, open, close (shortcuts modal state)            |
| useKeyboardShortcuts      | `src/hooks/useKeyboardShortcuts.ts`| Registers global keyboard shortcuts                   |
| useHighlightTheme         | `src/hooks/useHighlightTheme.ts`  | Loads correct highlight.js theme CSS for dark/light   |

### 1.4 Pages

| Page                  | File                              | Route                                  | Auth    |
|-----------------------|-----------------------------------|----------------------------------------|---------|
| LoginPage             | `src/pages/LoginPage.tsx`         | `/`                                    | Public  |
| DashboardPage         | `src/pages/DashboardPage.tsx`     | `/dashboard`                           | Any     |
| MyProfilePage         | `src/pages/MyProfilePage.tsx`     | `/user`                                | Any     |
| RunPage               | `src/pages/RunPage.tsx`           | `/run`                                 | Any     |
| CodeReposPage         | `src/pages/CodeReposPage.tsx`     | `/code-repos`                          | Any     |
| CodeRepoViewerPage    | `src/pages/CodeRepoViewerPage.tsx`| `/code-repos/:repoId/code`             | Any     |
| CodeRepoKanbanPage    | `src/pages/CodeRepoKanbanPage.tsx`| `/code-repos/:repoId/kanban`           | Any     |
| CodeRepoReviewPage    | `src/pages/CodeRepoReviewPage.tsx`| `/code-repos/:repoId/review`           | Any     |
| DocFloAgentsPage      | `src/pages/DocFloAgentsPage.tsx`  | `/docflo/agents`                       | Any     |
| DocFloAgentChatPage   | `src/pages/DocFloAgentChatPage.tsx`| `/docflo/agents/:agentId`             | Any     |
| DocFloCorpusPage      | `src/pages/DocFloCorpusPage.tsx`  | `/docflo/agents/:agentId/corpus`       | Any     |
| UsersPage             | `src/pages/UsersPage.tsx`         | `/users`                               | Admin   |
| UserDetailPage        | `src/pages/UserDetailPage.tsx`    | `/users/:id`                           | Admin   |
| RolesPage             | `src/pages/RolesPage.tsx`         | `/roles`                               | Admin   |
| AuditLogPage          | `src/pages/AuditLogPage.tsx`      | `/audit`                               | Admin   |
| CreditsPage           | `src/pages/CreditsPage.tsx`       | `/credits`                             | Admin   |

### 1.5 Shared UI Components

| Component          | File                                  | Purpose                                      |
|--------------------|---------------------------------------|----------------------------------------------|
| Button             | `src/components/ui/Button.tsx`        | Primary/secondary/ghost/lined variants       |
| Input              | `src/components/ui/Input.tsx`         | Styled text input                            |
| Select             | `src/components/ui/Select.tsx`        | Custom dropdown select                       |
| Badge              | `src/components/ui/Badge.tsx`         | Status/info/warning/admin colored tags       |
| Card               | `src/components/ui/Card.tsx`          | Content card with header/content/description |
| Table              | `src/components/ui/Table.tsx`         | Responsive data table                        |
| Spinner            | `src/components/ui/Spinner.tsx`       | Loading indicator                            |
| LinedPanel         | `src/components/ui/LinedPanel.tsx`    | Bordered panel with optional interactivity   |
| AppLogo            | `src/components/ui/AppLogo.tsx`       | Application logo (short/full variants)       |
| ApiErrorState      | `src/components/ui/ApiErrorState.tsx` | Error state with retry button                |
| EmptyState         | `src/components/ui/EmptyState.tsx`    | Empty data state with title/description      |
| ErrorState         | `src/components/ui/ErrorState.tsx`    | Generic error display                        |
| ShortcutsModal     | `src/components/ui/ShortcutsModal.tsx`| Keyboard shortcuts reference modal           |
| ProfilePopover     | `src/components/ui/ProfilePopover.tsx`| User profile popover                         |

### 1.6 Layout Components

| Component           | File                                       | Purpose                                |
|---------------------|--------------------------------------------|----------------------------------------|
| AppLayout           | `src/components/layout/AppLayout.tsx`      | Outer shell: sidebar + topbar + outlet |
| Sidebar             | `src/components/layout/Sidebar.tsx`        | Navigation sidebar with RunMindsNav    |
| Topbar              | `src/components/layout/Topbar.tsx`         | Top navigation bar                     |
| AdminSectionLayout  | `src/components/layout/AdminSectionLayout.tsx` | Layout for admin pages            |

---

## 2. Proposed Component Structure (Target — Next.js 15)

```
src/
|-- app/
|   |-- layout.tsx                    <- Root layout (providers, theme)
|   |-- (auth)/
|   |   |-- page.tsx                  <- Login page (RSC + client form)
|   |   `-- api/
|   |       |-- auth/callback/        <- SSO callback handler
|   |       `-- auth/signout/         <- Sign-out handler
|   |-- (main)/
|   |   |-- layout.tsx                <- AppLayout (sidebar + topbar, RSC)
|   |   |-- dashboard/page.tsx        <- Workbench (RSC prefetch + client cards)
|   |   |-- run/page.tsx              <- Run Minds (client component)
|   |   |-- user/page.tsx             <- My Profile (client)
|   |   |-- code-repos/
|   |   |   |-- page.tsx              <- Repo list (client)
|   |   |   `-- [repoId]/
|   |   |       |-- kanban/page.tsx
|   |   |       |-- review/page.tsx
|   |   |       `-- code/page.tsx
|   |   |-- docflo/
|   |   |   `-- agents/
|   |   |       |-- page.tsx
|   |   |       `-- [agentId]/
|   |   |           |-- page.tsx
|   |   |           `-- corpus/page.tsx
|   |   `-- (admin)/
|   |       |-- users/page.tsx
|   |       |-- users/[id]/page.tsx
|   |       |-- roles/page.tsx
|   |       |-- audit/page.tsx
|   |       `-- credits/page.tsx
|   `-- api/
|       |-- engine/[...path]/route.ts <- Engine API proxy
|       `-- stream/[mindId]/route.ts  <- SSE stream proxy
|-- components/
|   |-- layout/                       <- AppLayout, Sidebar, Topbar (RSC)
|   |-- ui/                           <- Design system components
|   |-- auth/                         <- Auth-specific components
|   |-- run/                          <- Mind execution components
|   |-- code-repos/                   <- CodeFlo components
|   `-- docflo/                       <- DocFlo components
|-- hooks/
|   |-- useAuth.ts                    <- Migrated auth hook (Next.js session)
|   |-- useTheme.ts
|   `-- use*.ts
|-- lib/
|   |-- engineClient.ts               <- SERVER-SIDE only (Route Handlers)
|   |-- clientEngineApi.ts            <- Client-side wrapper calling /api/engine/*
|   `-- utils.ts
`-- types/
    |-- engine.ts
    `-- codeRepos.ts
```

---

## 3. API Endpoint List (Edge Engine — consumed by this client)

### Authentication

| Method | Endpoint                        | Purpose                          | Auth Required |
|--------|---------------------------------|----------------------------------|---------------|
| GET    | `/user/whoami`                  | Get current user identity        | Cookie        |
| GET    | `/user/login`                   | Initiate SSO redirect            | None          |
| POST   | `/user/login/password`          | Local password sign-in           | None          |
| GET    | `/user/spend-cap`               | Get own spend cap + spend        | Cookie        |
| POST   | `/user/topup-requests`          | Request spend cap increase       | Cookie        |

### Admin — Users

| Method | Endpoint                                              | Purpose                     |
|--------|-------------------------------------------------------|-----------------------------|
| GET    | `/api/v1/admin/user-module/users`                     | List all users              |
| POST   | `/api/v1/admin/user-module/users`                     | Create user                 |
| GET    | `/api/v1/admin/user-module/users/:id/roles`           | Get user roles              |
| POST   | `/api/v1/admin/user-module/users/:id/roles`           | Assign role to user         |
| DELETE | `/api/v1/admin/user-module/users/:id/roles/:roleId`   | Remove role from user       |
| DELETE | `/api/v1/admin/user-module/users/:id`                 | Soft-delete user            |
| POST   | `/api/v1/admin/user-module/users/:id/reactivate`      | Reactivate user             |
| POST   | `/api/v1/admin/user-module/users/:id/system-admin`    | Set system admin flag       |
| POST   | `/api/v1/admin/user-module/users/:id/password`        | Set/clear user password     |
| GET    | `/api/v1/admin/user-module/users/:id/spend-cap`       | Get user spend cap          |
| PUT    | `/api/v1/admin/user-module/users/:id/spend-cap`       | Set user spend cap          |

### Admin — Roles

| Method | Endpoint                                             | Purpose                      |
|--------|------------------------------------------------------|------------------------------|
| GET    | `/api/v1/admin/user-module/roles`                    | List all roles               |
| POST   | `/api/v1/admin/user-module/roles`                    | Create role                  |
| PUT    | `/api/v1/admin/user-module/roles/:id`                | Update role                  |
| DELETE | `/api/v1/admin/user-module/roles/:id`                | Delete role                  |
| POST   | `/api/v1/admin/user-module/role-names`               | Create bare role name        |
| DELETE | `/api/v1/admin/user-module/role-names/:name`         | Delete role name (cascades)  |
| GET    | `/api/v1/admin/user-module/projects`                 | List known projects          |
| POST   | `/api/v1/admin/user-module/resolve-share-key`        | Resolve key to project       |
| DELETE | `/api/v1/admin/user-module/projects/:id`             | Clean up stale project minds |

### Admin — Audit

| Method | Endpoint                                    | Purpose                     |
|--------|---------------------------------------------|-----------------------------|
| GET    | `/api/v1/admin/user-module/audit?limit=N`   | List audit entries          |

### Self-service (V2)

| Method | Endpoint                                        | Purpose                          |
|--------|-------------------------------------------------|----------------------------------|
| GET    | `/api/v2/my/access`                             | Get own roles + minds            |
| GET    | `/api/v2/minds`                                 | List minds (share-key auth)      |
| GET    | `/api/v2/sessions?limit=N&mind_id=X`            | List own sessions                |
| GET    | `/api/v2/sessions/:id`                          | Get session detail               |
| DELETE | `/api/v2/sessions/:id`                          | Delete session                   |
| GET    | `/api/v2/chat-sessions?mind_id=X&repo_id=Y`     | List CodeFlo chat sessions       |
| GET    | `/api/v2/chat-sessions/:id/messages`            | Get chat session messages        |
| POST   | `/api/v2/chat-sessions/:id/archive`             | Archive chat session             |
| POST   | `/api/v2/execute/:mindId`                       | Execute mind (SSE stream)        |
| POST   | `/api/v2/chat/completions`                      | Chat completion (SSE stream)     |
| GET    | `/api/v2/admin/users/:id/minds`                 | Admin: browse minds for user     |
| GET    | `/api/v2/admin/sessions`                        | Admin: list fleet sessions       |

### Code Repos (V2)

| Method | Endpoint                                      | Purpose                          |
|--------|-----------------------------------------------|----------------------------------|
| GET    | `/api/v2/code-repos`                          | List repos                       |
| POST   | `/api/v2/code-repos`                          | Create repo                      |
| GET    | `/api/v2/code-repos/:id`                      | Get repo                         |
| DELETE | `/api/v2/code-repos/:id`                      | Delete repo                      |
| GET    | `/api/v2/code-repos/:id/branches`             | List branches                    |
| GET    | `/api/v2/code-repos/:id/tree?path=&source=`   | List directory entries           |
| GET    | `/api/v2/code-repos/:id/file?path=&source=`   | Get file content                 |
| POST   | `/api/v2/code-repos/:id/upload`               | Upload file or ZIP               |

---

## 4. Data Access Patterns (Current)

| Pattern                       | Mechanism                                  | Cache Key Example                     |
|-------------------------------|--------------------------------------------|---------------------------------------|
| Read (query)                  | `useQuery({ queryKey, queryFn })`          | `["whoami"]`, `["users"]`, `["myAccess"]` |
| Write (mutation)              | `useMutation({ mutationFn, onSuccess })`   | Invalidates parent query on success   |
| Streaming SSE                 | Manual `fetch()` + `ReadableStream`        | No TanStack Query cache               |
| Prefetch on navigate          | `queryClient.prefetchQuery()`              | Warms cache before route change       |
| Parallel queries              | `useQueries({ queries: [] })`              | Per-user role queries in Users table  |
| Stale-while-revalidate        | `staleTime` per query                      | whoami=15s, repos=120s, sessions=60s  |

---

## 5. State Machine — Authentication (Detailed)

```
               +----------------+
               | UNINITIALIZED  |
               | (page load)    |
               +-------+--------+
                       |
          +------------+------------+
          |            |            |
    [admin key]  [locally       [no admin key,
    in storage   signed out]    not signed out]
          |            |            |
          v            v            v
       +-----+     +------+   +-----------+
       | KEY |     | NONE |   | LOADING   |
       | mode|     | mode |   | (whoami)  |
       +-----+     +------+   +-----+-----+
          |                         |
          |              +----------+---------+
          |           401/null             200+body
          |              |                   |
          |           +------+           +--------+
          |           | NONE |           | COOKIE |
          |           | mode |           | mode   |
          |           +------+           +--------+
          |
    [sign out]
          |
          v
       +------+
       | NONE |
       | mode |
       +------+
```

---

## 6. SSE Streaming Architecture (Current)

```
RunPage.tsx (useMutation)
    |
    v
chatCompletion() or executeMind()
    |
    v
streamSse(res, onEvent)
    |-- reads ReadableStreamDefaultReader<Uint8Array>
    |-- decodes UTF-8 chunks
    |-- splits on "\n\n" frame boundaries
    |-- extracts "data:" lines
    |-- parses named "event:" headers
    |-- calls onEvent(data, eventName?) per frame
    |-- detects terminal events ([DONE], turn_completed, finish_reason=stop)
    |-- on terminal: drainSseReader() without cancel
    |
    v
createChatStreamApplier (RunPage)
    |-- queueDelta(): accumulates content chunks
    |-- requestAnimationFrame(): flushes once per frame
    |-- Named event handlers: thinking, tool_use, tool_result, turn_cost, turn_completed
    |-- patchAssistant(): immutable update to last assistant bubble
```
