# Compliance Report

**Project**: ai-studio-enterprise (AI Studio TP-Web Edge Client)
**Analysis Date**: 2026-09-17
**Validator**: code_analyzer
**Migration Target**: Next.js 15 + React 19 (App Router) + TypeScript 5.5+ + Tailwind CSS 4

---

## Executive Summary

This report validates the migration plan (analysis/migration-plan/strategy.md and todos.json) against established best practices for the target framework stack. Findings are numbered and ranked by severity. Each finding includes a concrete remediation step that can be tracked as an acceptance criterion within the relevant migration checkpoint.

Total gaps identified: **18**
- Critical: 2
- High: 6
- Medium: 6
- Low: 4

---

## 1. Framework Conventions (Next.js 15 + React 19)

### GAP-001 [CRITICAL] — `"use client"` boundary strategy is undefined

**Standard**: Next.js 15 App Router requires explicit `"use client"` directives on every file that uses browser APIs, hooks, or event handlers. Omitting these on pages that use `useState`, `useEffect`, or custom hooks causes build-time errors. The reverse error — over-using `"use client"` on Server Components — negates RSC benefits (server-side data fetch, reduced bundle size).

**Finding**: The migration plan (strategy.md, checkpoint_003) does not define a client/server boundary strategy. The business logic document confirms that auth state, theme, QueryClient, and keyboard shortcuts all require browser APIs. Without a documented boundary strategy, engineers will default to `"use client"` on every component, eliminating RSC benefits.

**Source evidence**: `src/hooks/useAuth.tsx` uses `useQuery`, `sessionStorage`, `window.location` — all browser APIs. `src/main.tsx` wraps the entire app in client providers. The current architecture has no server components at all.

**Remediation**:
1. Add a `docs/rsc-boundary-guide.md` in Checkpoint 002 that lists which modules are Server Components (RSC) vs Client Components (CC).
2. Define the provider tree: `app/layout.tsx` (RSC) renders `<Providers>` (CC) which renders `{children}` (RSC by default).
3. All pages should default to RSC unless they import a hook or use browser APIs; add lint rule `@next/no-use-before-render` or equivalent.
4. Acceptance criteria for task_009 (auth hooks) and task_012 (layout) must explicitly test that the RSC shell compiles without `"use client"`.

---

### GAP-002 [CRITICAL] — No middleware for authentication guard

**Standard**: Next.js 15 best practice for authentication is `middleware.ts` at the project root using `NextResponse.redirect()` on protected routes. Without middleware, a user who manually navigates to `/dashboard` before auth state loads will see a flash of the protected page content (or an error) until the client-side redirect fires.

**Finding**: The todos.json Checkpoint 003 tasks (task_009 through task_012) do not include a `middleware.ts` file. The current `RequireAdmin` guard in `src/App.tsx` is a client-side React component — this pattern does not work in App Router without a matching middleware.

**Source evidence**: `src/App.tsx` lines define `<RequireAdmin>` as a React component wrapping routes. This must become `middleware.ts` in Next.js.

**Remediation**:
1. Add `middleware.ts` to `files_to_create` in task_011 (Migrate AppLayout, Sidebar, Topbar).
2. Middleware must: read the auth session cookie, check `isAdmin` claim for admin routes, redirect to `/login` if unauthenticated, redirect to `/dashboard` if non-admin visits `/admin/*`.
3. Add acceptance criterion: "Direct browser navigation to `/admin/users` without auth redirects to `/login`."

---

### GAP-003 [HIGH] — React 19 form actions not considered for login flow

**Standard**: React 19 introduces native form actions (`action={async (formData) => {...}}`) and `useActionState` / `useFormStatus`. Using these for the login form eliminates the need for `useState` form state management and provides built-in pending state, reducing client-side JavaScript.

**Finding**: The migration plan ports `LoginPage.tsx` directly to `app/(auth)/page.tsx` without considering React 19 form actions. The current form uses `useState` for email, password, and loading states (LoginPage.tsx ~282 lines).

**Remediation**:
1. In task_010 (Migrate Login page), evaluate React 19 Server Actions for the password login form. The SSO and admin key flows remain client-side.
2. If adopted, move `loginWithPassword()` engine call to a Server Action (`app/actions/auth.ts`), eliminating one client API call and the `isLoading` state.
3. Mark as "evaluate and decide" rather than mandatory — the complexity trade-off must be considered.

---

