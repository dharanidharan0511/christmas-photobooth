# Security Assessment Report

**Project**: ai-studio-enterprise
**Analysis Date**: 2026-09-17
**Scope**: Static analysis of source code under `src/`, `assets/`, `.env`, `vite.config.ts`

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 3     |
| Medium   | 4     |
| Low      | 4     |
| **Total**| **12**|

---

## Critical Findings

### SEC-C-001: Engine URL with Credentials Exposed in .env (Potential Secret Exposure)

**File**: `.env` (line 4)
**Severity**: Critical (conditional — depends on deployment)

```
VITE_ENGINE_URL=http://localhost:9002
```

**Finding**: `VITE_*` prefixed environment variables in Vite are bundled into the JavaScript output and become visible in the browser's source maps and network inspector. Any `VITE_ENGINE_URL`, `VITE_ENGINE_PROXY_TARGET`, or `VITE_CODEFLO_SHARE_KEY` value set at build time is shipped to the browser.

In development, `VITE_ENGINE_URL=http://localhost:9002` is low-risk. However, if a production build sets `VITE_ENGINE_URL` to a live engine host, that host is disclosed to all end users. If `VITE_CODEFLO_SHARE_KEY` contains a real Mind Share Key, that key is fully exposed in the bundle.

**Recommended remediation**:
- Use proxy mode (leave `VITE_ENGINE_URL` empty; set `VITE_ENGINE_PROXY_TARGET` in the Vite dev config only — it is server-side).
- Never set `VITE_CODEFLO_SHARE_KEY` to a production key.
- Audit CI/CD pipelines to confirm production `.env` does not inject secret keys as `VITE_*` vars.

---

## High Findings

### SEC-H-001: Admin Key Stored in sessionStorage — XSS Exploitable

**File**: `src/lib/engineClient.ts` (lines 57-74)
**Severity**: High

```typescript
const ADMIN_KEY_STORAGE_KEY = "tp-web:admin-key";
export function getAdminKey(): string | null {
  try { return sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY); } catch { return null; }
}
export function setAdminKey(key: string): void {
  sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
}
```

**Finding**: The admin bearer token is stored in `sessionStorage`. Any XSS vulnerability (including via third-party script injection) would allow an attacker to read `sessionStorage`, extract the admin key, and make authenticated admin API calls. The comment notes it is "NOT localStorage" for session isolation, but does not protect against XSS.

**Recommended remediation**:
- Consider using an `HttpOnly` cookie flow for the admin key as well (if the engine can support it).
- Ensure CSP headers are set to prevent script injection.
- Enforce Subresource Integrity (SRI) on any external scripts.

### SEC-H-002: Mind Share Key Stored in localStorage — Persistent XSS Target

**File**: `src/pages/RunPage.tsx` (lines 921-922, 1251)
**Severity**: High

```typescript
const KEY_STORAGE = "tp-web:mind-share-key";
const [shareKey, setShareKey] = useState(() => (isAdmin ? localStorage.getItem(KEY_STORAGE) ?? "" : ""));
// ...
localStorage.setItem(KEY_STORAGE, trimmed);
```

**Finding**: Mind Share Keys pasted by admins in the Run page are stored in `localStorage`. Unlike `sessionStorage`, `localStorage` persists across browser sessions and browser restarts. A Mind Share Key is a full API bearer credential for the AI Studio platform. If an attacker gains XSS or has physical access to the machine, they can extract this key and use it indefinitely.

**Recommended remediation**:
- Migrate to `sessionStorage` to limit lifetime to the current browser session.
- Or: offer an explicit "remember this key" checkbox (off by default) that uses `sessionStorage`.
- The code already performs defensive cleanup (line 941-945) for non-admins, but does not time-limit the key for admins.

### SEC-H-003: No Content Security Policy Configured

**File**: `index.html` (root level), `vite.config.ts`
**Severity**: High

**Finding**: No `Content-Security-Policy` header or `<meta http-equiv="Content-Security-Policy">` is present in `index.html`. No middleware or server configuration in the repository sets CSP headers. Without CSP, XSS attacks can run arbitrary scripts, exfiltrate session tokens (`sessionStorage`/`localStorage`), and call the engine API on behalf of the user.

