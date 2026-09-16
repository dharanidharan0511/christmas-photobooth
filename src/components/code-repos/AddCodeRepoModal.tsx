import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import type { CodeRepoType, CreateCodeRepoInput } from "../../types/codeRepos";

interface ProjectOption {
  id: string;
  name: string;
}

interface AddCodeRepoModalProps {
  open: boolean;
  projects: ProjectOption[];
  defaultProjectId?: string;
  onClose: () => void;
  onSubmit: (input: CreateCodeRepoInput) => void;
  isSubmitting: boolean;
  error?: string | null;
}

const PROVIDER_OPTIONS: { value: CodeRepoType; label: string; desc: string }[] = [
  { value: "internal_gitlab", label: "Internal GitLab", desc: "Auto-creates repo" },
  { value: "private_gitlab", label: "Private GitLab", desc: "Connect your instance" },
  { value: "github", label: "GitHub", desc: "Connect your account" },
  { value: "bitbucket", label: "Bitbucket", desc: "Connect your workspace" },
];

export function AddCodeRepoModal({
  open,
  projects,
  defaultProjectId,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: AddCodeRepoModalProps) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [name, setName] = useState("");
  const [repoType, setRepoType] = useState<CodeRepoType>("internal_gitlab");
  const [description, setDescription] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [gitlabUrl, setGitlabUrl] = useState("");
  const [gitlabPat, setGitlabPat] = useState("");
  const [githubAuthMode, setGithubAuthMode] = useState<"oauth" | "pat">("pat");
  const [githubPatRepoFullName, setGithubPatRepoFullName] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [bitbucketRepoFullName, setBitbucketRepoFullName] = useState("");
  const [bitbucketEmail, setBitbucketEmail] = useState("");
  const [bitbucketPat, setBitbucketPat] = useState("");

  useEffect(() => {
    if (!open) return;
    setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
    setName("");
    setRepoType("internal_gitlab");
    setDescription("");
    setDefaultBranch("main");
    setWorkingDirectory("");
    setGitlabUrl("");
    setGitlabPat("");
    setGithubAuthMode("pat");
    setGithubPatRepoFullName("");
    setGithubPat("");
    setBitbucketRepoFullName("");
    setBitbucketEmail("");
    setBitbucketPat("");
  }, [defaultProjectId, open, projects]);

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

  const canSubmit =
    Boolean(name.trim() && projectId) &&
    !isSubmitting &&
    (repoType === "internal_gitlab" ||
      (repoType === "private_gitlab" && gitlabUrl && gitlabPat) ||
      (repoType === "github" && githubAuthMode === "pat" && githubPatRepoFullName && githubPat) ||
      (repoType === "bitbucket" && bitbucketRepoFullName && bitbucketEmail && bitbucketPat));

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    onSubmit({
      projectId,
      name: name.trim(),
      repoType,
      description: description.trim() || undefined,
      defaultBranch: defaultBranch.trim() || "main",
      workingDirectory: workingDirectory.trim() || undefined,
      ...(repoType === "private_gitlab"
        ? { gitlabUrl: gitlabUrl.trim(), gitlabAccessToken: gitlabPat }
        : {}),
      ...(repoType === "github" && githubAuthMode === "pat"
        ? { githubRepoFullName: githubPatRepoFullName.trim(), githubAccessToken: githubPat }
        : {}),
      ...(repoType === "bitbucket"
        ? {
            bitbucketRepoFullName: bitbucketRepoFullName.trim(),
            bitbucketEmail: bitbucketEmail.trim(),
            bitbucketAccessToken: bitbucketPat,
          }
        : {}),
    });
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
        aria-labelledby="add-code-repo-title"
        className="flex max-h-[min(90vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 id="add-code-repo-title" className="text-base font-semibold text-ink">
              Add Code Repository
            </h2>
            <p className="mt-0.5 text-xs text-light">
              Connect a Git provider so operators can read and write code for this project.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md p-1 text-light transition-colors hover:bg-bg hover:text-ink disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-light">Repository</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mid">Project</label>
                <Select
                  value={projectId}
                  onChange={setProjectId}
                  options={projects.map((project) => ({ value: project.id, label: project.name }))}
                  placeholder="Select a project..."
                  ariaLabel="Project"
                  className="w-full"
                  triggerClassName="w-full justify-between"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mid">Repository Name</label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="my-repo"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-line pt-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-light">Provider</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROVIDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRepoType(opt.value)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    repoType === opt.value
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:border-line-strong"
                  }`}
                >
                  <div className="text-xs font-medium text-ink">{opt.label}</div>
                  <div className="mt-0.5 text-[10px] text-light">{opt.desc}</div>
                </button>
              ))}
            </div>

            {repoType === "internal_gitlab" && (
              <div className="rounded-lg border border-line bg-bg p-3">
                <p className="text-xs text-mid">
                  A new GitLab repository will be auto-created on your internal instance. You can upload
                  files after creation.
                </p>
              </div>
            )}

            {repoType === "private_gitlab" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mid">GitLab Project URL</label>
                  <Input
                    type="url"
                    value={gitlabUrl}
                    onChange={(event) => setGitlabUrl(event.target.value)}
                    placeholder="https://gitlab.company.com/group/project"
                    required
                  />
                  <p className="mt-1 text-[10px] text-light">
                    Full URL to the project, including its namespace path.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mid">Personal Access Token</label>
                  <Input
                    type="password"
                    value={gitlabPat}
                    onChange={(event) => setGitlabPat(event.target.value)}
                    placeholder="glpat-..."
                    required
                  />
                  <p className="mt-1 text-[10px] text-light">
                    Needs read_repository + write_repository scope on this GitLab instance.
                  </p>
                </div>
              </>
            )}

            {repoType === "github" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mid">Authentication</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "oauth" as const, label: "GitHub Account", desc: "Connect via OAuth" },
                      { value: "pat" as const, label: "Access Token", desc: "Provide a repo + PAT" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGithubAuthMode(opt.value)}
                        className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                          githubAuthMode === opt.value
                            ? "border-accent bg-accent-soft"
                            : "border-line hover:border-line-strong"
                        }`}
                      >
                        <div className="text-xs font-medium text-ink">{opt.label}</div>
                        <div className="mt-0.5 text-[10px] text-light">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {githubAuthMode === "oauth" ? (
                  <div className="rounded-lg border border-line bg-bg p-3">
                    <p className="text-xs text-mid">
                      GitHub OAuth is not available in TP-Web — it requires the AI Studio gateway.
                      Switch to <span className="font-medium text-ink">Access Token</span> or use{" "}
                      <span className="font-medium text-ink">Internal GitLab</span> on edge.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-mid">GitHub Repository</label>
                      <Input
                        value={githubPatRepoFullName}
                        onChange={(event) => setGithubPatRepoFullName(event.target.value)}
                        placeholder="owner/repo"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-mid">Personal Access Token</label>
                      <Input
                        type="password"
                        value={githubPat}
                        onChange={(event) => setGithubPat(event.target.value)}
                        placeholder="ghp_..."
                        required
                      />
                      <p className="mt-1 text-[10px] text-light">Needs repo scope for the repository above.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {repoType === "bitbucket" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mid">Bitbucket Repository</label>
                  <Input
                    value={bitbucketRepoFullName}
                    onChange={(event) => setBitbucketRepoFullName(event.target.value)}
                    placeholder="https://bitbucket.org/myworkspace/myrepo"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mid">Bitbucket Account Email</label>
                  <Input
                    type="email"
                    value={bitbucketEmail}
                    onChange={(event) => setBitbucketEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mid">API Token</label>
                  <Input
                    type="password"
                    value={bitbucketPat}
                    onChange={(event) => setBitbucketPat(event.target.value)}
                    placeholder="ATCTT3xFf..."
                    required
                  />
                </div>
              </>
            )}
          </div>

          <div className="space-y-3 border-t border-line pt-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-light">Advanced (optional)</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mid">Default Branch</label>
                <Input
                  value={defaultBranch}
                  onChange={(event) => setDefaultBranch(event.target.value)}
                  placeholder="main"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mid">Working Directory</label>
                <Input
                  value={workingDirectory}
                  onChange={(event) => setWorkingDirectory(event.target.value)}
                  placeholder="src/"
                />
                <p className="mt-1 text-[10px] text-light">
                  Subdirectory operators will use as their working directory.
                </p>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mid">Description</label>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Brief description"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-line bg-bg px-3 py-2 text-xs text-mid">{error}</div>
          )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface px-6 py-4">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add Repository
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