### GAP-004 [HIGH] — No route segment configuration (`generateStaticParams`, `dynamicParams`)

**Standard**: Next.js 15 performs dynamic rendering by default for routes using cookies, headers, or search params. Routes that should always be dynamically rendered must explicitly opt in with `export const dynamic = 'force-dynamic'`. Conversely, routes that can be statically rendered should be marked static.

**Finding**: The migration todos do not include any `export const dynamic` declarations in page files. Auth-dependent pages (dashboard, admin, run) that read from cookies will trigger Next.js dynamic rendering correctly — but if a page inadvertently caches when it should not, data staleness bugs will occur in production.

**Remediation**:
1. Add acceptance criterion to each page migration task: "Page exports `export const dynamic = 'force-dynamic'` if it reads cookies or authorization state."
2. Specifically for Dashboard RSC (task_012): if using `cookies()` to read auth, this is automatically dynamic; document this explicitly.

---

### GAP-005 [HIGH] — Hydration mismatch risk from theme (`localStorage`)

**Standard**: Next.js SSR renders HTML on the server before hydration. Any value that differs between server render and client render (e.g., theme from `localStorage`) causes a React hydration mismatch warning. Best practice is to use `suppressHydrationWarning` on the `<html>` element and set the theme class synchronously via an inline `<script>` tag in `<head>`.

**Finding**: `src/hooks/useTheme.tsx` reads from `localStorage` on the client. When migrated to Next.js, the server renders without the theme class, and the client re-renders with it — causing visible flash of unstyled content (FOUC) and a React warning.

**Remediation**:
1. In task_008 (auth hooks migration), add a blocking inline `<script>` to `app/layout.tsx` that reads `localStorage.theme` and sets `document.classList` before React hydration.
2. Add `suppressHydrationWarning` to `<html>` element.
3. Acceptance criterion: "No FOUC on page refresh with dark theme; no React hydration warning in browser console."

---

### GAP-006 [MEDIUM] — `import.meta.env` audit not tracked as an acceptance criterion

**Standard**: Vite uses `import.meta.env.VITE_*` for environment variables. Next.js uses `process.env.NEXT_PUBLIC_*` (client-exposed) or `process.env.*` (server-only). Any `import.meta.env` reference in the migrated codebase will cause a Next.js build error.

**Finding**: `analysis/migration-plan/strategy.md` mentions replacing `import.meta.env.VITE_*` in the risk table, but no todos.json task has an acceptance criterion requiring a zero-tolerance audit of `import.meta.env` references.

**Source evidence**: `src/lib/engineClient.ts` contains `import.meta.env.VITE_ENGINE_URL` (line ~30). `.env` contains `VITE_ENGINE_URL=http://localhost:9002`.

**Remediation**:
1. Add acceptance criterion to task_001 (Next.js project setup): "Codebase contains zero `import.meta.env` references (verified by `grep -r 'import.meta.env' src/`). "
2. Add a CI step `grep -r 'import.meta.env' . --include='*.ts' --include='*.tsx' && exit 1 || exit 0` to fail the build if any reference remains.

---

### GAP-007 [MEDIUM] — No `next/image` adoption plan for any images

**Standard**: Next.js 15 best practice is to use `<Image>` from `next/image` instead of `<img>` for all images. This provides automatic WebP conversion, lazy loading, and prevents layout shift.

**Finding**: The migration plan does not reference `next/image`. While the current codebase is primarily icon-based (lucide-react), `AppLogo` and any future image assets should use `next/image`.

**Remediation**:
1. In task_007 (migrate shared UI component library), replace `<img>` tags in `AppLogo.tsx` with `next/image`.
2. Add acceptance criterion: "No `<img>` tags exist in the migrated codebase (except dynamically loaded user content)."

---

## 2. Database Schema, Indexing, and Connection Pooling

The source codebase has no local database (all data accessed via Edge Engine REST API). Standard database migration concerns do not apply. However, the following API-layer concerns are equivalent to connection pooling:

### GAP-008 [MEDIUM] — React Query cache configuration not reviewed for RSC-hybrid apps

**Standard**: In a Next.js App Router app with RSC, TanStack React Query v5 should use `HydrationBoundary` and `dehydrate()` to pass server-fetched data to the client without re-fetching. Without this, RSC-prefetched data is discarded on hydration and re-fetched client-side, doubling API calls.