**Recommended remediation**:
- Configure Vite to inject CSP headers in dev (`vite.config.ts > server.headers`).
- For production, configure the web server (nginx/Caddy) to send `Content-Security-Policy: default-src 'self'; connect-src 'self' <engine-origin>; ...`.
- At minimum restrict `script-src` to `'self'`.

---

## Medium Findings

### SEC-M-001: Missing Input Validation on Admin Key and Share Key Inputs

**File**: `src/pages/LoginPage.tsx` (line 268), `src/pages/RunPage.tsx` (line 955)
**Severity**: Medium

```typescript
// LoginPage.tsx line 268
onClick={() => auth.useAdminKey(keyInput.trim())}

// RunPage.tsx line 955
const applyKey = () => {
  const trimmed = shareKey.trim();
  localStorage.setItem(KEY_STORAGE, trimmed);
  setActiveKey(trimmed);
};
```

**Finding**: Key inputs accept any non-empty string with only `.trim()` applied. No format validation (e.g., checking that the key matches `ask_...` or a UUID prefix pattern) is performed before storing or sending the key. A user who accidentally pastes the wrong value into either field will get a confusing server-side 401 rather than a client-side "this doesn't look like a valid key" message.

**Recommended remediation**:
- Add a lightweight regex check for expected key format before storing (e.g., `^ask_[a-zA-Z0-9_-]{20,}$`).
- Show an inline validation warning rather than silently storing an obviously invalid key.

### SEC-M-002: SSE Stream Parsing Silently Ignores Malformed JSON

**File**: `src/lib/engineClient.ts` (lines 988-1000, 1045-1048)
**Severity**: Medium

```typescript
try {
  const obj = JSON.parse(data) as Record<string, unknown>;
  // ...
} catch {
  // not JSON — ignore
}
```

**Finding**: JSON parse errors in SSE events are silently swallowed. While this is intentional for resilience, it means that a server-sent event containing a crafted non-JSON string (e.g., from a man-in-the-middle attack if TLS is not enforced) would be silently ignored without any indication to the user. No integrity check is performed on event data.

**Recommended remediation**:
- Enforce TLS (HTTPS) between client and engine at the infrastructure level to prevent MITM.
- Consider adding a telemetry/logging hook for parse failures in production to detect anomalies.

### SEC-M-003: Missing Rate Limiting Client-Side on Auth Mutation

**File**: `src/pages/LoginPage.tsx` (lines 63-69)
**Severity**: Medium

```typescript
const passwordLoginMutation = useMutation({
  mutationFn: () => loginWithPassword(pwEmail.trim(), pwPassword),
  ...
});
```

**Finding**: The password login form has no client-side rate limiting or attempt counting. While the engine enforces lockout server-side (`too_many_attempts` response), the client does not throttle submissions. Rapid form submissions (e.g., via a browser extension or script) will each generate a full round trip to the engine.

**Recommended remediation**:
- Disable the submit button for 1-2 seconds after each failed attempt.
- Count failed attempts locally and show a "wait N seconds" message before re-enabling (complements server-side lockout).

### SEC-M-004: Unvalidated Redirect URI in SSO Flow

**File**: `src/lib/engineClient.ts` (lines 267-269)
**Severity**: Medium

```typescript
export function goToSsoLogin(): void {
  const redirectUri = encodeURIComponent(`${window.location.origin}${import.meta.env.BASE_URL}`);
  window.location.href = `${ENGINE_URL}/user/login?redirect_uri=${redirectUri}`;
}
```

**Finding**: `window.location.origin` is user-controlled in some attack scenarios (e.g., DNS rebinding or if the app is hosted on a shared origin). While the engine is documented to validate `redirect_uri` against its CORS allow-list, the client itself does not validate that `ENGINE_URL` is an expected host before constructing the redirect. If `ENGINE_URL` is tampered with (e.g., via XSS modifying `import.meta.env`), the redirect could go to a malicious host.

**Recommended remediation**:
- Lock `ENGINE_URL` at build time and validate its format before use.
- Document clearly that CORS allow-list on the engine is the primary defense.

