# Checkpoint 002 — Changes Log

**Checkpoint:** Foundation and Infrastructure
**Completed:** 2026-09-17T00:45:00Z

---

## 1. Executive Summary

Checkpoint 002 established the complete Next.js 15 App Router foundation for the
migration from the legacy React 18 + Vite SPA. All 8 tasks completed successfully.
`next build` and `tsc --noEmit` pass with zero errors. The most significant
architectural change is the introduction of a server-side engine proxy Route Handler
that resolves security finding SEC-C-001 by keeping ENGINE_URL out of the browser bundle.

---

## 2. Tasks Executed

| Task    | Title                                           | Deliverables                                              |
|---------|-------------------------------------------------|-----------------------------------------------------------|
| task_001 | Bootstrap Next.js 15 App Router project        | package.json, next.config.js, tsconfig.json, app/layout.tsx, app/page.tsx, .env.example |
| task_002 | Migrate TypeScript configuration               | tsconfig.json with strict mode + noUncheckedIndexedAccess |
| task_003 | Migrate Tailwind CSS 4 (CSS-first)             | app/globals.css, postcss.config.mjs                       |
| task_004 | Migrate shared type definitions                | types/engine.ts, types/codeRepos.ts                       |
| task_005 | Migrate utility libraries                      | lib/utils.ts, lib/credit-errors.ts, lib/code-repos.ts, lib/code-repo-file-utils.ts, lib/code-repo-line-highlight.ts, lib/codeRepoChat.ts |
| task_006 | Create engine API Route Handlers               | app/api/engine/[...path]/route.ts, lib/engineClient.ts    |
| task_007 | Configure environment variables                | .env.local.example, .env.example                          |
| task_008 | Set up QueryClient and global providers        | components/providers/QueryProvider.tsx, updated app/layout.tsx |

---

## 3. Key Technical Decisions

### SEC-C-001: Engine URL Proxy (Critical Security Fix)

The legacy Vite app exposed ENGINE_URL as VITE_ENGINE_URL, which was bundled into
the browser JS and visible in the network inspector. The Next.js version introduces
a catch-all Route Handler at `app/api/engine/[...path]/route.ts` that:

- Reads ENGINE_URL from a server-only env var (no NEXT_PUBLIC_ prefix)
- Forwards all requests to the engine with proper auth headers
- Supports REST, SSE streaming (piped without buffering via TransformStream), and FormData
- The browser only ever calls /api/engine/... — never the engine directly

### Tailwind CSS 4 Migration

Tailwind v3 used tailwind.config.js with a `theme.extend` block. Tailwind v4 uses
CSS-first configuration via the `@theme` directive in `globals.css`. All colour
tokens are declared as CSS custom properties in :root and data-theme selectors and
then referenced in the @theme block. This preserves all existing utility class names
(bg-bg, text-ink, border-accent, etc.).

### TypeScript Strict Mode

`noUncheckedIndexedAccess` was enabled as required by the migration plan. All array
and object accesses through bracket notation now return `T | undefined`, which
required defensive `?.` and `!` assertions at known-safe sites in codeRepoChat.ts.

### QueryClient per Request

The `QueryProvider` uses `useState(() => new QueryClient(...))` to ensure each
browser session gets a fresh client. This prevents request-time query cache leakage
in concurrent Server Component rendering.

---

## 4. Business Logic Preservation

All business logic from the source lib files is preserved exactly:

- BR-001: engineClient.ts — all 50+ API functions preserved with identical signatures
- BR-002: codeRepoChat.ts — SSE stream applier, transcript folder, tool block merging preserved
- BR-003: credit-errors.ts — 402 / insufficient_credits / personal_cap detection preserved
- BR-004: utils.ts — rolesFromCatalog deduplication logic preserved
- BR-005: code-repos.ts — resolveRepoBrowseSource VCS/workspace/git selection preserved

---

## 5. Modified Files (Before / After)

### lib/engineClient.ts (critical change — SEC-C-001)

Before (Vite):
```typescript
export const ENGINE_URL: string = (import.meta.env.VITE_ENGINE_URL ?? "").trim();

async function engineRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = `${ENGINE_URL}${path}`;   // ENGINE_URL in browser bundle
  // ...
}
```

After (Next.js):
```typescript
const ENGINE_PROXY_BASE = "/api/engine";  // same-origin, server proxies

async function engineRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = `${ENGINE_PROXY_BASE}${proxyPath}`;  // no engine URL in browser
  // ...
}
```

### types/codeRepos.ts / types/engine.ts

No functional changes — `../types/` imports updated to `@/types/` path alias.

### lib/codeRepoChat.ts

`../types/engine` import updated to `@/types/engine`. Array accesses tightened
for `noUncheckedIndexedAccess` compliance (`next[i]!`, `blocks[index]!`).

---

## 6. Validation Results

| Check                    | Result |
|--------------------------|--------|
| `tsc --noEmit`           | PASS   |
| `next build`             | PASS   |
| VITE_* vars in codebase  | 0      |
| import.meta.env refs     | 0      |
| ENGINE_URL in browser JS | NO     |
| SSE streaming            | Verified (TransformStream pipe, no buffering) |
| Tailwind 4 compile       | PASS   |
| React Query provider     | PASS   |
