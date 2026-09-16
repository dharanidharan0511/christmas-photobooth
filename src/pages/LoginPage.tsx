import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { AppLogo } from "../components/ui/AppLogo";
import { LinedPanel } from "../components/ui/LinedPanel";
import { ENGINE_URL, ENGINE_PROXY_TARGET, EngineApiError, goToSsoLogin, loginWithPassword } from "../lib/engineClient";
import { cn } from "../lib/utils";

const ENGINE_DISPLAY = ENGINE_URL || ENGINE_PROXY_TARGET || "not configured";

// Mirrors the message-per-reason-code table in the engine's own
// aistudio.user_module.routes (_ERROR_MESSAGES) — this app gets the raw
// `sso_error` code, not the engine's rendered HTML, so it needs its own copy
// to show something a person can read rather than the bare code.
const SSO_ERROR_MESSAGES: Record<string, string> = {
  invalid_assertion: "Your identity provider's response could not be verified.",
  missing_assertion_id: "Your identity provider's response was missing required data.",
  replayed_assertion: "This sign-in link has already been used. Please sign in again.",
  user_disabled: "This account has been disabled. Contact your administrator.",
  state_mismatch: "Your sign-in session expired or was tampered with. Please try again.",
  missing_code: "Your identity provider did not return an authorization code.",
  missing_id_token: "Your identity provider did not return an identity token.",
  invalid_id_token: "Your identity provider's token could not be verified.",
  issuer_mismatch: "Your identity provider's token was issued by an unexpected issuer.",
  audience_mismatch: "Your identity provider's token was issued for a different application.",
  missing_email_claim: "Your identity provider did not share an email address.",
};

/** `POST /user/login/password`'s error bodies are plain JSON with a
 * `reason` field (`invalid_credentials`, `too_many_attempts` + `lockedUntil`)
 * — not the `{detail: {...}}` shape most other engine errors use, since this
 * route hand-writes its own `Response` rather than raising `HTTPException`. */
function passwordLoginErrorMessage(err: unknown): string {
  if (err instanceof EngineApiError) {
    const body = err.body as { reason?: string; lockedUntil?: string } | undefined;
    if (body?.reason === "too_many_attempts") {
      const until = body.lockedUntil ? new Date(body.lockedUntil).toLocaleTimeString() : "shortly";
      return `Too many failed attempts. Try again after ${until}.`;
    }
    if (body?.reason === "invalid_credentials") {
      return "Incorrect email or password.";
    }
  }
  return "Sign-in failed. Please try again.";
}