---

## Low Findings

### SEC-L-001: Outdated Dependency — lucide-react ^1.32.0 (Pre-release / Unstable Version)

**File**: `package.json` (line 15)
**Severity**: Low

**Finding**: `lucide-react` version `^1.32.0` is specified. This is an unusually high major version for lucide-react; the stable release line was in the `0.x` range through 2025. This may indicate a phantom/unofficial package or a very recent major-version bump. Should be verified for integrity.

**Recommended remediation**:
- Run `npm audit` to check for known vulnerabilities.
- Pin exact version and verify package integrity via lockfile.

### SEC-L-002: No Security Headers Documentation

**File**: Project root (no `nginx.conf`, `caddy.json`, or similar)
**Severity**: Low

**Finding**: There is no web server configuration or documentation specifying required security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`). Deployment teams may not know to configure these.

**Recommended remediation**:
- Add a `README.md` section or deployment checklist specifying required HTTP response headers.
- Include a sample `nginx.conf` or Docker/Caddy snippet.

### SEC-L-003: Password Min Length Only 8 Characters

**File**: `src/pages/UsersPage.tsx` (line 50), `src/pages/LoginPage.tsx` (line 176)
**Severity**: Low

```typescript
if (authMode === "password" && password.length >= 8) {
```

**Finding**: The minimum password length is 8 characters, which is below NIST SP 800-63B recommendations (minimum 15 characters for memorized secrets). For a system granting access to AI workloads and admin functions, 8 characters is low.

**Recommended remediation**:
- Increase minimum to 12-15 characters.
- Consider adding a strength indicator (entropy check).

### SEC-L-004: Error Messages May Leak Implementation Details

**File**: `src/lib/engineClient.ts` (lines 84-96)
**Severity**: Low

```typescript
if (rec.reason === "file_too_large") return "File is too large to upload.";
if (rec.reason === "no_connector") return "This repository has no VCS connector configured.";
```

**Finding**: Several error messages reveal internal implementation details (e.g., "no_connector", "empty_upload", "file_too_large" reason codes). While these are useful for debugging, they expose internal system state to the browser console and end users.

**Recommended remediation**:
- These messages are appropriate for the internal test-client context where this app is deployed.
- For a public-facing deployment, consider masking reason codes and only showing user-friendly summaries.

---

## Summary Table

| ID         | Severity | Title                                                    | File                              | Approx. Line |
|------------|----------|----------------------------------------------------------|-----------------------------------|--------------|
| SEC-C-001  | Critical | VITE_* env vars bundled into browser output              | `.env`                            | 4            |
| SEC-H-001  | High     | Admin key in sessionStorage — XSS exploitable            | `src/lib/engineClient.ts`         | 57-74        |
| SEC-H-002  | High     | Mind share key in localStorage — persistent XSS target   | `src/pages/RunPage.tsx`           | 921          |
| SEC-H-003  | High     | No Content Security Policy configured                    | `index.html`, `vite.config.ts`    | N/A          |
| SEC-M-001  | Medium   | No input validation on key fields                        | `src/pages/LoginPage.tsx`, `RunPage.tsx` | 268, 955|
| SEC-M-002  | Medium   | Malformed SSE JSON silently ignored (no integrity check) | `src/lib/engineClient.ts`         | 988-1000     |
| SEC-M-003  | Medium   | No client-side rate limiting on password auth            | `src/pages/LoginPage.tsx`         | 63-69        |
| SEC-M-004  | Medium   | Unvalidated redirect URI composition in SSO flow         | `src/lib/engineClient.ts`         | 267-269      |
| SEC-L-001  | Low      | Potentially unusual lucide-react version (^1.32.0)       | `package.json`                    | 15           |
| SEC-L-002  | Low      | No security headers documentation or server config       | Project root                      | N/A          |
| SEC-L-003  | Low      | Password minimum length only 8 characters                | `src/pages/UsersPage.tsx`         | 50           |
| SEC-L-004  | Low      | Error messages may leak implementation reason codes      | `src/lib/engineClient.ts`         | 84-96        |
