import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { FolderGit2, Plus, Trash2, Upload } from "lucide-react";
import { NewProjectModal, type NewProjectMindOption } from "../components/code-repos/NewProjectModal";
import { DeleteCodeRepoModal } from "../components/code-repos/DeleteCodeRepoModal";
import { UploadCodeRepoModal, type UploadCodeRepoFormValues } from "../components/code-repos/UploadCodeRepoModal";
import { createCodeRepo, deleteCodeRepo, listCodeRepos, listMyAccess, uploadCodeRepoFiles } from "../lib/engineClient";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { LinedPanel } from "../components/ui/LinedPanel";
import { Spinner } from "../components/ui/Spinner";
import { isCodefloTaggedMind, pickCodeRepoMinds } from "../lib/codeRepoChat";
import {
  defaultBranchLabel,
  groupReposByProject,
  repoTypeLabel,
} from "../lib/code-repos";
import type { CodeRepoListItem, CreateCodeRepoInput } from "../types/codeRepos";
import type { ProjectAccess } from "../types/engine";
import { cn } from "../lib/utils";

function formatRepoActivity(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}

function displaySourceLabel(repo: CodeRepoListItem): string {
  // Zip-style projects have no remote connector — match the design label.
  if (!repo.edgeConnectorRef && repo.repoType === "internal_gitlab") {
    return "Zip upload";
  }
  return repoTypeLabel(repo.repoType);
}

function mindLabelForRepo(projects: ProjectAccess[], projectId: string): string | null {
  const minds = projects.flatMap((p) => (p.projectId === projectId ? (p.minds ?? []) : []));
  const picked = pickCodeRepoMinds(minds, projectId);
  return picked[0]?.name ?? null;
}

function CodeRepoCard({
  repo,
  mindLabel,
  ownerInitial,
  onDelete,
  onUpload,
}: {
  repo: CodeRepoListItem;
  mindLabel: string | null;
  ownerInitial: string;
  onDelete: (repo: CodeRepoListItem) => void;
  onUpload: (repo: CodeRepoListItem) => void;
}) {
  const branch = defaultBranchLabel(repo.defaultBranch);
  const sourceLabel = displaySourceLabel(repo);
  const activity = formatRepoActivity(repo.updatedAt ?? repo.createdAt);
  const outlineTag = repo.description?.trim() || `Branch · ${branch}`;

  return (
    <div className="group relative h-full focus-within:outline-none">
      <LinedPanel interactive className="h-full" contentClassName="relative flex h-full flex-col p-4">
        {/* Action buttons — top-right, revealed on hover */}
        <div className="absolute right-3 top-3 z-[3] flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title="Upload files"
            onClick={(e) => {
              e.preventDefault();
              onUpload(repo);
            }}
            className="rounded p-1 text-light hover:bg-accent/10 hover:text-accent"
          >
            <Upload size={13} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={(e) => {
              e.preventDefault();
              onDelete(repo);
            }}
            className="rounded p-1 text-light hover:bg-error/10 hover:text-error"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>

        <Link
          to={`/code-repos/${repo.id}/kanban?branch=${encodeURIComponent(branch)}`}
          className="flex flex-1 flex-col"
        >
          {/* Header: name + source */}
          <div className="mb-3 flex items-start justify-between gap-2 pr-10">
            <h3 className="text-sm font-bold leading-snug text-ink">{repo.name}</h3>
            <span className="shrink-0 text-[11px] text-faint">{sourceLabel}</span>
          </div>

          {/* Tags: mind (fill) + task/branch (outline) */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {(mindLabel || repo.projectName) && (
              <span className="rounded-full bg-accent-soft px-2.5 py-[3px] text-[11px] font-medium text-accent-text">
                {mindLabel || repo.projectName}
              </span>
            )}
            <span className="max-w-full truncate rounded border border-accent/35 px-2 py-0.5 text-[11px] text-accent">
              {outlineTag}
            </span>
          </div>

          {/* Progress — honest empty until progress.json is wired */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-mid">Not started · {branch}</span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">0%</span>
            </div>
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-line">
              <div className="h-full w-0 rounded-full bg-accent transition-[width] duration-300" />
            </div>
          </div>

          {/* Footer: owner + timestamp */}
          <div className="mt-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full",
                  "bg-surface-active text-[10px] font-semibold text-mid",
                )}
                title="You"
              >
                {ownerInitial}
              </span>
            </div>
            {activity && <span className="text-[11px] text-faint">{activity}</span>}
          </div>
        </Link>
      </LinedPanel>
    </div>
  );
}

