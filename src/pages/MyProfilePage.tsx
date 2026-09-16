/**
 * MyProfilePage — /user
 *
 * Self-service "My profile & access" for the signed-in cookie identity.
 * Layout mirrors the Workbench dashed panels (corner marks) and shows
 * only data the caller can read: whoami, /api/v2/my/access, code repos,
 * and /user/spend-cap. Admin actions (assign role, deactivate) stay on
 * /users/:id.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { fetchMySpendCap, listCodeRepos, listMyAccess } from "../lib/engineClient";
import type { MindSummary, ProjectAccess } from "../types/engine";
import { repoTypeLabel } from "../lib/code-repos";
import { useAuth } from "../hooks/useAuth";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { ApiErrorState } from "../components/ui/ApiErrorState";
import { cn } from "../lib/utils";

function CornerMark({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const cls: Record<string, string> = {
    tl: "absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2",
    tr: "absolute top-0 right-0 translate-x-1/2 -translate-y-1/2",
    bl: "absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
    br: "absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2",
  };
  return (
    <span className={cn(cls[pos], "select-none font-light leading-none text-line-strong text-sm")}>
      +
    </span>
  );
}

function Panel({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative flex flex-col rounded-xl border border-dashed border-line bg-surface p-5",
        className,
      )}
    >
      <CornerMark pos="tl" />
      <CornerMark pos="tr" />
      <CornerMark pos="bl" />
      <CornerMark pos="br" />
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-accent">{title}</h2>
      {description ? <p className="mt-1.5 text-xs text-mid leading-relaxed">{description}</p> : null}
      <div className="mt-4 min-h-0 flex-1">{children}</div>
    </section>
  );
}

function mindSuiteBadge(tags: string[]): string {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.some((t) => t.includes("codeflo") || t.includes("code"))) return "codeflo";
  if (lower.some((t) => t.includes("docflo") || t.includes("doc"))) return "docflo";
  if (lower.some((t) => t.includes("orchestrat"))) return "orchestrator";
  if (lower.some((t) => t.includes("dag"))) return "dag";
  return "mind";
}

function flattenGrantedMinds(grants: ProjectAccess[]): Array<{
  mind: MindSummary;
  viaRole: string;
}> {
  const seen = new Set<string>();
  const out: Array<{ mind: MindSummary; viaRole: string }> = [];
  for (const grant of grants) {
    for (const mind of grant.minds ?? []) {
      if (seen.has(mind.id)) continue;
      seen.add(mind.id);
      out.push({ mind, viaRole: grant.roleName });
    }
  }
  return out;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function uniqueRoles(grants: ProjectAccess[], whoamiRoles: string[]): Array<{
  name: string;
  keyLabels: string[];
  isAdminRole: boolean;
}> {
  const byName = new Map<string, { name: string; keyLabels: string[]; isAdminRole: boolean }>();

  for (const name of whoamiRoles) {
    byName.set(name, {
      name,
      keyLabels: [],
      isAdminRole: name === "system_admin" || name.toLowerCase().includes("admin"),
    });
  }

  for (const grant of grants) {
    const existing = byName.get(grant.roleName) ?? {
      name: grant.roleName,
      keyLabels: [],
      isAdminRole: false,
    };
    const labels =
      grant.keyNames?.length
        ? grant.keyNames.map((n, i) => n ?? grant.keyPrefixes[i] ?? "key").filter(Boolean)
        : grant.keyPrefixes ?? [];
    for (const label of labels) {
      if (!existing.keyLabels.includes(label)) existing.keyLabels.push(label);
    }
    byName.set(grant.roleName, existing);
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function MyProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const whoami = auth.whoami;

  const accessQuery = useQuery({
    queryKey: ["myAccess"],
    queryFn: ({ signal }) => listMyAccess(signal),
    enabled: auth.mode === "cookie" && Boolean(whoami),
  });

  const reposQuery = useQuery({
    queryKey: ["code-repos"],
    queryFn: ({ signal }) => listCodeRepos(signal),
    enabled: auth.mode === "cookie" && Boolean(whoami),
  });

  const spendQuery = useQuery({
    queryKey: ["mySpendCap"],
    queryFn: ({ signal }) => fetchMySpendCap(signal),
    enabled: auth.mode === "cookie" && Boolean(whoami),
  });

  const grants = accessQuery.data ?? [];
  const roles = useMemo(
    () => uniqueRoles(grants, whoami?.roles ?? []),
    [grants, whoami?.roles],
  );
  const minds = useMemo(() => flattenGrantedMinds(grants), [grants]);
  const repos = reposQuery.data ?? [];

  // Key-auth has no personal profile — send admins to the users list instead.
  if (auth.mode === "key") {
    return <Navigate to="/users" replace />;
  }

  if (!whoami) {
    return <Navigate to="/" replace />;
  }

  const displayName = whoami.eml.split("@")[0] || whoami.eml;
  const initial = displayName.charAt(0).toUpperCase();

  const spend = spendQuery.data;
  const isCapped = typeof spend?.maxBudgetUsd === "number";
  const spent = typeof spend?.spentUsd === "number" ? spend.spentUsd : null;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mb-3 flex items-center gap-1 text-xs text-accent transition-colors hover:text-accent/80"
          >
            ← Workbench
          </button>

          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-semibold text-on-accent">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold text-ink">{displayName}</h1>
                <Badge tone="success">active</Badge>
                {whoami.isAdmin && (
                  <Badge
                    tone="admin"
                    title={
                      whoami.adminSource === "env"
                        ? "Listed in USER_MODULE_ADMIN_EMAILS"
                        : "Granted system_admin"
                    }
                  >
                    system_admin
                  </Badge>
                )}
              </div>
              <p className="mt-1 font-mono text-sm text-mid">{whoami.eml}</p>
            </div>
          </div>
        </div>

        {/* Grid: identity + roles | minds; projects + spend below */}
        <div className="grid gap-4 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
          <Panel
            title="SSO identity"
            description="Signed-in session from the edge identity cookie."
            className="lg:col-span-1"
          >
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-faint">
                  Identity
                </dt>
                <dd className="mt-0.5 text-ink">{whoami.eml}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-faint">
                  User id
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-ink">{whoami.uid}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-faint">
                  Session
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-mid truncate" title={whoami.sid}>
                  {whoami.sid}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-faint">
                  Sign-in
                </dt>
                <dd className="mt-0.5 text-ink">
                  SSO cookie
                  <span className="text-mid"> · password login is set by an admin if needed</span>
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="Role assignments"
            description="Roles are the only thing that grants Minds. Assigned by an Edge IT Admin."
            className="lg:col-span-1"
          >
            {accessQuery.isLoading && roles.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-mid">
                <Spinner /> Loading roles…
              </div>
            ) : accessQuery.isError && roles.length === 0 ? (
              <ApiErrorState error={accessQuery.error} onRetry={() => void accessQuery.refetch()} />
            ) : roles.length === 0 ? (
              <p className="text-sm text-mid">No roles assigned yet.</p>
            ) : (
              <ul className="space-y-3">
                {roles.map((role) => (
                  <li key={role.name} className="border-b border-line-subtle pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-ink">{role.name}</p>
                    <p className="mt-0.5 text-xs text-mid">
                      {role.isAdminRole && role.keyLabels.length === 0
                        ? "admin — no keys"
                        : role.keyLabels.length === 0
                          ? "no keys mapped"
                          : role.keyLabels.join(", ")}
                    </p>
                    {whoami.isAdmin && (
                      <Link
                        to="/roles"
                        className="mt-1 inline-block text-xs font-medium text-accent hover:underline"
                      >
                        view
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!whoami.isAdmin && (
              <p className="mt-4 text-[11px] text-faint">
                Ask an admin to assign or change roles — you can&apos;t edit them here.
              </p>
            )}
          </Panel>

          <Panel
            title="Minds granted"
            description="Union of all Roles — what you can actually run."
            className="lg:col-span-1 lg:row-span-2"
          >
            {accessQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-mid">
                <Spinner /> Loading minds…
              </div>
            ) : accessQuery.isError ? (
              <ApiErrorState error={accessQuery.error} onRetry={() => void accessQuery.refetch()} />
            ) : minds.length === 0 ? (
              <p className="text-sm text-mid">No published Minds on your Roles yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {minds.map(({ mind, viaRole }) => {
                  const suite = mindSuiteBadge(mind.tags ?? []);
                  return (
                    <li key={mind.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-ink">{mind.name}</span>
                      <span className="rounded border border-accent/40 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-accent">
                        {suite}
                      </span>
                      <span className="text-[11px] text-faint">via {viaRole}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title={`CodeFlo+ projects${repos.length ? ` · ${repos.length}` : ""}`}
            description="Repos your Roles can reach — admin lists never include the code itself."
            className="lg:col-span-1"
          >
            {reposQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-mid">
                <Spinner /> Loading projects…
              </div>
            ) : reposQuery.isError ? (
              <ApiErrorState error={reposQuery.error} onRetry={() => void reposQuery.refetch()} />
            ) : repos.length === 0 ? (
              <p className="text-sm text-mid">No CodeFlo+ repos yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-faint">
                      <th className="pb-2 font-medium">Project</th>
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repos.map((repo) => (
                      <tr key={repo.id} className="border-t border-line-subtle">
                        <td className="py-2 pr-3">
                          <Link
                            to={`/code-repos/${repo.id}/code`}
                            className="font-medium text-ink hover:text-accent"
                          >
                            {repo.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-xs text-mid">{repoTypeLabel(repo.repoType)}</td>
                        <td className="py-2 text-xs text-faint">
                          {formatRelative(repo.updatedAt ?? repo.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Spend · this period"
            description="Runs draw on the workspace credit pool. Personal caps are optional."
            className="lg:col-span-1"
          >
            {spendQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-mid">
                <Spinner /> Loading spend…
              </div>
            ) : spendQuery.isError ? (
              <ApiErrorState error={spendQuery.error} onRetry={() => void spendQuery.refetch()} />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                      Used
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-ink">
                      {spent === null ? (
                        <span className="text-lg text-mid">unknown</span>
                      ) : (
                        `$${spent.toFixed(2)}`
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                      Personal limit
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-ink">
                      {isCapped ? `$${spend!.maxBudgetUsd}` : "Uncapped"}
                    </p>
                    {isCapped && spend?.budgetDuration ? (
                      <p className="mt-0.5 text-[11px] text-mid">per {spend.budgetDuration}</p>
                    ) : null}
                  </div>
                </div>
                {whoami.isAdmin ? (
                  <Link to="/credits" className="text-xs font-medium text-accent hover:underline">
                    Open Credits
                  </Link>
                ) : null}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
