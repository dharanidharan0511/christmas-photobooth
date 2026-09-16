import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { LinedPanel } from "../ui/LinedPanel";
import { Spinner } from "../ui/Spinner";
import { cn } from "../../lib/utils";
import { isChatPromptInput, mindHasRepoInput } from "../../lib/codeRepoChat";
import type { CodeRepoType, CreateCodeRepoInput } from "../../types/codeRepos";
import type { MindInputField, MindSummary } from "../../types/engine";

type Step = 1 | 2 | 3 | 4;

type SourceKind = "internal_gitlab" | "private_gitlab" | "github" | "bitbucket" | "zip";

export type NewProjectMindOption = MindSummary & {
  /** Best-effort key-id hint from the Role that grants this Mind. */
  keyHint?: string | null;
  projectName?: string | null;
};

interface ProjectOption {
  id: string;
  name: string;
}

interface NewProjectModalProps {
  open: boolean;
  projects: ProjectOption[];
  /** CodeFlo+-tagged minds from my/access — no mock catalog. */
  minds: NewProjectMindOption[];
  mindsLoading?: boolean;
  defaultProjectId?: string;
  onClose: () => void;
  onSubmit: (input: CreateCodeRepoInput) => void;
  isSubmitting: boolean;
  error?: string | null;
}

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "01 · Basics" },
  { id: 2, label: "02 · Source" },
  { id: 3, label: "03 · Mind setup" },
  { id: 4, label: "04 · Review" },
];

const SOURCES: { id: SourceKind; label: string; desc: string }[] = [
  { id: "internal_gitlab", label: "Internal GitLab", desc: "Auto-creates repo" },
  { id: "private_gitlab", label: "Private GitLab", desc: "Connect your instance" },
  { id: "github", label: "GitHub", desc: "Connect your account" },
  { id: "bitbucket", label: "Bitbucket", desc: "Connect your workspace" },
  { id: "zip", label: "Zip upload", desc: "No provider — local git" },
];

function parseGithubFullName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    }
  } catch {
    /* fall through */
  }
  return trimmed.replace(/\.git$/, "");
}

function sourceLabel(kind: SourceKind): string {
  switch (kind) {
    case "internal_gitlab":
      return "Internal GitLab — auto-create on edge";
    case "private_gitlab":
      return "Private GitLab — clone on edge";
    case "github":
      return "GitHub — clone on edge";
    case "bitbucket":
      return "Bitbucket — clone on edge";
    case "zip":
      return "Zip upload — local git";
  }
}

function codefloTagLabel(tags: string[]): string {
  const hit = (tags ?? []).find((t) => t.toLowerCase().includes("codeflo"));
  return hit ?? "codeflo";
}

/** Setup inputs = declared schema minus chat prompt + repo wiring fields. */
function setupInputFields(mind: MindSummary | null): MindInputField[] {
  if (!mind) return [];
  return (mind.inputs ?? []).filter((field) => {
    const n = field.name.toLowerCase();
    if (isChatPromptInput(field.name)) return false;
    if (n === "repo_id" || n === "repoid" || n === "branch") return false;
    return true;
  });
}

function enumOptions(field: MindInputField): string[] {
  const fromEnum = field.schema?.enum?.map((v) => String(v)) ?? [];
  if (fromEnum.length > 0) return fromEnum;
  const fromOneOf =
    field.schema?.oneOf
      ?.map((o) => (o.title != null ? String(o.title) : o.const != null ? String(o.const) : null))
      .filter((v): v is string => Boolean(v)) ?? [];
  return fromOneOf;
}