export function CodeReposPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [repoToDelete, setRepoToDelete] = useState<CodeRepoListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [repoToUpload, setRepoToUpload] = useState<CodeRepoListItem | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const ownerInitial = (
    auth.mode === "key" ? "K" : (auth.whoami?.eml?.split("@")[0] ?? "?").charAt(0)
  ).toUpperCase();

  const accessQuery = useQuery({
    queryKey: ["my-access", "code-repos"],
    queryFn: ({ signal }) => listMyAccess(signal),
    enabled: auth.mode === "cookie",
    staleTime: 60_000,
  });

  const reposQuery = useQuery({
    queryKey: ["code-repos"],
    queryFn: ({ signal }) => listCodeRepos(signal),
    enabled: auth.mode === "cookie",
    staleTime: 30_000,
  });

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const project of accessQuery.data ?? []) {
      if (!seen.has(project.projectId)) {
        seen.set(project.projectId, project.projectName ?? project.projectId);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [accessQuery.data]);

  /** CodeFlo+-tagged minds from Roles (deduped). */
  const codefloMinds = useMemo((): NewProjectMindOption[] => {
    const byId = new Map<string, NewProjectMindOption>();
    for (const project of accessQuery.data ?? []) {
      const keyHint = project.keyPrefixes?.[0] ?? null;
      for (const mind of project.minds ?? []) {
        if (!isCodefloTaggedMind(mind)) continue;
        if (byId.has(mind.id)) continue;
        byId.set(mind.id, {
          ...mind,
          projectId: mind.projectId ?? project.projectId,
          projectName: project.projectName,
          keyHint: keyHint ? keyHint.slice(0, 12) : null,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [accessQuery.data]);

  const displayRepos = useMemo((): CodeRepoListItem[] => {
    const projectNames = new Map<string, string>();
    for (const project of accessQuery.data ?? []) {
      projectNames.set(project.projectId, project.projectName ?? project.projectId);
    }

    return (reposQuery.data ?? []).map((repo) => ({
      ...repo,
      projectName: projectNames.get(repo.projectId) ?? repo.projectId,
    }));
  }, [accessQuery.data, reposQuery.data]);

  const groups = useMemo(() => groupReposByProject(displayRepos), [displayRepos]);

  const createMutation = useMutation({
    mutationFn: (input: CreateCodeRepoInput) => createCodeRepo(input),
    onSuccess: async (repo) => {
      setCreateError(null);
      setModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["code-repos"] });
      const branch = defaultBranchLabel(repo.defaultBranch);
      navigate(`/code-repos/${repo.id}/kanban?branch=${encodeURIComponent(branch)}`);
    },
    onError: (error: Error) => {
      setCreateError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (repoId: string) => deleteCodeRepo(repoId),
    onSuccess: async () => {
      setDeleteError(null);
      setRepoToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["code-repos"] });
    },
    onError: (error: Error) => {
      setDeleteError(error.message);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (input: UploadCodeRepoFormValues) =>
      uploadCodeRepoFiles(input.repoId, {
        files: input.files,
        commitMessage: input.commitMessage,
        branch: input.branch,
      }),
    onSuccess: async () => {
      setUploadError(null);
      setRepoToUpload(null);
      await queryClient.invalidateQueries({ queryKey: ["code-repos"] });
    },
    onError: (error: Error) => {
      setUploadError(error.message);
    },
  });

  const isLoading = auth.mode === "cookie" && (accessQuery.isLoading || reposQuery.isLoading);
  const loadError = reposQuery.error instanceof Error ? reposQuery.error.message : null;

  if (auth.mode === "key") {
    return (
      <EmptyState
        icon={<FolderGit2 size={28} strokeWidth={1.5} />}
        title="Sign in with SSO to browse code repos"
        description="The code repository APIs require an identity session. Admin key mode can manage users and roles, but repo browsing uses the signed-in employee token."
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
    <div className="mx-auto max-w-5xl space-y-8">

      {/* ── Page header ── */}
      <div className="pt-2">
        {/* Back breadcrumb */}
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mb-3 flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
        >
          ← Workbench
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-ink">CodeFlo+ · Projects</h1>
            <p className="mt-2 max-w-lg text-sm text-mid leading-relaxed">
              A project is <strong className="text-ink">your repo + a Mind</strong>. Bring your
              own repository or a zip; the Mind you pick — migrator, secure coder, documenter —
              unpacks into the repo as the operator's skills. Everything runs on the edge cluster;
              agents commit to their own branches.
            </p>
            <p className="mt-1.5 text-xs text-faint">
              Projects are per-user — visible only to you and the people you share them with.
            </p>
          </div>

          <Button
            lined
            onClick={() => { setCreateError(null); setModalOpen(true); }}
            disabled={projectOptions.length === 0 || accessQuery.isLoading}
            className="gap-1.5 shrink-0"
          >
            <Plus size={14} strokeWidth={2} />
            New project
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-mid">
          {loadError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : groups.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={<FolderGit2 size={28} strokeWidth={1.5} />}
            title="No repositories for your projects"
            description="Add a repository to connect Git for a project your Roles grant access to."
          />
          {projectOptions.length > 0 && (
            <div className="flex justify-center">
              <Button
                size="sm"
                onClick={() => {
                  setCreateError(null);
                  setModalOpen(true);
                }}
              >
                <Plus size={14} />
                Add Repository
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {displayRepos.map((repo) => (
              <CodeRepoCard
                key={repo.id}
                repo={repo}
                mindLabel={mindLabelForRepo(accessQuery.data ?? [], repo.projectId)}
                ownerInitial={ownerInitial}
                onUpload={(target) => { setUploadError(null); setRepoToUpload(target); }}
                onDelete={(target) => { setDeleteError(null); setRepoToDelete(target); }}
              />
            ))}
          </div>
          <p className="text-xs text-faint">
            Zip-based projects get a local{" "}
            <code className="rounded border border-line bg-surface px-1 py-px font-mono text-[11px]">git init</code>
            {" "}— download the latest code as a zip any time. Minds available here come from your Roles.
          </p>
        </>
      )}

      <NewProjectModal
        open={modalOpen}
        projects={projectOptions}
        minds={codefloMinds}
        mindsLoading={accessQuery.isLoading}
        onClose={() => {
          if (!createMutation.isPending) setModalOpen(false);
        }}
        onSubmit={(input) => createMutation.mutate(input)}
        isSubmitting={createMutation.isPending}
        error={createError}
      />

      <DeleteCodeRepoModal
        open={Boolean(repoToDelete)}
        repo={repoToDelete}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setRepoToDelete(null);
            setDeleteError(null);
          }
        }}
        onConfirm={() => {
          if (repoToDelete) deleteMutation.mutate(repoToDelete.id);
        }}
        isDeleting={deleteMutation.isPending}
        error={deleteError}
      />

      <UploadCodeRepoModal
        open={Boolean(repoToUpload)}
        repo={repoToUpload}
        onClose={() => {
          if (!uploadMutation.isPending) {
            setRepoToUpload(null);
            setUploadError(null);
          }
        }}
        onSubmit={(input) => uploadMutation.mutateAsync(input)}
        isSubmitting={uploadMutation.isPending}
        error={uploadError}
      />
    </div>
    </div>
  );
}
