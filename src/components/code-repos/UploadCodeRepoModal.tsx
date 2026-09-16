import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { File, Loader2, Upload, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { defaultBranchLabel } from "../../lib/code-repos";
import { cn } from "../../lib/utils";

export interface UploadCodeRepoTarget {
  id: string;
  name: string;
  defaultBranch?: string | null;
}

export interface UploadCodeRepoFormValues {
  repoId: string;
  /** Primary file (first selected) — kept for simple single-file API hooks. */
  file: File;
  /** Full staged list when multi-file upload is supported. */
  files: File[];
  commitMessage: string;
  branch: string;
}

interface UploadCodeRepoModalProps {
  open: boolean;
  repo: UploadCodeRepoTarget | null;
  /** Pre-select branch (e.g. current viewer branch). */
  initialBranch?: string;
  onClose: () => void;
  onSubmit?: (input: UploadCodeRepoFormValues) => void | Promise<unknown>;
  isSubmitting?: boolean;
  error?: string | null;
}

const API_NOT_READY_MESSAGE =
  "File upload is not connected yet. The UI is ready — the engine upload API will be wired next.";

type StagedFile = {
  id: string;
  file: File;
};

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function fileExtension(name: string): string {
  const base = name.split("/").pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "—";
  return base.slice(dot + 1).toUpperCase();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileKindLabel(file: File): string {
  if (file.name.toLowerCase().endsWith(".zip")) return "ZIP archive";
  if (file.type) return file.type;
  return "File";
}

let stagedIdSeq = 0;
function newStagedId(file: File): string {
  stagedIdSeq += 1;
  return `${fileKey(file)}:${stagedIdSeq}:${Date.now()}`;
}

export function UploadCodeRepoModal({
  open,
  repo,
  initialBranch,
  onClose,
  onSubmit,
  isSubmitting = false,
  error = null,
}: UploadCodeRepoModalProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [commitMessage, setCommitMessage] = useState("Upload via TP-Web");
  const [branch, setBranch] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Reset form ONLY when the modal transitions from closed → open.
  // Re-running on initialBranch/repo updates while open was clearing the
  // staged list right after the OS file picker closed.
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened || !repo) return;

    setStaged([]);
    setCommitMessage("Upload via TP-Web");
    setBranch(initialBranch?.trim() || defaultBranchLabel(repo.defaultBranch));
    setLocalError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, repo, initialBranch]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isSubmitting, onClose, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !repo) return null;

  const displayError = error ?? localError;
  const canSubmit = staged.length > 0 && !isSubmitting;

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setLocalError(null);
    setStaged((prev) => {
      const seen = new Set(prev.map((item) => fileKey(item.file)));
      const next = [...prev];
      for (const file of incoming) {
        const key = fileKey(file);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ id: newStagedId(file), file });
      }
      return next;
    });
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files ? Array.from(event.target.files) : [];
    addFiles(picked);
    // Allow selecting the same file again later.
    event.target.value = "";
  };

  const removeFile = (id: string) => {
    setStaged((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (staged.length === 0) return;
    setLocalError(null);

    if (!onSubmit) {
      setLocalError(API_NOT_READY_MESSAGE);
      return;
    }

    const files = staged.map((item) => item.file);
    try {
      await onSubmit({
        repoId: repo.id,
        file: files[0],
        files,
        commitMessage: commitMessage.trim() || "Upload via TP-Web",
        branch: branch.trim() || defaultBranchLabel(repo.defaultBranch),
      });
    } catch {
      // Parent surfaces the engine error via the `error` prop.
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-code-repo-title"
        className="flex w-full max-w-xl flex-col rounded-xl border border-line bg-surface shadow-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 id="upload-code-repo-title" className="text-sm font-semibold text-ink">
              Upload to {repo.name}
            </h2>
            <p className="mt-0.5 text-xs text-mid">
              Add files or a .zip archive, then review the list before uploading.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="rounded p-1 text-light transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col">
          <div className="max-h-[min(60vh,28rem)] space-y-4 overflow-y-auto px-4 py-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="block text-xs font-medium text-mid">Files</span>
                {staged.length > 0 && (
                  <label
                    htmlFor={fileInputId}
                    className={cn(
                      "cursor-pointer text-xs font-medium text-accent hover:underline",
                      isSubmitting && "pointer-events-none opacity-50",
                    )}
                  >
                    Add more
                  </label>
                )}
              </div>

              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                disabled={isSubmitting}
                onChange={onFileInputChange}
              />

              {staged.length === 0 ? (
                <label
                  htmlFor={fileInputId}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-line px-4 py-8 transition-colors hover:border-mid",
                    isSubmitting && "pointer-events-none opacity-50",
                  )}
                >
                  <div className="text-center">
                    <Upload size={20} className="mx-auto mb-1.5 text-light" strokeWidth={1.5} />
                    <p className="text-xs text-mid">Click to select files or a .zip archive</p>
                    <p className="mt-1 text-[11px] text-light">You can add multiple files</p>
                  </div>
                </label>
              ) : (
                <div className="rounded-lg border border-line">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-line text-left text-mid">
                        <tr>
                          <th className="px-3 py-2 text-xs font-medium">Name</th>
                          <th className="px-3 py-2 text-xs font-medium">Ext</th>
                          <th className="px-3 py-2 text-xs font-medium">Size</th>
                          <th className="px-3 py-2 text-xs font-medium">Type</th>
                          <th className="px-3 py-2 text-xs font-medium" aria-label="Remove" />
                        </tr>
                      </thead>
                      <tbody>
                        {staged.map((item) => (
                          <tr key={item.id} className="border-b border-line last:border-0">
                            <td className="max-w-[12rem] px-3 py-2 align-middle">
                              <div className="flex min-w-0 items-center gap-2">
                                <File size={14} className="shrink-0 text-light" strokeWidth={1.5} />
                                <span className="truncate font-medium text-ink" title={item.file.name}>
                                  {item.file.name}
                                </span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 align-middle font-mono text-[11px] text-mid">
                              {fileExtension(item.file.name)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 align-middle tabular-nums text-mid">
                              {formatFileSize(item.file.size)}
                            </td>
                            <td
                              className="max-w-[8rem] truncate px-3 py-2 align-middle text-mid"
                              title={fileKindLabel(item.file)}
                            >
                              {fileKindLabel(item.file)}
                            </td>
                            <td className="px-3 py-2 text-right align-middle">
                              <button
                                type="button"
                                title={`Remove ${item.file.name}`}
                                aria-label={`Remove ${item.file.name}`}
                                onClick={() => removeFile(item.id)}
                                disabled={isSubmitting}
                                className={cn(
                                  "inline-flex rounded p-1 text-light transition-colors",
                                  "hover:bg-error/10 hover:text-error disabled:opacity-50",
                                )}
                              >
                                <X size={14} strokeWidth={1.5} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-line bg-bg/40 px-3 py-1.5 text-[11px] text-light">
                    <span>
                      {staged.length} file{staged.length === 1 ? "" : "s"} selected
                    </span>
                    <span className="tabular-nums">
                      {formatFileSize(staged.reduce((sum, item) => sum + item.file.size, 0))} total
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="upload-branch" className="mb-1.5 block text-xs font-medium text-mid">
                Branch
              </label>
              <Input
                id="upload-branch"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                placeholder={defaultBranchLabel(repo.defaultBranch)}
                disabled={isSubmitting}
                className="font-mono text-xs"
              />
            </div>

            <div>
              <label htmlFor="upload-commit" className="mb-1.5 block text-xs font-medium text-mid">
                Commit message
              </label>
              <Input
                id="upload-commit"
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                placeholder="Upload via TP-Web"
                disabled={isSubmitting}
              />
            </div>

            {!onSubmit && (
              <p className="rounded-lg border border-line bg-bg/40 px-3 py-2 text-xs text-mid">
                {API_NOT_READY_MESSAGE}
              </p>
            )}

            {displayError && (
              <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-error">
                {displayError}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-line px-4 py-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload size={14} strokeWidth={1.5} />
                  Upload{staged.length > 0 ? ` (${staged.length})` : ""}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
