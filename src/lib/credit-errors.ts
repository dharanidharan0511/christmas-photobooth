import { EngineApiError } from "./engineClient";

/** Edge employees have no wallet. 402 here means the workspace owner's pool
 * is empty, or a personal spend cap was hit — never "add credits to yourself". */
export const WORKSPACE_POOL_EMPTY =
  "The workspace credit pool is empty. An admin must top up the workspace owner — raising your personal spend cap will not help.";

export const PERSONAL_CAP_REACHED =
  "Your personal spend cap has been reached. Ask an admin to raise it from Credits, or wait for the reset window.";

function detailRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  if (root.detail && typeof root.detail === "object") return root.detail as Record<string, unknown>;
  return root;
}

export function isInsufficientCreditsError(error: unknown): boolean {
  if (error instanceof EngineApiError && error.status === 402) return true;
  const rec = error instanceof EngineApiError ? detailRecord(error.body) : detailRecord(error);
  return rec?.reason === "insufficient_credits";
}

export function creditErrorMessage(error: unknown): string | null {
  if (!isInsufficientCreditsError(error)) return null;
  const rec = error instanceof EngineApiError ? detailRecord(error.body) : detailRecord(error);
  const message = typeof rec?.message === "string" ? rec.message.trim() : "";
  if (message) return message;
  if (rec?.scope === "personal_cap") return PERSONAL_CAP_REACHED;
  return WORKSPACE_POOL_EMPTY;
}