**Finding**: The current app has `staleTime: 15_000` for whoami and `staleTime: 120_000` for repos (engineClient.ts). The migration plan does not address how the React Query cache integrates with RSC data fetching in Next.js. If `useQuery` re-fetches data already loaded by an RSC, the Engine API receives double the requests.

**Remediation**:
1. In task_004 (SSE Route Handler proxy), also create a `lib/queryClient.server.ts` that creates a server-side `QueryClient` for use in RSC data prefetch.
2. In task_012 (Dashboard page migration), use `dehydrate(queryClient)` + `<HydrationBoundary>` to hydrate the client query cache from RSC data.
3. Add acceptance criterion: "Dashboard page makes exactly one API call to `/api/engine/user/whoami` on initial load (verified via network inspector with SSR)."

---

### GAP-009 [LOW] — Engine API timeout is not configured

**Standard**: Route Handlers that proxy to external services should set explicit request timeouts to prevent connection starvation if the engine is slow or unresponsive. Next.js Route Handlers default to the platform timeout (often 30s on Vercel, longer on self-hosted).

**Finding**: The migration plan does not specify request timeout configuration for the engine proxy Route Handler. The current `engineClient.ts` does not set fetch timeouts either.

**Remediation**:
1. In task_004 (Route Handler proxy), add `signal: AbortSignal.timeout(30_000)` to the server-side fetch call.
2. For SSE streaming routes, set a longer timeout (e.g., 5 minutes) since streams can legitimately be long-running.
3. Add acceptance criterion: "Engine proxy Route Handler returns 504 Gateway Timeout after 30 seconds on a stalled request."

---

## 3. Security Gaps from Task 4

The security report (analysis/security-report.md) identified 12 findings. Cross-checking against the migration plan:

### GAP-010 [HIGH] — SEC-C-001 remediation plan is correct but incomplete

**Status**: Addressed in todos.json task_004 (Route Handler proxy) and task_006 (CI build verification).

**Gap**: The remediation plan does not include a verification step in the CI pipeline that mechanically confirms `ENGINE_URL` is absent from the browser bundle. A manual check is insufficient.

**Remediation**:
1. In task_006 (CI pipeline), add a build step that extracts the Next.js client bundle (`next build`) and runs `grep -r 'ENGINE_URL' .next/static/` — failing the build if found.
2. Alternatively, use `NEXT_BUNDLE_ANALYZER` to generate a bundle report and assert absence of the string.
3. Add acceptance criterion to task_004: "Automated CI check confirms ENGINE_URL is absent from `.next/static/`."

---

### GAP-011 [HIGH] — SEC-H-001 (admin key in sessionStorage) partial remediation only

**Status**: todos.json task_009 mentions "Admin key stored in HttpOnly cookie" but migration plan strategy.md still lists "sessionStorage (key)" -> "HTTP-only cookie / server session" as a future migration step.

**Gap**: The admin key auth mode is the fallback for environments without SSO. If the HttpOnly cookie approach requires a server-side session store (Redis), but no session store is provisioned in Checkpoint 002, tasks in Checkpoint 003 will be blocked. The migration plan does not specify the session store technology.

**Remediation**:
1. In task_001 (Next.js project setup), decide: use `iron-session` (encrypted cookie, no server store required) or server-side session with Redis.
2. Recommended: `iron-session` v8 with an encrypted cookie — no additional infrastructure, compatible with serverless/edge. Add `iron-session` to `package.json` in task_001.
3. Add `SESSION_SECRET` environment variable to `.env.local.example`.
4. Add acceptance criterion: "Admin key is stored in an encrypted HttpOnly cookie, not accessible from `document.cookie` or browser devtools > Application > Cookies > HttpOnly=true."

---

### GAP-012 [MEDIUM] — SEC-M-004 (SSO redirect URI validation) not in any migration task

**Status**: SEC-M-004 (open redirect risk on `?sso_error=` parameter) is documented in security-report.md but does not appear in any todos.json task.

**Finding**: The current `LoginPage.tsx` reads `?sso_error=` query parameter and displays it in the UI. If the value is not validated, a malicious redirect could inject arbitrary SSO error codes. Additionally, if the SSO callback uses a user-supplied `redirect` parameter, it could redirect to external domains (open redirect).

