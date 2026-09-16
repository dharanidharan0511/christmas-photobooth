import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { repoTypeLabel } from "../../lib/code-repos";
import type { CodeRepoListItem } from "../../types/codeRepos";

interface DeleteCodeRepoModalProps {
  open: boolean;
  repo: CodeRepoListItem | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  error?: string | null;
}

export function DeleteCodeRepoModal({
  open,
  repo,
  onClose,
  onConfirm,
  isDeleting,
  error,
}: DeleteCodeRepoModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDeleting, onClose, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !repo) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-code-repo-title"
        className="w-full max-w-md rounded-xl border border-line bg-surface shadow-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0 text-error" strokeWidth={1.5} />
            <h2 id="delete-code-repo-title" className="text-sm font-semibold text-ink">
              Delete repository
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close"
            className="rounded p-1 text-light transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-mid">
            Remove <span className="font-medium text-ink">{repo.name}</span> from this edge cluster?
            The remote repository on {repoTypeLabel(repo.repoType)} is not deleted — only the local
            link and stored credentials are removed.
          </p>
          {error && (
            <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
