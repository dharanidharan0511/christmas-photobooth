# Repository Metadata

**Project**: ai-studio-enterprise
**Description**: Focused TP-Web client for the AI Studio edge engine. Single-page React application that talks exclusively to the edge engine REST API.
**Analysis Date**: 2026-09-17

---

## 1. Languages and Version Hints

| Language   | Version Hint           | Evidence                                         |
|------------|------------------------|--------------------------------------------------|
| TypeScript | ~5.8.3                 | `tsconfig.json`, `package.json` devDependencies |
| JavaScript | ES2020+ (ESM)          | `"type": "module"` in package.json               |
| CSS        | PostCSS + Tailwind 3   | `postcss.config.js`, `tailwind.config.js`        |
| SCSS       | via assets/scss/       | `assets/scss/styles.scss`                        |

---

## 2. Framework

**Primary Framework**: React 18.3.1 (functional components, hooks only)
**Build Tool**: Vite 6.3.5
**Router**: React Router DOM 6.27.0
**Data Fetching**: TanStack React Query 5.59.16
**Styling**: Tailwind CSS 3.4.14

---

## 3. Database Technology

This application contains **no local database**. It is a pure SPA that communicates exclusively with the remote edge engine at `VITE_ENGINE_URL`. Persistence is fully server-side in the edge engine.

Data is fetched via:
- REST API calls through `src/lib/engineClient.ts` (the sole network module)
- Responses cached in TanStack Query's in-memory client-side cache

---

## 4. All Dependencies

### Runtime Dependencies (`package.json > dependencies`)

| Package                  | Version    | Purpose                                    |
|--------------------------|------------|--------------------------------------------|
| `@tanstack/react-query`  | ^5.59.16   | Server-state caching and async data hooks  |
| `highlight.js`           | ^11.11.1   | Syntax highlighting for code viewer        |
| `lucide-react`           | ^1.32.0    | Icon library                               |
| `react`                  | ^18.3.1    | UI framework                               |
| `react-dom`              | ^18.3.1    | DOM rendering                              |
| `react-markdown`         | ^10.1.0    | Markdown rendering in chat responses       |
| `react-router-dom`       | ^6.27.0    | Client-side routing                        |

### Development Dependencies (`package.json > devDependencies`)

| Package                | Version    | Purpose                                    |
|------------------------|------------|--------------------------------------------|
| `@types/node`          | ^22.19.0   | Node.js type declarations                  |
| `@types/react`         | ^18.3.12   | React type declarations                    |
| `@types/react-dom`     | ^18.3.1    | ReactDOM type declarations                 |
| `@vitejs/plugin-react` | ^4.7.0     | Vite React plugin (Babel-based fast HMR)   |
| `autoprefixer`         | ^10.4.20   | CSS vendor prefixes via PostCSS            |
| `postcss`              | ^8.4.47    | CSS transformation pipeline                |
| `tailwindcss`          | ^3.4.14    | Utility-first CSS framework                |
| `typescript`           | ~5.8.3     | TypeScript compiler                        |
| `vite`                 | ^6.3.5     | Frontend build tool and dev server         |

---

## 5. File Count by Extension

Counts are derived from the `src/` directory and project root configuration files (excluding `node_modules/`, `.git/`, `dist/`).

| Extension | Count | Locations                                   |
|-----------|-------|---------------------------------------------|
| `.tsx`    | 52    | src/pages/, src/components/, src/hooks/, src/context/ |
| `.ts`     | 18    | src/lib/, src/types/, src/data/, src/hooks/ |
| `.jsx`    | 3     | src/App.jsx, src/ChristmasPhotoBooth.jsx, src/main.jsx |
| `.js`     | 4     | vite.config.js, tailwind.config.js, postcss.config.js, assets/js/main.js |
| `.css`    | 2     | src/index.css, assets/css/styles.css        |
| `.scss`   | 1     | assets/scss/styles.scss                     |
| `.json`   | 5     | package.json, tsconfig*.json (3), .env (not JSON but config) |
| `.html`   | 1     | index.html                                  |
| `.md`     | 2     | README.md, TEMPLATES_REPORT.md              |
| **Total** | **88**|                                             |

---

## 6. Total Lines of Code (Estimated)

Significant files measured during analysis:

| File                                   | Approx. Lines |
|----------------------------------------|---------------|
| src/lib/engineClient.ts                | 1,170         |
| src/pages/RunPage.tsx                  | 1,549         |
| src/pages/DashboardPage.tsx            | 428           |
| src/pages/UsersPage.tsx                | 407           |
| src/pages/LoginPage.tsx                | 282           |
| src/hooks/useAuth.tsx                  | 120           |
| src/types/engine.ts                    | 187           |
| src/types/codeRepos.ts                 | 79            |
| src/App.tsx                            | 87            |
| src/main.tsx                           | 35            |
| Remaining ~65 source files (avg 130)   | 8,450         |
| **TOTAL ESTIMATED**                    | **~12,794**   |

**Codebase size classification**: **medium** (5,000 – 20,000 LOC)

---

## 7. Directory Structure