**Remediation**:
1. Add to task_010 (Login page migration): "Validate `sso_error` query parameter against an allowlist of known error codes. Unknown values display a generic 'Authentication failed' message."
2. Add to task_010: "SSO callback `redirect` parameter, if any, must be a relative path (validated with `URL.canParse()` and checking for same-origin)."
3. Add acceptance criterion: "An `sso_error` value of `javascript:alert(1)` renders as 'Authentication failed' without code execution."

---

### GAP-013 [MEDIUM] — No CORS configuration for Route Handlers

**Standard**: Next.js Route Handlers that proxy a backend API inherit the same origin as the frontend, which is correct. However, if the Route Handlers need to serve external clients or receive cross-origin requests (e.g., a native app or a different subdomain), CORS headers must be explicitly configured.

**Finding**: The migration plan does not address CORS for the Route Handler proxy. The current Vite app uses `credentials: "include"` on all engine requests — in Next.js, the proxy Route Handler will call the engine server-to-server, so CORS between browser and Next.js is same-origin and no CORS configuration is needed. However, this should be documented so it is not accidentally introduced later.

**Remediation**:
1. In task_004, add a comment in `app/api/engine/[...path]/route.ts`: "This Route Handler is same-origin only. Do not add CORS headers unless a documented cross-origin use case exists."
2. Add acceptance criterion: "Route Handler does not emit `Access-Control-Allow-Origin` header (verified via response inspection)."

---

## 4. Accessibility and API Standards

### GAP-014 [HIGH] — No accessibility acceptance criteria on most migration tasks

**Standard**: WCAG 2.1 Level AA is required for enterprise web applications in most jurisdictions. The key requirements for this application: keyboard navigation, focus management in modals, screen reader labels on icon-only buttons, color contrast >= 4.5:1.

**Finding**: The migration todos include a dedicated accessibility task (task_024, accessibility audit) but defer all accessibility work to Checkpoint 005. This means accessibility debt accumulates across 20+ tasks in Checkpoints 002-004. Retrofitting accessibility is significantly more expensive than building it in.

**Remediation**:
1. Add a minimum accessibility acceptance criterion to every component migration task: "No axe-core critical or serious violations reported by `@axe-core/react` in development mode."
2. Add `@axe-core/react` in development mode to the QueryProvider (task_008) so violations surface as browser console warnings during development.
3. Move task_024 to Checkpoint 003 as a "baseline gate" — run axe-core before proceeding to Checkpoint 004.

---

### GAP-015 [MEDIUM] — OpenAPI / type safety between Route Handlers and client is unverified

**Standard**: Type safety at the API boundary prevents runtime errors from mismatched response shapes. In Next.js Route Handlers, the return type is `Response` — untyped. Without a shared schema (Zod, io-ts, or a generated client), the client can receive unexpected shapes from the engine and the error will only surface at runtime.

**Finding**: The migration plan migrates `engineClient.ts` to call `/api/engine/*` instead of the engine directly, but does not specify how type safety is maintained at the Next.js Route Handler boundary. The Route Handler returns `Response.json(data)` with no TypeScript type enforcement on `data`.

**Remediation**:
1. In task_004 (Route Handler proxy), use Zod to validate engine responses before forwarding to the client. Create `lib/engine-schemas.ts` with Zod schemas for the 18 entity types.
2. Alternatively, use a passthrough proxy that does not inspect the body (for performance) but documents that the TypeScript types in `types/engine.ts` are authoritative and must be kept in sync with the engine API.
3. Add acceptance criterion to task_004: "A response from `/api/engine/user/whoami` with a missing `email` field causes a client-side TypeScript error at compile time, not a runtime null dereference."

---

### GAP-016 [LOW] — No API versioning strategy for Route Handlers

**Standard**: Backend API versions (v1, v2) should be preserved in the Route Handler path to allow gradual migration. The current engine exposes `/user/whoami`, `/api/v2/execute/:mindId`, `/api/v1/...` — mixed versioning.

**Finding**: The migration plan creates a catch-all proxy at `/api/engine/[...path]`. This correctly passes the version path segment through. However, if the engine API is upgraded (v2 -> v3), there is no plan for Route Handler versioning.

**Remediation**:
1. Document in `strategy.md` that the engine API version is passed through transparently and any engine API upgrades are orthogonal to the Next.js migration.
2. No immediate code change needed; accept as informational.

---

### GAP-017 [LOW] — No internationalization (i18n) plan

**Standard**: Next.js 15 has built-in i18n routing (`i18n.locales` in config). If the enterprise deployment requires multiple locales, the routing structure must be established before page migration begins. Retrofitting i18n after page migration is expensive.

