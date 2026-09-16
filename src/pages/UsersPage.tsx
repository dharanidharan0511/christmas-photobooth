import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { UserPlus, X } from "lucide-react";
import { assignRole, createUser, listAllRoles, listUserRoles, listUsers, setUserPassword } from "../lib/engineClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/Table";
import { Badge, statusTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Spinner } from "../components/ui/Spinner";
import { ApiErrorState } from "../components/ui/ApiErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { cn, formatRoleOptionLabel, rolesFromCatalog } from "../lib/utils";
import { AdminPageHeader, AdminSectionLayout } from "../components/layout/AdminSectionLayout";

type AuthMode = "sso" | "password";
const SYSTEM_ADMIN_CHIP = "__system_admin__";

/* ─── "+ Add user" modal — pre-provision by email; optional Role / system_admin.
 * SSO is the primary path; local password is an optional fallback set after create. */

function AddUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: ({ signal }) => listAllRoles(signal),
    enabled: open,
  });

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("sso");
  const [password, setPassword] = useState("");
  const [selectedChip, setSelectedChip] = useState<string>("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const isAdmin = selectedChip === SYSTEM_ADMIN_CHIP;
      const roleId = !isAdmin && selectedChip ? selectedChip : undefined;
      const user = await createUser(
        email.trim(),
        displayName.trim() || undefined,
        roleId,
        isAdmin || undefined,
      );
      if (authMode === "password" && password.length >= 8) {
        await setUserPassword(user.id, password);
      }
      return user;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !createMutation.isPending) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, createMutation.isPending]);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setDisplayName("");
      setAuthMode("sso");
      setPassword("");
      setSelectedChip("");
    }
  }, [open]);

  const catalogRoles = rolesFromCatalog(rolesQuery.data ?? []);
  const passwordOk = authMode === "sso" || password.length >= 8;
  const canCreate = Boolean(email.trim()) && passwordOk && !createMutation.isPending;

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !createMutation.isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-title"
        className="relative w-full max-w-lg rounded-xl border border-line bg-surface shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="add-user-title" className="text-base font-semibold text-ink">
              Add user
            </h2>
            <p className="mt-1 text-xs text-mid leading-relaxed">
              Pre-provision an identity. On first SSO sign-in it links automatically; local password
              is a fallback only.
            </p>
          </div>
          <button
            type="button"
            title="Close"
            disabled={createMutation.isPending}
            onClick={onClose}
            className="rounded-md p-1 text-mid hover:bg-surface-hover hover:text-ink disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canCreate) createMutation.mutate();
          }}
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-mid">Email</label>
            <Input
              type="email"
              autoFocus
              placeholder="person@client.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-mid">Display name</label>
            <Input
              placeholder="Optional — filled from SSO on first login"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-mid">Authentication</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "sso" as const, label: "SSO (SAML)" },
                  { id: "password" as const, label: "Local password" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAuthMode(option.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    authMode === option.id
                      ? "border-accent bg-accent/8 text-accent"
                      : "border-line text-mid hover:border-line-strong hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {authMode === "password" && (
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-medium text-mid">
                  Password (min 8 characters)
                </label>
                <Input
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-mid">Initial role</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedChip((prev) => (prev === SYSTEM_ADMIN_CHIP ? "" : SYSTEM_ADMIN_CHIP))
                }
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  selectedChip === SYSTEM_ADMIN_CHIP
                    ? "border-accent bg-accent/8 text-accent"
                    : "border-line text-mid hover:border-line-strong hover:text-ink",
                )}
              >
                system_admin
              </button>
              {rolesQuery.isLoading && (
                <span className="inline-flex items-center gap-1 text-xs text-mid">
                  <Spinner /> Loading roles…
                </span>
              )}
              {catalogRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedChip((prev) => (prev === role.id ? "" : role.id))}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedChip === role.id
                      ? "border-accent bg-accent/8 text-accent"
                      : "border-line text-mid hover:border-line-strong hover:text-ink",
                  )}
                >
                  {formatRoleOptionLabel(role)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-faint">Optional — leave unset to invite with no Role.</p>
          </div>

          {createMutation.isError && <ApiErrorState error={createMutation.error} />}

          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canCreate}>
              {createMutation.isPending ? <Spinner className="mr-1.5" /> : null}
              {authMode === "password" ? "Create user" : "Send invite"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Inline per-row Role assignment so the common case never requires
 * navigating to a user's detail page. Role ↔ Mind Share Key mapping lives
 * on the Roles page, not on AI Studio's Mind Share Keys tab. ──────────── */

function InlineRoleAssign({ userId, assignedRoleIds }: { userId: string; assignedRoleIds: Set<string> }) {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: ({ signal }) => listAllRoles(signal) });
  // Same unique names as Roles §1 — not every project-mapping row.
  const assignedNames = new Set(
    (rolesQuery.data ?? []).filter((r) => assignedRoleIds.has(r.id)).map((r) => r.name.trim()),
  );
  const unassigned = rolesFromCatalog(rolesQuery.data ?? []).filter((r) => !assignedNames.has(r.name.trim()));

  const assign = useMutation({
    mutationFn: (roleId: string) => assignRole(userId, roleId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["userRoles", userId] }),
  });

  if (unassigned.length === 0) return null;

  return (
    <Select
      value=""
      onChange={(id) => id && assign.mutate(id)}
      // A Role name can map to multiple projects (each its own edge_roles
      // row) — label with the project name (or id, when no name is cached
      // yet) so e.g. two "developer" mappings for different projects are
      // distinguishable, not silently duplicate options.
      options={unassigned.map((r) => ({
        value: r.id,
        label: formatRoleOptionLabel(r),
      }))}
      disabled={assign.isPending}
      placeholder="+ Assign"
      ariaLabel="Assign a Role to this user"
      triggerClassName="h-auto rounded-full border-none bg-transparent px-2 py-0.5 text-xs text-mid hover:bg-surface-hover"
    />
  );
}

