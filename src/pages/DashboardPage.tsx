/**
 * DashboardPage — /dashboard (Workbench)
 *
 * Landing page for all authenticated users. Matches the reference design:
 * header → 3 suite cards → "Your apps" grid → admin quick-links (admins only).
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Code, File, Play } from "lucide-react";
import { listMyAccess, listCodeRepos, listMySessions } from "../lib/engineClient";
import type { MindSummary, ProjectAccess, SessionSummary } from "../types/engine";
import { useAuth } from "../hooks/useAuth";
import { Spinner } from "../components/ui/Spinner";
import { LinedPanel } from "../components/ui/LinedPanel";
import { cn } from "../lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatLastRun(iso: string | null | undefined): string {
  if (!iso) return "never run";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return `last run today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return "last run yesterday";
  if (diffDays < 7) return `last run ${diffDays} days ago`;
  return `last run ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

function mindTypeBadge(tags: string[]): { label: string; className: string } {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.some((t) => t.includes("dag"))) return { label: "DAG",  className: "border-warning/40 text-warning bg-warning/10" };
  if (lower.some((t) => t.includes("codeflo") || t.includes("code"))) return { label: "Chat", className: "border-accent/40 text-accent bg-accent/10" };
  if (lower.some((t) => t.includes("docflo")  || t.includes("doc")))  return { label: "Chat", className: "border-accent/40 text-accent bg-accent/10" };
  if (lower.some((t) => t.includes("orchestrat") || t.includes("chat"))) return { label: "Chat", className: "border-accent/40 text-accent bg-accent/10" };
  return { label: "Mind", className: "border-line text-mid bg-surface" };
}

function flattenMinds(
  projects: ProjectAccess[],
): Array<{ mind: MindSummary; keyPrefix: string | undefined }> {
  const seen = new Set<string>();
  const out: Array<{ mind: MindSummary; keyPrefix: string | undefined }> = [];
  for (const p of projects) {
    const kp = p.keyPrefixes?.[0];
    for (const m of p.minds ?? []) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push({ mind: m, keyPrefix: kp });
    }
  }
  return out;
}

function buildLastRunMap(sessions: SessionSummary[]): Map<string, string | null> {
  const m = new Map<string, string | null>();
  // sessions come back newest-first from the API
  for (const s of sessions) {
    if (!m.has(s.mindId)) m.set(s.mindId, s.updatedAt ?? s.createdAt ?? null);
  }
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite card
// ─────────────────────────────────────────────────────────────────────────────

interface SuiteCardProps {
  index: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  stat?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
}

function SuiteCard({ index, icon, title, description, stat, loading, onClick }: SuiteCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-busy={loading || undefined}
      onClick={() => {
        if (loading) return;
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (loading) return;
        if (e.key === "Enter") onClick?.();
      }}
      className={cn(
        "group relative cursor-pointer focus:outline-none",
        loading && "pointer-events-none",
      )}
    >
      <LinedPanel
        interactive
        active={Boolean(loading)}
        contentClassName="p-6"
        className="h-full"
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/70">
            <Spinner className="h-5 w-5 text-accent" />
          </div>
        )}

        <div className="mb-2 text-accent">{icon}</div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-accent">
          Suite {String(index).padStart(2, "0")}
        </p>
        <h3 className="mb-2 text-lg font-semibold text-ink">{title}</h3>
        <p className="text-xs text-mid leading-relaxed">{description}</p>
        {stat && <p className="mt-4 text-[11px] text-light">{stat}</p>}
      </LinedPanel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App card
// ─────────────────────────────────────────────────────────────────────────────

interface AppCardProps {
  mind: MindSummary;
  keyPrefix?: string;
  lastRunAt?: string | null;
  loading?: boolean;
  onClick?: () => void;
}

function AppCard({ mind, keyPrefix, lastRunAt, loading, onClick }: AppCardProps) {
  const badge = mindTypeBadge(mind.tags);
  const shortPrefix = keyPrefix
    ? keyPrefix.slice(0, 12) + (keyPrefix.length > 12 ? "…" : "")
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-busy={loading || undefined}
      onClick={() => {
        if (loading) return;
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (loading) return;
        if (e.key === "Enter") onClick?.();
      }}
      className={cn(
        "group relative flex cursor-pointer focus:outline-none",
        loading && "pointer-events-none",
      )}
    >
      <LinedPanel
        interactive
        active={Boolean(loading)}
        contentClassName="flex h-full flex-col p-4"
        className="h-full w-full"
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/70">
            <Spinner className="h-5 w-5 text-accent" />
          </div>
        )}

        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded border px-1.5 py-px text-[10px] font-semibold",
              badge.className,
            )}
          >
            {badge.label}
          </span>
          {shortPrefix && (
            <span className="font-mono text-[10px] text-light">{shortPrefix}</span>
          )}
        </div>

        <p className="mb-1 text-sm font-semibold text-ink line-clamp-1">{mind.name}</p>

        {mind.description && (
          <p className="flex-1 text-xs text-mid line-clamp-2 leading-relaxed">{mind.description}</p>
        )}

        <p className="mt-3 text-[11px] text-faint">{formatLastRun(lastRunAt)}</p>
      </LinedPanel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const isAdmin = auth.mode === "key" || Boolean(auth.whoami?.isAdmin);
  /** Card currently navigating — shows a small loader until route data is primed. */
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  const accessQuery = useQuery({
    queryKey: ["myAccess"],
    queryFn: ({ signal }) => listMyAccess(signal),
  });

  const reposQuery = useQuery({
    queryKey: ["code-repos-count"],
    queryFn: ({ signal }) => listCodeRepos(signal),
    staleTime: 120_000,
  });

  const sessionsQuery = useQuery({
    queryKey: ["my-sessions-recent"],
    queryFn: ({ signal }) => listMySessions(100, undefined, signal),
    staleTime: 60_000,
  });

  const allMinds = flattenMinds(accessQuery.data ?? []);
  const repoCount = reposQuery.data?.length ?? 0;
  const mindCount = allMinds.length;
  const keyCount = new Set(
    (accessQuery.data ?? []).flatMap((p) => p.keyPrefixes ?? []),
  ).size;

  const roleNames = [
    ...new Set((accessQuery.data ?? []).map((p) => p.roleName).filter(Boolean)),
  ];

  const lastRunMap = useMemo(
    () => buildLastRunMap(sessionsQuery.data ?? []),
    [sessionsQuery.data],
  );

  async function navigateWhenReady(navKey: string, path: string, prefetch?: () => Promise<unknown>) {
    if (pendingNav) return;
    setPendingNav(navKey);
    try {
      await prefetch?.();
    } catch {
      // Destination page will surface its own error state.
    }
    // Paint the card spinner before swapping routes.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    navigate(path);
  }

  function openApp(mindId: string) {
    void navigateWhenReady(`app:${mindId}`, `/run?mindId=${mindId}`, () =>
      Promise.all([
        queryClient.prefetchQuery({
          queryKey: ["myAccess"],
          queryFn: ({ signal }) => listMyAccess(signal),
        }),
        queryClient.prefetchQuery({
          queryKey: ["mySessions", mindId],
          queryFn: ({ signal }) => listMySessions(50, mindId, signal),
        }),
      ]),
    );
  }

  function openSuite(navKey: string, path: string) {
    void navigateWhenReady(navKey, path, () => {
      if (path === "/run") {
        return queryClient.prefetchQuery({
          queryKey: ["myAccess"],
          queryFn: ({ signal }) => listMyAccess(signal),
        });
      }
      if (path === "/code-repos") {
        return queryClient.prefetchQuery({
          queryKey: ["code-repos"],
          queryFn: ({ signal }) => listCodeRepos(signal),
        });
      }
      return Promise.resolve();
    });
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
    <div className="mx-auto max-w-5xl space-y-10">

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="pt-2">
        <h1 className="text-4xl font-bold text-ink">Workbench</h1>
        <p className="mt-2 max-w-lg text-sm text-mid leading-relaxed">
          Everything this engine can do for you, granted through your Roles.
          Keys stay server-side — nothing to paste.
        </p>
      </div>

      {/* ── Suite cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">

        <SuiteCard
          index={1}
          icon={<Code size={18} strokeWidth={1.5} />}
          title="CodeFlo+"
          description="Agentic coding on your repos. Clone, prompt, review, push — or work from a zip, fully inside the edge cluster."
          loading={pendingNav === "suite:codeflo"}
          stat={
            reposQuery.isLoading ? (
              <span className="inline-flex items-center gap-1"><Spinner className="h-2.5 w-2.5" /> loading…</span>
            ) : repoCount > 0 ? (
              `${repoCount} repo${repoCount !== 1 ? "s" : ""} connected`
            ) : (
              "No repos yet"
            )
          }
          onClick={() => openSuite("suite:codeflo", "/code-repos")}
        />

        <SuiteCard
          index={2}
          icon={<File size={18} strokeWidth={1.5} />}
          title="DocFlo+"
          description="Agent-based doc-chat: each agent carries its own datasources and knowledge graph."
          loading={pendingNav === "suite:docflo"}
          stat={
            accessQuery.isLoading ? (
              <span className="inline-flex items-center gap-1"><Spinner className="h-2.5 w-2.5" /> loading…</span>
            ) : undefined
          }
          onClick={() => openSuite("suite:docflo", "/docflo/agents")}
        />

        <SuiteCard
          index={3}
          icon={<Play size={18} strokeWidth={1.5} fill="none" />}
          title="Run Minds"
          description="Execute any Mind your Role grants — DAG runs with per-step output tabs, orchestrators as chat with artefacts."
          loading={pendingNav === "suite:run"}
          stat={
            accessQuery.isLoading ? (
              <span className="inline-flex items-center gap-1"><Spinner className="h-2.5 w-2.5" /> loading…</span>
            ) : mindCount > 0 ? (
              `${mindCount} mind${mindCount !== 1 ? "s" : ""} granted via ${keyCount} key${keyCount !== 1 ? "s" : ""}`
            ) : (
              "No minds granted yet"
            )
          }
          onClick={() => openSuite("suite:run", "/run")}
        />
      </div>

      {/* ── Your apps ────────────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-base font-semibold text-ink">Your apps</h2>
          <span className="text-xs text-light">
            published from Minds your Roles grant
            {roleNames.length > 0 && <> · {roleNames.join(", ")}</>}
          </span>
        </div>

        {accessQuery.isLoading && (
          <div className="flex items-center gap-2 py-10 text-sm text-mid">
            <Spinner /> Loading your apps…
          </div>
        )}

        {accessQuery.isSuccess && allMinds.length === 0 && (
          <LinedPanel contentClassName="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-ink">No apps yet</p>
            <p className="mt-1 text-xs text-mid">
              Ask an admin to assign you a Role that grants access to Minds.
            </p>
          </LinedPanel>
        )}

        {allMinds.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allMinds.map(({ mind, keyPrefix }) => (
              <AppCard
                key={mind.id}
                mind={mind}
                keyPrefix={keyPrefix}
                lastRunAt={lastRunMap.get(mind.id)}
                loading={pendingNav === `app:${mind.id}`}
                onClick={() => openApp(mind.id)}
              />
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="border-t border-line pt-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-faint">
            Administration
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Users",    path: "/users"   },
              { label: "Roles",    path: "/roles"   },
              { label: "Credits",  path: "/credits" },
              { label: "Audit log",path: "/audit"   },
            ].map(({ label, path }) => (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-mid transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