**Finding**: The source codebase contains no i18n infrastructure (all strings are hardcoded English). If the enterprise requires multi-locale support, this must be decided before Checkpoint 003.

**Remediation**:
1. Add a decision gate to task_001: "Confirm with product team whether i18n is required. If yes, initialize `next-intl` or `react-intl` before any page migration."
2. If i18n is not required, add `i18n: false` comment to `next.config.ts` to document the decision.

---

## 5. Numbered Gap List and Remediation Summary

| # | Severity | Title | Migration Task | Action |
|---|----------|-------|----------------|--------|
| GAP-001 | Critical | No `"use client"` boundary strategy | task_009, task_012 | Create `docs/rsc-boundary-guide.md`; add lint rule; update acceptance criteria |
| GAP-002 | Critical | No `middleware.ts` for auth guard | task_011 | Add `middleware.ts` to files_to_create; add redirect acceptance criteria |
| GAP-003 | High | React 19 form actions not evaluated | task_010 | Evaluate Server Actions for password login; document decision |
| GAP-004 | High | No `export const dynamic` declarations | All page tasks | Add acceptance criterion: each auth-dependent page exports `force-dynamic` |
| GAP-005 | High | Theme hydration mismatch (FOUC) | task_008 | Add blocking inline script to `app/layout.tsx`; add `suppressHydrationWarning` |
| GAP-006 | Medium | No `import.meta.env` audit CI check | task_001 | Add CI `grep` check; add acceptance criterion to task_001 |
| GAP-007 | Medium | No `next/image` adoption plan | task_007 | Replace `<img>` in AppLogo with `next/image`; add acceptance criterion |
| GAP-008 | Medium | React Query + RSC hydration not addressed | task_004, task_012 | Implement `HydrationBoundary`; add "zero double-fetch" acceptance criterion |
| GAP-009 | Low | No Route Handler request timeouts | task_004 | Add `AbortSignal.timeout(30_000)` to proxy fetch; 5 min for SSE |
| GAP-010 | High | SEC-C-001 bundle audit not automated | task_006 | Add CI `grep .next/static/ ENGINE_URL` step |
| GAP-011 | High | SEC-H-001 session store not specified | task_001, task_009 | Adopt `iron-session`; add `SESSION_SECRET` env var; add HttpOnly assertion |
| GAP-012 | Medium | SEC-M-004 (open redirect) not in any task | task_010 | Add `sso_error` allowlist validation; add redirect path validation |
| GAP-013 | Medium | No CORS documentation for Route Handlers | task_004 | Document same-origin intent; add no-CORS-header acceptance criterion |
| GAP-014 | High | Accessibility deferred to Checkpoint 005 | task_007 through task_021 | Add axe-core acceptance criterion to all component tasks; add dev-mode axe integration |
| GAP-015 | Medium | No type safety at Route Handler boundary | task_004 | Adopt Zod for response validation or document passthrough policy |
| GAP-016 | Low | No API versioning strategy documented | strategy.md | Document transparent versioning passthrough; no code change |
| GAP-017 | Low | No i18n decision documented | task_001 | Add i18n decision gate; document outcome in next.config.ts |
| GAP-018 | Low | No `npm audit` enforcement in todos | task_006 | Add `npm audit --audit-level=high` to CI workflow acceptance criteria |

---

## 6. Overall Compliance Assessment

The migration plan is **conditionally compliant** with the target stack requirements. The strategy document demonstrates thorough understanding of the migration scope and risks. The checkpoint sequencing is sound. However, two critical gaps (GAP-001, GAP-002) must be resolved before Checkpoint 003 work begins, or the auth and layout tasks will produce a non-functional application.

**Priority order for immediate action**:
1. GAP-002 (no middleware) — blocking; auth guard will not work without it.
2. GAP-001 (no RSC boundary strategy) — blocking; component migrations will default to all-client and lose RSC benefits.
3. GAP-011 (session store) — blocking for admin key migration; must choose iron-session before task_009.
4. GAP-014 (accessibility deferred) — not blocking but expensive if deferred further.
5. GAP-010 (bundle audit CI) — not blocking but is the primary automated verification that the Critical security finding (SEC-C-001) is actually fixed.

All 18 gaps have concrete, actionable remediations that can be incorporated into the existing checkpoint task structure without requiring additional checkpoints.
