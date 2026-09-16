import { EngineApiError } from "../../lib/engineClient";
import { Button } from "./Button";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

/** Renders EngineApiError specially (status + parsed body) rather than a
 * generic "Something went wrong". */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const isEngineError = error instanceof EngineApiError;

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-medium text-error">
        {isEngineError ? `Engine returned ${error.status}` : "Request failed"}
      </p>
      <p className="max-w-md text-sm text-mid">
        {error instanceof Error ? error.message : String(error)}
      </p>
      {isEngineError && error.body !== null && error.body !== undefined && (
        <pre className="max-w-lg overflow-x-auto rounded-md border border-line bg-bg px-3 py-2 text-left text-[11px] text-mid">
          {typeof error.body === "string" ? error.body : JSON.stringify(error.body, null, 2)}
        </pre>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
