import { Lock } from "lucide-react";
import { EngineApiError } from "../../lib/engineClient";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";

interface ApiErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

/** Renders the special "signed in but not an admin" state for a 403
 * NOT_AN_ADMIN response, and falls back to the generic ErrorState for
 * anything else. Use this wherever an admin endpoint is queried. */
export function ApiErrorState({ error, onRetry }: ApiErrorStateProps) {
  if (error instanceof EngineApiError && error.isNotAdmin) {
    return (
      <EmptyState
        icon={<Lock className="mx-auto" size={28} strokeWidth={1.5} />}
        title="Signed in, but not an admin"
        description="Your session is valid, but the engine's admin allow-list doesn't include this account (NOT_AN_ADMIN). Ask an existing engine admin to add you, or sign in with an account that's already on the allow-list."
      />
    );
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}