export function UsersPage() {
  const navigate = useNavigate();
  const [showAddUser, setShowAddUser] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: ({ signal }) => listUsers(signal),
  });

  const users = usersQuery.data ?? [];

  // One roles fetch per visible user, batched with useQueries rather than
  // fired sequentially. Fine for a demo-sized user list; if this ever needs
  // to scale, the fix is server-side batch role lookup, not client paging.
  const roleQueries = useQueries({
    queries: users.map((u) => ({
      queryKey: ["userRoles", u.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => listUserRoles(u.id, signal),
      enabled: users.length > 0,
    })),
  });

  return (
    <AdminSectionLayout>
      <AdminPageHeader
        title="Users"
        description="Every person known to this edge engine, and their Role assignments. Identities arrive via SSO; nothing leaves the cluster."
        action={
          <Button lined size="sm" onClick={() => setShowAddUser(true)}>
            <UserPlus size={14} className="mr-1" />
            Add user
          </Button>
        }
      />

      <AddUserModal open={showAddUser} onClose={() => setShowAddUser(false)} />

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Click a row to view a user&apos;s full detail page — password, delete/reactivate,
            sessions. Assign a Role inline below.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {usersQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-mid">
              <Spinner /> Loading users…
            </div>
          )}

          {usersQuery.isError && <ApiErrorState error={usersQuery.error} onRetry={() => usersQuery.refetch()} />}

          {usersQuery.isSuccess && users.length === 0 && (
            <EmptyState title="No users" description="Use “Add User” above, or wait for someone to sign in via SSO." />
          )}

          {usersQuery.isSuccess && users.length > 0 && (
            <Table>
              <THead>
                <tr>
                  <TH>Email</TH>
                  <TH>Display name</TH>
                  <TH>Status</TH>
                  <TH>Roles</TH>
                </tr>
              </THead>
              <TBody>
                {users.map((user, i) => {
                  const rq = roleQueries[i];
                  const assignedIds = new Set((rq?.data ?? []).map((r) => r.id));
                  return (
                    <TR key={user.id} clickable onClick={() => navigate(`/users/${user.id}`)}>
                      <TD className="font-medium">{user.email}</TD>
                      <TD>{user.displayName || <span className="text-mid">—</span>}</TD>
                      <TD>
                        <Badge tone={statusTone(user.status)}>{user.status}</Badge>
                      </TD>
                      <TD>
                        <div
                          className="flex flex-wrap items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {user.isAdmin && (
                            <Badge
                              tone="admin"
                              title={
                                user.adminSource === "env"
                                  ? "Listed in USER_MODULE_ADMIN_EMAILS"
                                  : "Granted by a system_admin"
                              }
                            >
                              system_admin
                            </Badge>
                          )}
                          {rq?.isLoading && <Spinner />}
                          {rq?.isError && <span className="text-xs text-error">failed to load</span>}
                          {rq?.isSuccess &&
                            rq.data.map((role) => (
                              <Badge key={role.id} tone="info">
                                {role.name}
                              </Badge>
                            ))}
                          {!user.isAdmin && rq?.isSuccess && (
                            <InlineRoleAssign userId={user.id} assignedRoleIds={assignedIds} />
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminSectionLayout>
  );
}