export function LoginPage() {
  const auth = useAuth();
  const { theme } = useTheme();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [justChecked, setJustChecked] = useState(false);
  const [pwEmail, setPwEmail] = useState("");
  const [pwPassword, setPwPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const passwordLoginMutation = useMutation({
    mutationFn: () => loginWithPassword(pwEmail.trim(), pwPassword),
    onSuccess: () => {
      setPwPassword("");
      auth.refetch();
    },
  });
  const [searchParams, setSearchParams] = useSearchParams();
  // Captured once on mount into local state, then stripped from the URL —
  // so the message survives the URL cleanup below instead of vanishing the
  // instant setSearchParams re-renders this component with an empty query.
  const [ssoError] = useState(() => searchParams.get("sso_error"));

  useEffect(() => {
    if (justChecked) {
      const t = setTimeout(() => setJustChecked(false), 2500);
      return () => clearTimeout(t);
    }
  }, [justChecked]);

  // Strip ?sso_error= from the URL once read, so a manual refresh doesn't
  // keep re-showing a stale error.
  useEffect(() => {
    if (ssoError) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show a neutral spinner while we're still figuring out whether the user
  // is signed in — prevents a jarring flash of the login form followed by
  // an immediate redirect to the dashboard.
  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner />
      </div>
    );
  }

  if (auth.isSignedIn) {
    // Everyone lands on the Workbench — it adapts its content per role.
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <LinedPanel
        className="w-full max-w-[420px] bg-surface"
        contentClassName="px-7 py-8"
      >
        {/* ── Brand lockup ─────────────────────────────── */}
        <div className="mb-7 flex items-start gap-3">
          <AppLogo variant="short" size={40} theme={theme} />
          <div className="min-w-0 pt-0.5">
            <p
              className={cn(
                "font-brand text-[17px] leading-none tracking-tight",
                theme === "dark" ? "text-[#F0EDE6]" : "text-[#26221A]",
              )}
            >
              <span className="font-semibold">ai/studio</span>{" "}
              <span className="font-semibold text-accent">Enterprise</span>
            </p>
            <p className="mt-1.5 text-[11px] uppercase tracking-wide text-mid">
              Test client · edge engine
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-mid" title={ENGINE_DISPLAY}>
              engine: <span className="text-ink">{ENGINE_DISPLAY}</span>
            </p>
          </div>
        </div>

        {ssoError && (
          <div className="mb-4 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
            {SSO_ERROR_MESSAGES[ssoError] ?? "Sign-in failed. Please try again."}
          </div>
        )}

        {/* ── SSO ──────────────────────────────────────── */}
        <Button
          variant="secondary"
          className="w-full rounded-md border-line bg-surface font-semibold text-ink shadow-none hover:bg-bg"
          onClick={() => {
            // Clicking "sign in" is an explicit intent to be signed in —
            // must override a stale locallySignedOut flag from an earlier
            // "Sign out" in this tab, or a perfect SSO round trip still
            // lands back here showing signed-out (auth.refetch() clears it).
            auth.refetch();
            goToSsoLogin();
          }}
        >
          Sign In with SSO (SAML)
        </Button>

        {/* ── Divider ──────────────────────────────────── */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-surface px-2.5 text-[11px] text-mid">or local fallback</span>
          </div>
        </div>

        {/* ── Password form ────────────────────────────── */}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pwEmail.trim() && pwPassword && !passwordLoginMutation.isPending) {
              passwordLoginMutation.mutate();
            }
          }}
        >
          <div>
            <label htmlFor="login-username" className="mb-1.5 block text-sm text-mid">
              Username
            </label>
            <Input
              id="login-username"
              type="email"
              placeholder="Username"
              value={pwEmail}
              onChange={(e) => setPwEmail(e.target.value)}
              autoComplete="username"
              className="rounded-md border-line bg-bg-subtle shadow-none focus:ring-accent/30"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm text-mid">
              Password
            </label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={pwPassword}
                onChange={(e) => setPwPassword(e.target.value)}
                autoComplete="current-password"
                className="rounded-md border-line bg-bg-subtle pr-9 shadow-none focus:ring-accent/30"
              />
              <button
                type="button"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-2 flex items-center text-light hover:text-mid"
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          <Button
            lined
            type="submit"
            className="w-full font-semibold"
            disabled={!pwEmail.trim() || !pwPassword || passwordLoginMutation.isPending}
          >
            {passwordLoginMutation.isPending ? <Spinner className="mr-2" /> : null}
            Sign In
          </Button>

          {passwordLoginMutation.isError && (
            <p className="text-xs text-error">{passwordLoginErrorMessage(passwordLoginMutation.error)}</p>
          )}
        </form>

        {/* ── Advanced (admin key + session check) ─────── */}
        <div className="mt-6 border-t border-line pt-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-mid hover:text-ink"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Advanced
          </button>
          {advancedOpen && (
            <div className="mt-3 space-y-3">
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => {
                  auth.refetch();
                  setJustChecked(true);
                }}
              >
                {auth.isLoading ? <Spinner className="mr-2" /> : null}
                Check my session
              </Button>
              {justChecked && !auth.isSignedIn && !auth.isLoading && (
                <p className="text-xs text-error">No active session found yet.</p>
              )}
              <Input
                type="password"
                placeholder="Admin key"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="rounded-md border-line bg-bg-subtle shadow-none"
              />
              <Button
                className="w-full"
                variant="secondary"
                disabled={!keyInput.trim()}
                onClick={() => auth.useAdminKey(keyInput.trim())}
              >
                Use this key
              </Button>
            </div>
          )}
        </div>
      </LinedPanel>
    </div>
  );
}
