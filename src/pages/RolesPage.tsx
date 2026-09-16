import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createRole,
  createRoleName,
  deleteProjectMinds,
  deleteRole,
  deleteRoleName,
  listAllRoles,
  listKnownProjects,
  listUserRoles,
  listUsers,
  removeRole,
  resolveShareKey,
  setUserSystemAdmin,
  updateRole,
} from "../lib/engineClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Spinner } from "../components/ui/Spinner";
import { ApiErrorState } from "../components/ui/ApiErrorState";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/Table";
import type { EngineRole, EngineUser } from "../types/engine";
import { cn } from "../lib/utils";
import { createPortal } from "react-dom";
import { AdminPageHeader, AdminSectionLayout } from "../components/layout/AdminSectionLayout";
import { NewRoleModal } from "../components/roles/NewRoleModal";

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

type RoleMember = {
  userId: string;
  email: string;
  displayName: string;
  /** Role mapping ids to remove for this name (may be multiple projects). */
  roleIds: string[];
  /** True when membership is only the system_admin flag, not a Role row. */
  viaAdminFlag?: boolean;
};

type RoleKeyChip = {
  prefix: string;
  /** Friendly label when the engine/Studio has cached a name. */
  label: string;
  hasStoredKey: boolean;
  projectLabel?: string;
};

type RoleBoardCard = {
  name: string;
  kind: "admin" | "granted" | "bare";
  description: string;
  keys: RoleKeyChip[];
  mappingCount: number;
  memberCount: number;
  /** False for synthetic system_admin card with no Role name row. */
  canDeleteRole: boolean;
};

function collectRoleKeys(group: EngineRole[]): RoleKeyChip[] {
  const byPrefix = new Map<string, RoleKeyChip>();
  for (const role of group) {
    const projectLabel = role.projectName?.trim() || undefined;
    const fromKeys =
      (role.keys ?? []).length > 0
        ? role.keys!
        : (role.keyPrefixes ?? []).map((prefix) => ({
            prefix,
            name: undefined as string | undefined,
            hasStoredKey: false,
          }));

    for (const key of fromKeys) {
      const prefix = (key.prefix ?? "").trim();
      if (!prefix) continue;
      const id = prefix.slice(0, 12);
      const existing = byPrefix.get(id);
      const label = (key.name?.trim() || id);
      if (!existing) {
        byPrefix.set(id, {
          prefix: id,
          label,
          hasStoredKey: Boolean(key.hasStoredKey),
          projectLabel,
        });
      } else {
        byPrefix.set(id, {
          ...existing,
          label: key.name?.trim() ? key.name.trim() : existing.label,
          hasStoredKey: existing.hasStoredKey || Boolean(key.hasStoredKey),
          projectLabel: existing.projectLabel || projectLabel,
        });
      }
    }
  }
  return [...byPrefix.values()].sort((a, b) => a.prefix.localeCompare(b.prefix));
}

function buildRoleBoard(
  roles: EngineRole[],
  memberCountByRoleName: Map<string, number>,
  adminMemberCount: number,
): RoleBoardCard[] {
  const byName = new Map<string, EngineRole[]>();
  for (const role of roles) {
    const name = role.name.trim();
    if (!name) continue;
    const group = byName.get(name) ?? [];
    group.push(role);
    byName.set(name, group);
  }

  const cards: RoleBoardCard[] = [];

  for (const [name, group] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const keys = collectRoleKeys(group);
    const hasProject = group.some((r) => Boolean(r.projectId));
    const isAdminRole = name === "system_admin" || name.toLowerCase().includes("admin");
    const kind: RoleBoardCard["kind"] =
      isAdminRole && keys.length === 0
        ? "admin"
        : hasProject || keys.length > 0
          ? "granted"
          : "bare";

    let description: string;
    if (kind === "admin") {
      description =
        "Full engine administration — users, roles, credits, audit. Grants no minds by itself.";
    } else if (kind === "granted") {
      const stored = keys.filter((k) => k.hasStoredKey).length;
      description =
        keys.length === 1
          ? stored
            ? "Grants the minds under this key — raw key stored for one-click Run."
            : "Grants the minds under this registered mind-share key-id."
          : `Grants minds across ${keys.length} mind-share key-ids${stored ? ` (${stored} stored for one-click Run)` : ""}.`;
    } else {
      description =
        "Role name reserved — attach mind-share keys with New role or Advanced tools below.";
    }

    cards.push({
      name,
      kind,
      description,
      keys,
      mappingCount: group.filter((r) => r.projectId).length,
      memberCount: memberCountByRoleName.get(name) ?? 0,
      canDeleteRole: true,
    });
  }

  if (!byName.has("system_admin") && adminMemberCount > 0) {
    cards.unshift({
      name: "system_admin",
      kind: "admin",
      description:
        "Full engine administration — users, roles, credits, audit. Grants no minds by itself.",
      keys: [],
      mappingCount: 0,
      memberCount: adminMemberCount,
      canDeleteRole: false,
    });
  }

  return cards;
}

