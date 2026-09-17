# Migration Strategy

**Project**: ai-studio-enterprise (TP-Web Edge Client)
**Version**: 1.0
**Date**: 2026-09-17
**Migration**: React 18 + Vite 6 SPA -> Next.js 15 + React 19 (App Router)

---

## 1. Technology Mapping Table

| Current Technology    | Version | Target Technology          | Version  | Migration Notes                                    |
|-----------------------|---------|----------------------------|----------|----------------------------------------------------|
| React                 | 18.3.1  | React                      | 19.x     | Minimal breaking changes; adopt new hooks (use, etc.) |
| Vite                  | 6.3.5   | Next.js (Turbopack)        | 15.x     | Build tool replaced; dev workflow similar           |
| React Router DOM      | 6.27.0  | Next.js App Router         | 15.x     | File-based routing replaces JSX route declarations |
| TanStack React Query  | 5.59.16 | TanStack React Query       | 5.x      | No change; continue as client-side cache           |
| TypeScript            | 5.8.3   | TypeScript                 | 5.5+     | Enable `noUncheckedIndexedAccess`; fix new errors  |
| Tailwind CSS          | 3.4.14  | Tailwind CSS               | 4.x      | Upgrade; CSS-first config replaces JS config       |
| PostCSS               | 8.4.47  | PostCSS                    | 8.x      | Minimal changes                                    |
| highlight.js          | 11.11.1 | highlight.js               | 11.x     | No change                                          |
| lucide-react          | 1.32.0  | lucide-react               | latest   | Audit version; pin stable                          |
| react-markdown        | 10.1.0  | react-markdown             | 10.x     | No change                                          |
| No SSR                | —       | Next.js RSC + SSR          | —        | Dashboard, admin pages become RSC (data prefetch)  |
| Browser fetch only    | —       | Next.js Route Handlers     | —        | Engine API calls move server-side                  |
| sessionStorage (key)  | —       | HTTP-only cookie / server session | — | Admin key mechanism replaced with server-side session |
| localStorage (share key) | —   | sessionStorage or server cookie | —  | Eliminate persistent key storage from browser      |
| No CSP                | —       | `next.config.js` headers   | —        | CSP added via Next.js config                       |
| No tests              | —       | Vitest + Playwright        | latest   | Unit + E2E test suite                              |

---

## 2. Migration Approach

### Philosophy: Strangler Fig with Route-by-Route Migration

Rather than a big-bang rewrite, the migration uses a strangler fig pattern:
- The existing Vite app continues to serve traffic during migration.
- New Next.js routes are developed in parallel on a `migration/nextjs` branch.
- Routes migrate one product suite at a time; at each checkpoint, the migrated routes are verified compilable and functionally correct.
- The final cutover moves traffic from the Vite build to the Next.js build.

### Key Principles

1. **Zero behavior change**: Every existing user flow must work identically after migration.
2. **Server-side API proxy first**: The engine client migration (moving calls to Route Handlers) is done in Checkpoint 2 before any page migration, so all subsequent pages inherit the secure proxy pattern.
3. **Types-first**: TypeScript type definitions (`src/types/*.ts`) are migrated first and kept in sync throughout.
4. **One suite per checkpoint**: CodeFlo, DocFlo, and Run Minds are large enough to warrant their own checkpoints.
5. **Security wins per checkpoint**: Each checkpoint closes at least one security finding from the assessment.

---

## 3. Risk Areas

| Risk                                  | Likelihood | Impact  | Mitigation                                                  |
|---------------------------------------|------------|---------|-------------------------------------------------------------|
| SSE streaming through Route Handlers  | High       | High    | Implement and test SSE proxy early (Checkpoint 2); use Node.js ReadableStream passthrough |
| Session cookie behavior differences   | Medium     | High    | Match engine's `credentials: "include"` pattern; verify SSO redirect round-trip manually |
| Admin key auth mode elimination       | Medium     | Medium  | Keep admin key support via server-side session; do not remove until SSO is fully tested |
| Tailwind 4 CSS-first config breaking  | Medium     | Medium  | Create tailwind.css migration branch first; test all components |
| React 19 concurrent features          | Low        | Medium  | Only adopt new React 19 APIs explicitly; default to existing patterns |
| TanStack Query v5 cache invalidation  | Low        | Low     | Already on v5; no migration needed                          |
| Vite-specific `import.meta.env` usage | High       | Medium  | Replace all `import.meta.env.VITE_*` with `process.env.NEXT_PUBLIC_*` or server env |
| `window.location` usage in SSO flow   | Medium     | Medium  | Replace with `headers().get("host")` in server code; `useRouter` in client |

---

## 4. Checkpoint Sequence Rationale

The 4 checkpoints (002-005) follow a foundation-first sequence:

**Checkpoint 002 — Foundation and Infrastructure**
- Reason: Must be done first. Sets up Next.js project, TypeScript config, Tailwind migration, and the critical engine API proxy (Route Handlers). Without this, no subsequent checkpoint can follow the secure server-side pattern.
- Risk: Highest — touches the entire build pipeline and auth foundation.

**Checkpoint 003 — Auth, Admin, and Core UI**
- Reason: Auth affects every page. Admin pages (Users, Roles, Audit, Credits) are stateless data tables — easiest to migrate after the API proxy is in place. Validates the full SSO round-trip and admin key fallback in the new framework.
- Risk: Medium — SSO redirect behavior must be verified in the Next.js routing context.

**Checkpoint 004 — Feature Suites: Run Minds and CodeFlo+**
- Reason: The largest and most complex pages (RunPage.tsx at 1,549 lines). SSE streaming must work through the Route Handler proxy. Code repo file browsing has complex pagination logic. Isolated in one checkpoint to allow focused testing.
- Risk: High — SSE streaming proxy is novel; requires thorough testing.

**Checkpoint 005 — DocFlo+, Polish, Security Hardening, Testing**
- Reason: DocFlo+ is smaller and can be done last. This checkpoint closes remaining security findings (CSP headers, password strength, localStorage cleanup) and adds the test suite. Low risk — no new architectural patterns.
- Risk: Low — primarily additive work.

---

## 5. Environment Variable Strategy

| Current                     | Target                           | Notes                                 |
|-----------------------------|----------------------------------|---------------------------------------|
| `VITE_ENGINE_URL`           | `ENGINE_URL` (server-only)       | Never `NEXT_PUBLIC_*`                 |
| `VITE_ENGINE_PROXY_TARGET`  | `ENGINE_URL` (server-only)       | Proxy mode and direct mode unified    |
| `VITE_CODEFLO_SHARE_KEY`    | `CODEFLO_SHARE_KEY` (server)     | Never exposed to client               |
| `BASE_URL` (Vite)           | `NEXT_PUBLIC_BASE_PATH`          | For router basename                   |

---

## 6. Testing Strategy

| Layer       | Tool                | Coverage Target | Focus                                              |
|-------------|---------------------|-----------------|----------------------------------------------------|
| Unit        | Vitest              | >= 70% branches | engineClient functions, auth logic, business rules |
| Component   | React Testing Library | >= 60%        | UI components, form validation, error states       |
| E2E         | Playwright          | Critical paths  | Login, execute mind, create user, role assignment  |
| Performance | Lighthouse CI       | Score >= 85     | Dashboard, Run page                                |
| Security    | OWASP ZAP (in CI)   | No high findings| Automated DAST on staging                          |