export function NewProjectModal({
  open,
  projects,
  minds,
  mindsLoading = false,
  defaultProjectId,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: NewProjectModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [name, setName] = useState("");
  const [mindId, setMindId] = useState<string>("");
  const [source, setSource] = useState<SourceKind>("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [branch, setBranch] = useState("main");
  const [bitbucketEmail, setBitbucketEmail] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState("");

  const selectedMind = useMemo(
    () => minds.find((m) => m.id === mindId) ?? null,
    [mindId, minds],
  );
  const setupFields = useMemo(() => setupInputFields(selectedMind), [selectedMind]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
    setName("");
    setMindId(minds[0]?.id ?? "");
    setSource("github");
    setRepoUrl("");
    setAccessToken("");
    setBranch("main");
    setBitbucketEmail("");
    setParamValues({});
    setInstructions("");
  }, [defaultProjectId, open, projects, minds]);

  useEffect(() => {
    if (!selectedMind) return;
    // Prefer the Mind's own project when Roles grant it.
    if (selectedMind.projectId) setProjectId(selectedMind.projectId);
    const next: Record<string, string> = {};
    for (const field of setupInputFields(selectedMind)) {
      const opts = enumOptions(field);
      next[field.name] = opts[0] ?? "";
    }
    setParamValues(next);
  }, [selectedMind?.id]);

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

  const canNextBasics = Boolean(name.trim() && mindId && projectId);
  const canNextSource =
    source === "internal_gitlab" ||
    source === "zip" ||
    (source === "private_gitlab" && repoUrl.trim() && accessToken.trim()) ||
    (source === "github" && parseGithubFullName(repoUrl) && accessToken.trim()) ||
    (source === "bitbucket" &&
      parseGithubFullName(repoUrl) &&
      accessToken.trim() &&
      bitbucketEmail.trim());

  const paramSummary = useMemo(() => {
    const parts = setupFields
      .map((f) => paramValues[f.name]?.trim())
      .filter(Boolean);
    if (instructions.trim()) parts.push(instructions.trim().slice(0, 60));
    return parts.length > 0 ? parts.join(" · ") : "Default Mind parameters";
  }, [instructions, paramValues, setupFields]);

  function buildCreateInput(): CreateCodeRepoInput | null {
    if (!projectId || !name.trim() || !selectedMind) return null;

    const mindLine = `Mind: ${selectedMind.name} (${selectedMind.id})`;
    const setupParts = setupFields
      .map((f) => {
        const v = paramValues[f.name]?.trim();
        return v ? `${f.name}=${v}` : null;
      })
      .filter(Boolean);
    const setupLine =
      setupParts.length > 0 || instructions.trim()
        ? `Setup: ${[...setupParts, instructions.trim() || null].filter(Boolean).join("; ")}`
        : "";
    const description = [mindLine, setupLine].filter(Boolean).join("\n");

    const repoType: CodeRepoType = source === "zip" ? "internal_gitlab" : source;
    const fullName = parseGithubFullName(repoUrl);

    return {
      projectId,
      name: name.trim(),
      repoType,
      description: description || undefined,
      defaultBranch: branch.trim() || "main",
      ...(source === "private_gitlab"
        ? { gitlabUrl: repoUrl.trim(), gitlabAccessToken: accessToken }
        : {}),
      ...(source === "github"
        ? { githubRepoFullName: fullName, githubAccessToken: accessToken }
        : {}),
      ...(source === "bitbucket"
        ? {
            bitbucketRepoFullName: fullName,
            bitbucketEmail: bitbucketEmail.trim(),
            bitbucketAccessToken: accessToken,
          }
        : {}),
    };
  }

  function goNext() {
    if (step === 1 && canNextBasics) setStep(2);
    else if (step === 2 && canNextSource) setStep(3);
    else if (step === 3) setStep(4);
  }

  function goBack() {
    if (step > 1) setStep((s) => (s - 1) as Step);
  }

  function handleCreate() {
    const input = buildCreateInput();
    if (!input || isSubmitting) return;
    onSubmit(input);
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <LinedPanel
        className="flex max-h-[min(90vh,880px)] w-full max-w-3xl flex-col overflow-hidden bg-surface shadow-lg"
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-project-title"
          className="flex min-h-0 flex-1 flex-col"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="shrink-0 border-b border-line px-6 pt-5 pb-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="new-project-title" className="text-base font-semibold text-ink">
                New project
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-md p-1 text-light transition-colors hover:bg-bg-subtle hover:text-ink disabled:opacity-50"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex overflow-hidden rounded-sm border border-line">
              {STEPS.map((s, index) => {
                const active = step === s.id;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex flex-1 items-center justify-center border-line px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide",
                      index > 0 && "border-l",
                      active ? "bg-accent text-on-accent" : "bg-bg-subtle text-mid",
                    )}
                  >
                    {s.label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {step === 1 && (
              <div className="space-y-5">
                <p className="text-sm text-mid">
                  Name the project and pick a Mind tagged <strong className="text-ink">CodeFlo+</strong>{" "}
                  from your Roles — the Mind unpacks into the repo as the operator&apos;s skills.
                </p>

                {projects.length > 1 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-mid">Workspace project</label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full rounded-md border border-line bg-bg-subtle px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mid">Project name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Toyota Dashboard Migration"
                    className="bg-bg-subtle shadow-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mid">Mind (project type)</label>
                  {mindsLoading ? (
                    <div className="flex items-center gap-2 py-8 text-sm text-mid">
                      <Spinner /> Loading CodeFlo+ minds…
                    </div>
                  ) : minds.length === 0 ? (
                    <div className="rounded-md border border-dashed border-line px-4 py-8 text-center">
                      <p className="text-sm font-medium text-ink">No CodeFlo+ minds available</p>
                      <p className="mt-1 text-xs text-mid">
                        Your Roles need a Mind tagged <span className="font-mono">codeflo</span> /
                        CodeFlo+. Ask an admin to grant one.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {minds.map((mind) => {
                        const selected = mind.id === mindId;
                        const tag = codefloTagLabel(mind.tags);
                        return (
                          <button
                            key={mind.id}
                            type="button"
                            onClick={() => setMindId(mind.id)}
                            className={cn(
                              "flex flex-col rounded-md border p-3 text-left transition-colors",
                              selected
                                ? "border-accent bg-accent-soft/40"
                                : "border-line bg-surface hover:border-line-strong",
                            )}
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <span
                                className={cn(
                                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                                  selected ? "border-accent" : "border-line-strong",
                                )}
                              >
                                {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
                              </span>
                              <span className="min-w-0 truncate text-sm font-semibold text-ink">
                                {mind.name}
                              </span>
                            </div>
                            {mind.description ? (
                              <p className="mb-2 flex-1 text-[11px] leading-relaxed text-mid line-clamp-3">
                                {mind.description}
                              </p>
                            ) : (
                              <p className="mb-2 flex-1 text-[11px] text-faint">No description</p>
                            )}
                            <div className="mt-auto flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-accent-soft px-2 py-px text-[10px] font-medium text-accent-text">
                                {tag}
                              </span>
                              {mindHasRepoInput(mind) && (
                                <span className="text-[10px] text-faint">repo-aware</span>
                              )}
                              {mind.keyHint && (
                                <span className="font-mono text-[10px] text-faint">{mind.keyHint}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <p className="text-sm text-mid">
                  Bring your own repo — the engine clones and pulls it on the edge cluster and never
                  sends code out. No provider? Upload a zip and get a local git.
                </p>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SOURCES.map((opt) => {
                    const selected = source === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSource(opt.id)}
                        className={cn(
                          "rounded-md border px-3 py-2.5 text-left transition-colors",
                          selected
                            ? "border-accent bg-accent-soft/50"
                            : "border-line bg-surface hover:border-line-strong",
                        )}
                      >
                        <p className="text-sm font-semibold text-ink">{opt.label}</p>
                        <p className="mt-0.5 text-[11px] text-mid">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>

                {source === "internal_gitlab" && (
                  <p className="rounded-md border border-line bg-bg-subtle px-3 py-2 text-xs text-mid">
                    A new GitLab repository will be auto-created on your internal instance. You can
                    upload a zip after create from the project view.
                  </p>
                )}

                {source === "zip" && (
                  <p className="rounded-md border border-line bg-bg-subtle px-3 py-2 text-xs text-mid">
                    Creates a local workspace with{" "}
                    <code className="font-mono text-[11px]">git init</code>. Upload your zip from
                    the project view after create.
                  </p>
                )}

                {(source === "private_gitlab" || source === "github" || source === "bitbucket") && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-mid">
                        {source === "github"
                          ? "Repository URL"
                          : source === "bitbucket"
                            ? "Bitbucket repository"
                            : "GitLab URL"}
                      </label>
                      <Input
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder={
                          source === "github"
                            ? "https://github.com/org/repo"
                            : source === "bitbucket"
                              ? "workspace/repo"
                              : "https://gitlab.example.com/group/repo"
                        }
                        className="bg-bg-subtle shadow-none"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-mid">Access token</label>
                        <Input
                          type="password"
                          value={accessToken}
                          onChange={(e) => setAccessToken(e.target.value)}
                          placeholder="ghp_... / glpat-... / ATCTT..."
                          className="bg-bg-subtle shadow-none"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-mid">
                          Branch to work from
                        </label>
                        <Input
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          placeholder="main"
                          className="bg-bg-subtle shadow-none"
                        />
                      </div>
                    </div>

                    {source === "bitbucket" && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-mid">
                          Bitbucket account email
                        </label>
                        <Input
                          type="email"
                          value={bitbucketEmail}
                          onChange={(e) => setBitbucketEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="bg-bg-subtle shadow-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <p className="text-sm text-mid">
                  <strong className="text-ink">{selectedMind?.name ?? "This Mind"}</strong> asks for
                  these inputs — the parameter set comes from the Mind&apos;s input schema in
                  ai/Studio, so each Mind sets itself up differently.
                </p>

                {setupFields.length === 0 ? (
                  <p className="rounded-md border border-line bg-bg-subtle px-3 py-2 text-xs text-mid">
                    No extra setup fields on this Mind — you can still add optional instructions
                    below.
                  </p>
                ) : (
                  setupFields.map((field) => {
                    const opts = enumOptions(field);
                    return (
                      <div key={field.name}>
                        <label className="mb-1.5 block text-xs font-medium text-mid">
                          {field.description?.trim() || field.name}
                          {field.required ? " *" : ""}
                        </label>
                        {opts.length > 0 ? (
                          <select
                            value={paramValues[field.name] ?? ""}
                            onChange={(e) =>
                              setParamValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                            }
                            className="w-full rounded-md border border-line bg-bg-subtle px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/30"
                          >
                            {opts.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            value={paramValues[field.name] ?? ""}
                            onChange={(e) =>
                              setParamValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                            }
                            placeholder={field.name}
                            className="bg-bg-subtle shadow-none"
                          />
                        )}
                      </div>
                    );
                  })
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mid">
                    Additional instructions (optional)
                  </label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={4}
                    placeholder="e.g. Use Material-UI, JWT auth, follow REST best practices..."
                    className="w-full resize-y rounded-md border border-line bg-bg-subtle px-3 py-2 text-sm text-ink outline-none placeholder:text-light focus:ring-2 focus:ring-accent/30"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <p className="text-sm text-mid">Review before creating.</p>

                <dl className="divide-y divide-line border-y border-line">
                  {(
                    [
                      ["Project", name.trim() || "—"],
                      ["Mind", selectedMind?.name ?? "—"],
                      ["Source", sourceLabel(source)],
                      ["Parameters", paramSummary],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 py-3">
                      <dt className="shrink-0 text-sm text-mid">{label}</dt>
                      <dd className="text-right text-sm font-medium text-ink">
                        {label === "Mind" ? (
                          <span className="rounded-full bg-accent-soft px-2.5 py-[3px] text-[11px] font-medium text-accent-text">
                            {value}
                          </span>
                        ) : (
                          value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="rounded-md border border-accent/25 border-l-[3px] border-l-accent bg-accent-soft/60 px-3 py-2.5 text-xs leading-relaxed text-accent-text">
                  On create: the engine clones the source, unpacks the Mind&apos;s skills into the
                  repo, seeds the first tasks in <strong>progress.json</strong>, and opens the
                  Kanban. You review and approve each checkpoint before the agent proceeds.
                </div>

                {error && (
                  <p className="rounded-md border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={goBack}
                  disabled={isSubmitting}
                  className="bg-bg-subtle"
                >
                  ← Back
                </Button>
              )}
              {step < 4 ? (
                <Button
                  lined
                  type="button"
                  onClick={goNext}
                  disabled={
                    (step === 1 && (!canNextBasics || minds.length === 0)) ||
                    (step === 2 && !canNextSource) ||
                    isSubmitting
                  }
                >
                  Next →
                </Button>
              ) : (
                <Button
                  lined
                  type="button"
                  onClick={handleCreate}
                  disabled={isSubmitting || !canNextBasics}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create project"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </LinedPanel>
    </div>,
    document.body,
  );
}