function buildMembersByRoleName(
  users: EngineUser[],
  roleQueries: Array<{ data?: EngineRole[] }>,
): Map<string, RoleMember[]> {
  const map = new Map<string, RoleMember[]>();

  users.forEach((user, index) => {
    const roles = roleQueries[index]?.data ?? [];
    const byName = new Map<string, string[]>();
    for (const role of roles) {
      const name = role.name.trim();
      if (!name) continue;
      const ids = byName.get(name) ?? [];
      ids.push(role.id);
      byName.set(name, ids);
    }
    for (const [name, roleIds] of byName) {
      const list = map.get(name) ?? [];
      list.push({
        userId: user.id,
        email: user.email,
        displayName: user.displayName || user.email.split("@")[0] || user.email,
        roleIds,
      });
      map.set(name, list);
    }

    if (user.isAdmin) {
      const list = map.get("system_admin") ?? [];
      if (!list.some((m) => m.userId === user.id)) {
        list.push({
          userId: user.id,
          email: user.email,
          displayName: user.displayName || user.email.split("@")[0] || user.email,
          roleIds: [],
          viaAdminFlag: true,
        });
        map.set("system_admin", list);
      }
    }
  });

  return map;
}

function RoleManageModal({
  card,
  members,
  onClose,
}: {
  card: RoleBoardCard;
  members: RoleMember[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const removeMemberMutation = useMutation({
    mutationFn: async (member: RoleMember) => {
      if (member.viaAdminFlag || (card.name === "system_admin" && member.roleIds.length === 0)) {
        await setUserSystemAdmin(member.userId, false);
        return;
      }
      for (const roleId of member.roleIds) {
        await removeRole(member.userId, roleId);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["userRoles"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["whoami"] });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: () => deleteRoleName(card.name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      void queryClient.invalidateQueries({ queryKey: ["userRoles"] });
      onClose();
    },
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleteRoleMutation.isPending && !removeMemberMutation.isPending) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, deleteRoleMutation.isPending, removeMemberMutation.isPending]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !deleteRoleMutation.isPending &&
          !removeMemberMutation.isPending
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-manage-title"
        className="relative flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="role-manage-title" className="font-mono text-base font-semibold text-ink">
              {card.name}
            </h2>
            <p className="mt-1 text-xs text-mid">{card.description}</p>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="rounded-md p-1 text-mid hover:bg-surface-hover hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {card.keys.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-faint">
                Mind Share Keys
              </p>
              <ul className="space-y-2">
                {card.keys.map((key) => (
                  <li
                    key={key.prefix}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-line px-2.5 py-2"
                  >
                    <span
                      className="rounded border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] font-medium text-accent"
                      title={key.prefix}
                    >
                      {key.label}
                    </span>
                    {key.label !== key.prefix && (
                      <span className="font-mono text-[10px] text-faint">{key.prefix}</span>
                    )}
                    {key.hasStoredKey ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-success">
                        <Check size={10} /> One-click Run
                      </span>
                    ) : (
                      <span className="text-[10px] text-faint">Manual paste only</span>
                    )}
                    {key.projectLabel ? (
                      <span className="text-[10px] text-mid">· {key.projectLabel}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-faint">
              Members · {members.length}
            </p>
            {members.length === 0 ? (
              <p className="text-sm text-mid">No one assigned yet.</p>
            ) : (
              <ul className="divide-y divide-line-subtle rounded-lg border border-line">
                {members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{member.displayName}</p>
                      <p className="truncate font-mono text-[11px] text-mid">{member.email}</p>
                      {member.viaAdminFlag && (
                        <p className="mt-0.5 text-[10px] text-faint">via system_admin flag</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-error hover:bg-error/10"
                      disabled={removeMemberMutation.isPending}
                      onClick={() => removeMemberMutation.mutate(member)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {removeMemberMutation.isError && (
              <div className="mt-2">
                <ApiErrorState error={removeMemberMutation.error} />
              </div>
            )}
          </div>

          {card.canDeleteRole ? (
            <div className="rounded-lg border border-error/30 bg-error/5 px-3 py-3">
              <p className="text-xs font-semibold text-error">Delete role</p>
              <p className="mt-1 text-[11px] text-mid">
                Removes this Role name, every project mapping / key grant, and all user assignments.
              </p>
              {!confirmDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="mt-3"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={13} className="mr-1" />
                  Delete {card.name}
                </Button>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={deleteRoleMutation.isPending}
                    onClick={() => deleteRoleMutation.mutate()}
                  >
                    {deleteRoleMutation.isPending ? <Spinner className="mr-1.5" /> : null}
                    Confirm delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deleteRoleMutation.isPending}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {deleteRoleMutation.isError && (
                <div className="mt-2">
                  <ApiErrorState error={deleteRoleMutation.error} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-faint">
              This card reflects the system_admin flag on users — remove members above to revoke it.
              There is no Role name row to delete.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RolesBoard({
  cards,
  membersByRoleName,
  isLoading,
  isError,
  error,
  onRetry,
  onNewRole,
}: {
  cards: RoleBoardCard[];
  membersByRoleName: Map<string, RoleMember[]>;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onNewRole: () => void;
}) {
  const [managing, setManaging] = useState<RoleBoardCard | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-mid">
        <Spinner /> Loading roles…
      </div>
    );
  }
  if (isError) {
    return <ApiErrorState error={error} onRetry={onRetry} />;
  }
  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
        <p className="text-sm font-medium text-ink">No Roles yet</p>
        <p className="mt-1 text-xs text-mid">Create one to grant mind-share key-ids to people.</p>
        <Button lined size="sm" className="mt-4" onClick={onNewRole}>
          <Plus size={14} className="mr-1" />
          New role
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.name}
            className="relative flex flex-col rounded-xl border border-dashed border-line bg-surface p-5 transition-colors hover:border-accent/40"
          >
            <CornerMark pos="tl" />
            <CornerMark pos="tr" />
            <CornerMark pos="bl" />
            <CornerMark pos="br" />

            <div className="flex items-start justify-between gap-2">
              <h3 className="font-mono text-sm font-semibold text-ink">{card.name}</h3>
              <span className="shrink-0 text-[11px] font-medium text-faint">
                {card.kind === "admin" ? "admin" : card.kind === "granted" ? "granted" : "bare"}
              </span>
            </div>

            <p className="mt-2 text-xs text-mid leading-relaxed">{card.description}</p>

            {card.keys.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {card.keys.map((key) => (
                  <span
                    key={key.prefix}
                    title={[
                      key.prefix,
                      key.hasStoredKey ? "Stored on this cluster — one-click Run" : "Prefix only — manual paste for Run",
                      key.projectLabel ? `Project: ${key.projectLabel}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium",
                      key.hasStoredKey
                        ? "border-accent/40 bg-accent/5 text-accent"
                        : "border-line text-mid",
                    )}
                  >
                    {key.label}
                    {key.hasStoredKey ? <Check size={9} strokeWidth={2.5} /> : null}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
              <p className="text-[11px] text-faint">
                {card.keys.length} key-id{card.keys.length === 1 ? "" : "s"}
                {" · "}
                {card.memberCount} member{card.memberCount === 1 ? "" : "s"}
                {card.mappingCount > 1 ? ` · ${card.mappingCount} projects` : ""}
              </p>
              <button
                type="button"
                onClick={() => setManaging(card)}
                className="text-[11px] font-medium text-accent hover:underline"
              >
                Manage
              </button>
            </div>
          </article>
        ))}
      </div>

      {managing && (
        <RoleManageModal
          card={managing}
          members={membersByRoleName.get(managing.name) ?? []}
          onClose={() => setManaging(null)}
        />
      )}
    </>
  );
}

/** Prefer a stored/known project name; fall back to a short id for display. */
function formatProjectLabel(projectId: string | null | undefined, projectName?: string | null): string {
  if (projectName?.trim()) return projectName.trim();
  if (!projectId) return "—";
  return projectId.length > 12 ? `${projectId.slice(0, 8)}…` : projectId;
}

function projectSelectOptions(
  projects: { id: string; name: string | null }[],
  nameOverrides?: Map<string, string>,
): { value: string; label: string }[] {
  return projects.map((p) => {
    const name = p.name?.trim() || nameOverrides?.get(p.id) || null;
    return {
      value: p.id,
      label: name ? name : formatProjectLabel(p.id),
    };
  });
}

/* ─── Section 1 — "Roles": pure name CRUD, genuinely independent of any
 * project. Backed by schema v36's nullable `edge_roles.project_id` — a name
 * created here persists with zero mappings, it doesn't need Section 2 to
 * "finish" it. ───────────────────────────────────────────────────────────── */

function RolesSection({ names, isLoading, isError, error, onRetry }: {
  names: string[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  const createMutation = useMutation({
    mutationFn: (name: string) => createRoleName(name),
    onSuccess: () => {
      setNewName("");
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteRoleName(name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Roles</CardTitle>
        <CardDescription>Name a Role. Attach a Mind Share Key below.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = newName.trim();
            if (trimmed) createMutation.mutate(trimmed);
          }}
        >
          <Input
            placeholder="Role name, e.g. Support"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
            {createMutation.isPending ? <Spinner className="mr-1.5" /> : <Plus size={14} className="mr-1" />}
            Create
          </Button>
        </form>
        {createMutation.isError && <ApiErrorState error={createMutation.error} />}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-mid">
            <Spinner /> Loading…
          </div>
        )}
        {isError && <ApiErrorState error={error} onRetry={onRetry} />}
        {!isLoading && !isError && names.length === 0 && (
          <p className="text-sm text-mid">No Roles yet.</p>
        )}
        {!isLoading && !isError && names.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {names.map((name) => (
              <div
                key={name}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface-hover py-1 pl-3 pr-1.5 text-sm text-ink"
              >
                {name}
                <button
                  type="button"
                  title={`Delete "${name}"`}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(name)}
                  className="rounded-full p-1 text-mid hover:bg-error/10 hover:text-error disabled:opacity-50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {deleteMutation.isError && <div className="pt-2"><ApiErrorState error={deleteMutation.error} /></div>}
      </CardContent>
    </Card>
  );
}

/* ─── Section 2 — pick a Role, paste Mind Share Key(s), confirm project id.
 * createRole needs a project_id on the wire.  We get it two ways:
 *   1. Full key known locally → resolve-share-key returns the project UUID;
 *      we auto-fill + lock the project id field (no drift possible).
 *   2. Studio key not mirrored on this cluster → field stays empty; admin
 *      pastes the UUID from AI Studio > Project Settings.
 * We deliberately do NOT offer a dropdown of cluster-known projects — that
 * list only contains what this cluster happens to have, which may be wrong
 * or empty for keys issued in a different Studio project. ─────────────── */

function MapToMindShareKeysSection({ names }: { names: string[] }) {
  const queryClient = useQueryClient();

  const [roleName, setRoleName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [keyPrefixes, setKeyPrefixes] = useState("");
  /** Set when resolve-share-key finds the key locally; field is then read-only. */
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const typedPrefixes = useMemo(
    () => keyPrefixes.split(",").map((s) => s.trim()).filter(Boolean),
    [keyPrefixes],
  );
  const enteredPrefixes = useMemo(() => typedPrefixes.map((p) => p.slice(0, 12)), [typedPrefixes]);
  const rawKeysByPrefix = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of typedPrefixes) {
      if (p.length > 12) map[p.slice(0, 12)] = p;
    }
    return map;
  }, [typedPrefixes]);

  /* When the pasted key changes, try to resolve its project from this cluster.
   * Found → auto-fill + lock the project id field (no accidental drift).
   * Not found → clear any prior auto-fill; admin types/pastes the UUID. */
  useEffect(() => {
    const pasted = typedPrefixes[0];
    if (!pasted) {
      setResolvedProjectId(null);
      // Don't clear projectId — let the admin keep what they typed.
      return;
    }
    let cancelled = false;
    setResolving(true);
    void resolveShareKey(pasted)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved.found && resolved.projectId) {
          setResolvedProjectId(resolved.projectId);
          setProjectId(resolved.projectId);
        } else {
          setResolvedProjectId(null);
          // Do NOT touch projectId — admin may have already typed it.
        }
      })
      .catch(() => {
        if (!cancelled) setResolvedProjectId(null);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [typedPrefixes]);

  const projectLocked = Boolean(resolvedProjectId);

  const mapMutation = useMutation({
    mutationFn: async () => {
      const pid = projectId.trim();
      if (!pid) throw new Error("Paste the Project ID from AI Studio → Project Settings.");
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(pid)) {
        throw new Error("Project ID should be a UUID (e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Copy it from AI Studio → Project Settings.");
      }
      return createRole(roleName, pid, enteredPrefixes, { rawKeys: rawKeysByPrefix });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      setKeyPrefixes("");
      setProjectId("");
      setResolvedProjectId(null);
    },
  });

  const canMap =
    Boolean(roleName) && Boolean(projectId.trim()) && enteredPrefixes.length > 0 && !mapMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Map to Mind Share Key</CardTitle>
        <CardDescription>
          Pick the Role, paste the Mind Share Key, then confirm the Project ID from AI Studio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {names.length === 0 ? (
          <p className="text-sm text-mid">Create a Role above first.</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (canMap) mapMutation.mutate();
            }}
          >
            {/* Fields wrap as the card narrows — never overflow the card edge. */}
            <div className="flex flex-wrap items-end gap-3">
              {/* Role */}
              <div className="min-w-[9rem] flex-1 basis-[9rem]">
                <label className="mb-1.5 block text-xs font-medium text-mid">Role</label>
                <Select
                  value={roleName}
                  onChange={setRoleName}
                  options={names.map((n) => ({ value: n, label: n }))}
                  placeholder="Pick a Role"
                  ariaLabel="Role to assign"
                  className="w-full"
                  triggerClassName="w-full justify-between h-9"
                />
              </div>

              {/* Mind Share Key */}
              <div className="min-w-[12rem] flex-[1.6] basis-[12rem]">
                <label className="mb-1.5 block text-xs font-medium text-mid">Mind Share Key(s)</label>
                <Input
                  placeholder="Paste full key(s) — comma-separated"
                  value={keyPrefixes}
                  onChange={(e) => setKeyPrefixes(e.target.value)}
                />
              </div>

              {/* Project ID */}
              <div className="min-w-[12rem] flex-[1.6] basis-[12rem]">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-mid">
                  Project ID
                  {resolving && (
                    <span className="text-[10px] font-normal text-light">resolving…</span>
                  )}
                  {projectLocked && !resolving && (
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800">
                      auto‑detected ✓
                    </span>
                  )}
                </label>
                <Input
                  placeholder="Paste from AI Studio → Project Settings"
                  value={projectId}
                  onChange={(e) => {
                    if (!projectLocked) setProjectId(e.target.value);
                  }}
                  readOnly={projectLocked}
                  className={projectLocked ? "cursor-default select-all bg-muted/50 font-mono text-xs text-muted-foreground" : ""}
                />
              </div>

              {/* Save — stays visible; wraps onto its own row when space is tight */}
              <Button type="submit" className="h-9 shrink-0 grow sm:grow-0" disabled={!canMap}>
                {mapMutation.isPending ? <Spinner className="mr-1.5" /> : <Plus size={14} className="mr-1" />}
                Save
              </Button>
            </div>

            {/* Context hint beneath the Project ID field */}
            {projectLocked ? (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                ✓ Project resolved from this key’s record on this cluster — field locked.
              </p>
            ) : typedPrefixes.length > 0 && !resolving ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                ⚠️ Key not in this cluster’s registry. Copy the Project UUID from{" "}
                <span className="font-semibold">AI Studio → Project Settings → Project ID</span>.
              </p>
            ) : (
              <p className="text-[11px] text-light">
                Project ID is optional when the key is registered on this cluster — it will be auto‑detected.
                Otherwise, copy it from AI Studio → Project Settings.
              </p>
            )}
          </form>
        )}
        {mapMutation.isError && <div className="mt-2"><ApiErrorState error={mapMutation.error} /></div>}
      </CardContent>
    </Card>
  );
}

function AllRolesTable({ mappings, unmappedNames }: { mappings: EngineRole[]; unmappedNames: string[] }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editKeyPrefixes, setEditKeyPrefixes] = useState("");

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      roleId,
      name,
      projectId,
      keyPrefixes,
    }: {
      roleId: string;
      name: string;
      projectId: string;
      keyPrefixes: string[];
    }) => updateRole(roleId, name, projectId, keyPrefixes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      setEditingId(null);
    },
  });

  function startEdit(role: EngineRole) {
    const prefixes =
      (role.keys ?? []).map((k) => k.prefix).length > 0
        ? (role.keys ?? []).map((k) => k.prefix)
        : (role.keyPrefixes ?? []);
    setEditingId(role.id);
    setEditName(role.name);
    setEditProjectId(role.projectId ?? "");
    setEditKeyPrefixes(prefixes.join(", "));
    updateMutation.reset();
  }

  function saveEdit() {
    if (!editingId) return;
    const name = editName.trim();
    const projectId = editProjectId.trim();
    const keyPrefixes = editKeyPrefixes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => p.slice(0, 12));
    if (!name || !projectId) return;
    updateMutation.mutate({ roleId: editingId, name, projectId, keyPrefixes });
  }

  if (mappings.length === 0 && unmappedNames.length === 0) {
    return <p className="py-8 text-center text-sm text-mid">No Roles yet.</p>;
  }

  return (
    <div>
      {mappings.length > 0 && (
        <Table>
          <THead>
            <tr>
              <TH>Role</TH>
              <TH>Project</TH>
              <TH>Mind Share Key</TH>
              <TH>Run access</TH>
              <TH></TH>
            </tr>
          </THead>
          <TBody>
            {mappings.map((role) => {
              const keys = (role.keys ?? []).length > 0
                ? role.keys!
                : (role.keyPrefixes ?? []).map((prefix) => ({ prefix, name: undefined, hasStoredKey: false }));
              const anyStored = keys.some((k) => k.hasStoredKey);
              const isEditing = editingId === role.id;

              if (isEditing) {
                return (
                  <TR key={role.id}>
                    <TD colSpan={5} className="!py-3">
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const projectId = editProjectId.trim();
                          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                          if (!editName.trim() || !projectId || !uuidPattern.test(projectId)) return;
                          saveEdit();
                        }}
                      >
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="min-w-[8rem] flex-1 basis-[8rem]">
                            <label className="mb-1.5 block text-xs font-medium text-mid">Role</label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                          </div>
                          <div className="min-w-[12rem] flex-[1.4] basis-[12rem]">
                            <label className="mb-1.5 block text-xs font-medium text-mid">Project ID</label>
                            <Input
                              className="font-mono text-xs"
                              value={editProjectId}
                              onChange={(e) => setEditProjectId(e.target.value)}
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            />
                          </div>
                          <div className="min-w-[12rem] flex-[1.6] basis-[12rem]">
                            <label className="mb-1.5 block text-xs font-medium text-mid">
                              Key prefixes (comma-separated)
                            </label>
                            <Input
                              className="font-mono text-xs"
                              value={editKeyPrefixes}
                              onChange={(e) => setEditKeyPrefixes(e.target.value)}
                              placeholder="ask_abcd1234, …"
                            />
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <Button type="submit" size="sm" disabled={updateMutation.isPending || !editName.trim() || !editProjectId.trim()}>
                              {updateMutation.isPending ? <Spinner className="mr-1" /> : null}
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(null)}
                              disabled={updateMutation.isPending}
                            >
                              <X size={13} className="mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                        <p className="text-[11px] text-faint">
                          Updates name, project, and key prefixes. To store a new full raw key for one-click Run, re-map via section 2 above.
                        </p>
                        {updateMutation.isError && <ApiErrorState error={updateMutation.error} />}
                      </form>
                    </TD>
                  </TR>
                );
              }

              return (
                <TR key={role.id}>
                  <TD className="font-medium">{role.name}</TD>
                  <TD className="text-xs text-mid">{formatProjectLabel(role.projectId, role.projectName)}</TD>
                  <TD>
                    {keys.length === 0 ? (
                      <span className="text-xs text-mid">no key yet</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {keys.map((k) => (
                          <Badge key={k.prefix} tone="neutral" className="font-mono" title={k.hasStoredKey ? "Stored on this cluster" : undefined}>
                            {k.prefix}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TD>
                  <TD>
                    {keys.length === 0 ? (
                      <span className="text-xs text-mid">—</span>
                    ) : anyStored ? (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <Check size={12} /> One-click Run
                      </span>
                    ) : (
                      <span className="text-xs text-mid">Manual key paste only</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        title="Edit this mapping"
                        disabled={deleteMutation.isPending || updateMutation.isPending}
                        onClick={() => startEdit(role)}
                        className="rounded p-1 text-mid hover:bg-accent/10 hover:text-accent disabled:opacity-50"
                      >
                        <Pencil size={13} />
                      </button>
                    <button
                      type="button"
                      title="Remove this mapping"
                        disabled={deleteMutation.isPending || updateMutation.isPending}
                      onClick={() => deleteMutation.mutate(role.id)}
                      className="rounded p-1 text-mid hover:bg-error/10 hover:text-error disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      {unmappedNames.length > 0 && (
        <div className={`flex flex-wrap items-center gap-2 px-4 py-3 text-xs text-mid ${mappings.length > 0 ? "border-t border-line" : ""}`}>
          <span>Not mapped to a key yet:</span>
          {unmappedNames.map((n) => (
            <Badge key={n} tone="neutral">{n}</Badge>
          ))}
        </div>
      )}

      {deleteMutation.isError && <div className="p-4"><ApiErrorState error={deleteMutation.error} /></div>}
    </div>
  );
}

/* ─── "Clean up a stale project" — the one capability the old standalone
 * Projects page had that nothing else replaces: soft-delete every Mind this
 * cluster has for a project that no longer exists (or is no longer edge-
 * cluster-mapped) in AI Studio. Moved here rather than kept as its own page. ─ */

function CleanupStaleProjectSection() {
  const queryClient = useQueryClient();
  const projectsQuery = useQuery({ queryKey: ["knownProjects"], queryFn: ({ signal }) => listKnownProjects(signal) });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: ({ signal }) => listAllRoles(signal) });
  const [projectId, setProjectId] = useState("");
  const [confirming, setConfirming] = useState(false);

  const namesByProjectId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projectsQuery.data ?? []) {
      if (p.name?.trim()) map.set(p.id, p.name.trim());
    }
    for (const role of rolesQuery.data ?? []) {
      if (role.projectId && role.projectName?.trim() && !map.has(role.projectId)) {
        map.set(role.projectId, role.projectName.trim());
      }
    }
    return map;
  }, [projectsQuery.data, rolesQuery.data]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProjectMinds(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knownProjects"] });
      setProjectId("");
      setConfirming(false);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-error">Clean up a stale project</CardTitle>
        <CardDescription>Removes every Mind for a project no longer mapped to this cluster.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <Select
            value={projectId}
            onChange={(id) => {
              setProjectId(id);
              setConfirming(false);
            }}
            options={projectSelectOptions(projectsQuery.data ?? [], namesByProjectId)}
            placeholder={projectsQuery.isLoading ? "Loading…" : "Pick a project"}
            ariaLabel="Project to clean up"
            className="w-full max-w-sm"
            triggerClassName="w-full justify-between h-9 text-xs"
          />
          {!confirming ? (
            <Button variant="ghost" className="text-error hover:bg-error/10" disabled={!projectId} onClick={() => setConfirming(true)}>
              <Trash2 size={14} className="mr-1" />
              Delete its Minds
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                className="text-error hover:bg-error/10"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(projectId)}
              >
                {deleteMutation.isPending ? <Spinner className="mr-1.5" /> : null}
                Confirm
              </Button>
              <Button variant="ghost" disabled={deleteMutation.isPending} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          )}
        </div>
        {deleteMutation.isSuccess && (
          <p className="mt-2 text-xs text-success">Deleted {deleteMutation.data.deletedMindCount} Mind(s).</p>
        )}
        {deleteMutation.isError && <div className="mt-2"><ApiErrorState error={deleteMutation.error} /></div>}
      </CardContent>
    </Card>
  );
}

export function RolesPage() {
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: ({ signal }) => listAllRoles(signal) });
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: ({ signal }) => listUsers(signal) });
  const [showNewRole, setShowNewRole] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const users = usersQuery.data ?? [];
  const roleQueries = useQueries({
    queries: users.map((u) => ({
      queryKey: ["userRoles", u.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => listUserRoles(u.id, signal),
      enabled: users.length > 0,
    })),
  });

  const membersByRoleName = useMemo(
    () => buildMembersByRoleName(users, roleQueries),
    [users, roleQueries],
  );

  const memberCountByRoleName = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [name, members] of membersByRoleName) {
      counts.set(name, members.length);
    }
    return counts;
  }, [membersByRoleName]);

  const adminMemberCount = useMemo(
    () => users.filter((u) => u.isAdmin).length,
    [users],
  );

  const names = useMemo(
    () => [...new Set((rolesQuery.data ?? []).map((r) => r.name))].sort((a, b) => a.localeCompare(b)),
    [rolesQuery.data],
  );

  const mappings = useMemo(
    () => (rolesQuery.data ?? []).filter((r) => r.projectId),
    [rolesQuery.data],
  );
  const mappedNames = useMemo(() => new Set(mappings.map((r) => r.name)), [mappings]);
  const unmappedNames = useMemo(() => names.filter((n) => !mappedNames.has(n)), [names, mappedNames]);

  const boardCards = useMemo(
    () => buildRoleBoard(rolesQuery.data ?? [], memberCountByRoleName, adminMemberCount),
    [rolesQuery.data, memberCountByRoleName, adminMemberCount],
  );

  return (
    <AdminSectionLayout>
      <AdminPageHeader
        title="Roles"
        description="A Role bundles mind-share key-ids — keys you register by pasting a Mind Share Key from any ai/Studio workspace / project. Roles never reference Projects; edge SSO users map onto Roles here."
        action={
          <Button lined size="sm" onClick={() => setShowNewRole(true)}>
            <Plus size={14} className="mr-1" />
            New role
          </Button>
        }
      />

      <NewRoleModal
        open={showNewRole}
        onClose={() => setShowNewRole(false)}
        existingRoles={rolesQuery.data ?? []}
      />

      <div className="rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-xs text-mid leading-relaxed">
        <span className="font-semibold text-accent">Trust boundary:</span> a pasted key is stored
        encrypted, server-side, and never displayed again — people only ever see the key-id.
        ai/Studio never learns who your employees are.
      </div>

      <RolesBoard
        cards={boardCards}
        membersByRoleName={membersByRoleName}
        isLoading={rolesQuery.isLoading}
        isError={rolesQuery.isError}
        error={rolesQuery.error}
        onRetry={() => void rolesQuery.refetch()}
        onNewRole={() => setShowNewRole(true)}
      />

      <div className="border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs font-medium text-mid hover:text-ink"
        >
          {showAdvanced ? "Hide advanced tools" : "Show advanced tools"} — rename mappings, paste keys
          inline, clean up stale projects
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RolesSection
          names={names}
          isLoading={rolesQuery.isLoading}
          isError={rolesQuery.isError}
          error={rolesQuery.error}
          onRetry={() => rolesQuery.refetch()}
        />
        <MapToMindShareKeysSection names={names} />
      </div>

      <Card>
        <CardHeader>
                <CardTitle>All Role mappings</CardTitle>
                <CardDescription>
                  Edit or delete individual project mappings. Prefer New role for create + assign.
                </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
                {rolesQuery.isSuccess && (
                  <AllRolesTable mappings={mappings} unmappedNames={unmappedNames} />
                )}
        </CardContent>
      </Card>

      <CleanupStaleProjectSection />
    </div>
        )}
      </div>
    </AdminSectionLayout>
  );
}