```
ai-studio-enterprise/
|-- index.html                  <- Vite SPA entry point
|-- package.json                <- NPM manifest + scripts
|-- vite.config.ts / .js        <- Vite configuration (proxy, plugins)
|-- tsconfig.json               <- Root TS config
|-- tsconfig.app.json           <- App-specific TS config
|-- tsconfig.node.json          <- Node/Vite tooling TS config
|-- tailwind.config.js          <- Tailwind CSS configuration
|-- postcss.config.js           <- PostCSS configuration
|-- .env                        <- Environment variables (VITE_ENGINE_URL etc.)
|-- assets/
|   |-- css/styles.css          <- Legacy flat CSS (non-Tailwind)
|   |-- scss/styles.scss        <- Legacy SCSS
|   `-- js/main.js              <- Legacy JS entry
|-- public/
|   `-- favicon.svg
`-- src/
    |-- main.tsx                <- React root — providers, QueryClient, BrowserRouter
    |-- App.tsx                 <- Route tree, RequireAdmin guard
    |-- index.css               <- Tailwind directives + custom CSS vars
    |-- vite-env.d.ts           <- Vite env type augmentation
    |-- pages/
    |   |-- LoginPage.tsx       <- SSO / password / admin-key login
    |   |-- DashboardPage.tsx   <- Workbench — suite cards + "Your apps" grid
    |   |-- RunPage.tsx         <- Execute / Chat a Mind, session history
    |   |-- CodeReposPage.tsx   <- Code repo list
    |   |-- CodeRepoViewerPage.tsx
    |   |-- CodeRepoKanbanPage.tsx
    |   |-- CodeRepoReviewPage.tsx
    |   |-- DocFloAgentsPage.tsx
    |   |-- DocFloAgentChatPage.tsx
    |   |-- DocFloCorpusPage.tsx
    |   |-- UsersPage.tsx       <- Admin: user list + inline role assign
    |   |-- UserDetailPage.tsx  <- Admin: per-user detail + password management
    |   |-- RolesPage.tsx       <- Admin: role catalog + key mappings
    |   |-- AuditLogPage.tsx    <- Admin: audit log
    |   |-- CreditsPage.tsx     <- Admin: spend caps + topup requests
    |   `-- MyProfilePage.tsx   <- Self-service: profile + own spend cap
    |-- components/
    |   |-- layout/
    |   |   |-- AppLayout.tsx   <- Top-level layout shell (sidebar + topbar)
    |   |   |-- Sidebar.tsx     <- Navigation sidebar
    |   |   |-- Topbar.tsx      <- Top bar
    |   |   `-- AdminSectionLayout.tsx
    |   |-- code-repos/         <- Code repo browsing components
    |   |-- credits/            <- Spend cap components
    |   |-- roles/              <- Role management components
    |   |-- run/                <- Mind execution components
    |   `-- ui/                 <- Shared UI primitives
    |       |-- Button.tsx, Input.tsx, Select.tsx, Badge.tsx
    |       |-- Card.tsx, Table.tsx, Spinner.tsx
    |       |-- AppLogo.tsx, LinedPanel.tsx
    |       |-- ApiErrorState.tsx, EmptyState.tsx, ErrorState.tsx
    |       `-- ShortcutsModal.tsx, ProfilePopover.tsx
    |-- hooks/
    |   |-- useAuth.tsx         <- Auth context + SSO/key/sign-out logic
    |   |-- useTheme.tsx        <- Dark/light theme context
    |   |-- useSidebarCollapse.tsx
    |   |-- useKeyboardShortcuts.ts
    |   `-- useHighlightTheme.ts
    |-- context/
    |   `-- ShortcutsContext.tsx
    |-- lib/
    |   |-- engineClient.ts     <- THE ONLY network module; all fetch() calls
    |   |-- utils.ts            <- Utility helpers (cn, format helpers)
    |   |-- credit-errors.ts    <- Credit error message helpers
    |   |-- code-repos.ts       <- Code repo helpers
    |   |-- code-repo-file-utils.ts
    |   |-- code-repo-line-highlight.ts
    |   `-- codeRepoChat.ts
    |-- types/
    |   |-- engine.ts           <- All edge engine API types
    |   `-- codeRepos.ts        <- Code repo API types
    `-- data/
        `-- mockCodeRepos/      <- Mock data for code repo development
```

---

## 8. Entry Points

| File             | Role                                                               |
|------------------|--------------------------------------------------------------------|
| `index.html`     | HTML shell; Vite injects `<script type="module" src="/src/main.tsx">` |
| `src/main.tsx`   | React root — creates QueryClient, wraps app in all providers, mounts to `#root` |
| `src/App.tsx`    | Route declarations, `RequireAdmin` guard, global shortcut listener |
| `vite.config.ts` | Vite server config — dev proxy, plugin config, build output       |

---

## 9. Configuration Files

| File                  | Purpose                                                |
|-----------------------|--------------------------------------------------------|
| `.env`                | `VITE_ENGINE_URL`, `VITE_ENGINE_PROXY_TARGET`, `VITE_CODEFLO_SHARE_KEY` |
| `vite.config.ts`      | Vite build + dev proxy to edge engine                  |
| `tsconfig.app.json`   | Strict TypeScript config for app source                |
| `tailwind.config.js`  | Tailwind content paths, theme extensions               |
| `postcss.config.js`   | Tailwind + autoprefixer PostCSS pipeline               |

---

## 10. Complexity Analysis Summary

```json
{
  "source_framework": "React 18.3.1 + Vite 6.3.5 + TypeScript 5.8",
  "codebase_size": "medium",
  "total_loc": 12794,
  "module_count": 73,
  "table_count": 0,
  "recommended_checkpoints": 4,
  "reasoning": "Medium-sized React SPA (~13k LOC, 73 modules) with no local DB; 4 migration checkpoints cover foundation setup, auth and admin UI, feature suites (CodeFlo/DocFlo/Run), and production hardening."
}
```
