import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, X } from "lucide-react";
import { assignRole, deleteUser, getUserSpendCap, listAllRoles, listMySessions, listUserRoles, listUsers, reactivateUser, removeRole, setUserPassword, setUserSpendCap, setUserSystemAdmin } from "../lib/engineClient";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Badge, statusTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Spinner } from "../components/ui/Spinner";
import { ApiErrorState } from "../components/ui/ApiErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { formatRoleOptionLabel, rolesFromCatalog } from "../lib/utils";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/Table";
import type { EngineRole } from "../types/engine";
import { AdminSectionLayout } from "../components/layout/AdminSectionLayout";

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [roleIdInput, setRoleIdInput] = useState("");
  const allRolesQuery = useQuery({ queryKey: ["roles"], queryFn: ({ signal }) => listAllRoles(signal) });
  // Same unique names as the Roles page — not every project-mapping row.
  const catalogRoles = rolesFromCatalog(allRolesQuery.data ?? []);

  const isSelf = auth.mode === "cookie" && Boolean(auth.whoami) && auth.whoami!.uid === id;
  const isAdmin = auth.mode === "key" || Boolean(auth.whoami?.isAdmin);

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: ({ signal }) => listUsers(signal) });
  const user = usersQuery.data?.find((u) => u.id === id);

  const rolesQuery = useQuery({
    queryKey: ["userRoles", id],
    queryFn: ({ signal }) => listUserRoles(id!, signal),
    enabled: Boolean(id) && !isSelf,
  });

  const selfRoles: EngineRole[] = isSelf
    ? auth.whoami!.roles.map((name) => ({ id: name, name }))
    : [];

  const roles = isSelf ? selfRoles : rolesQuery.data ?? [];

  const invalidateRoles = () => {
    void queryClient.invalidateQueries({ queryKey: ["userRoles", id] });
    void queryClient.invalidateQueries({ queryKey: ["whoami"] });
  };

  const assignMutation = useMutation({
    mutationFn: (roleId: string) => assignRole(id!, roleId),
    onSuccess: () => {
      setRoleIdInput("");
      invalidateRoles();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (roleId: string) => removeRole(id!, roleId),
    onSuccess: invalidateRoles,
  });

  const [newPassword, setNewPassword] = useState("");
  const setPasswordMutation = useMutation({
    mutationFn: (password: string | null) => setUserPassword(id!, password),
    onSuccess: () => setNewPassword(""),
  });

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      navigate("/users", { replace: true });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateUser(id!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const systemAdminMutation = useMutation({
    mutationFn: (next: boolean) => setUserSystemAdmin(id!, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["whoami"] });
    },
  });

  if (!id) {
    return <EmptyState title="No user id in URL" />;
  }

  return (
    <AdminSectionLayout>
    <div className="space-y-6">
      <div>
        <Link to="/users" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80">
          <ArrowLeft size={14} /> Users
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {user?.displayName || user?.email || <span className="font-mono text-mid text-2xl">{id}</span>}
        </h1>
        {user ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-mid">
            <span className="font-mono text-xs">{user.email}</span>
            <Badge tone={statusTone(user.status)}>{user.status}</Badge>
            {user.isAdmin && (
              <Badge tone="admin" title={user.adminSource === "env" ? "Listed in USER_MODULE_ADMIN_EMAILS" : "Granted by a system_admin"}>
                system_admin
              </Badge>
            )}
            {isSelf && <Badge tone="admin">this is you</Badge>}
          </div>
        ) : (
          !usersQuery.isLoading && (
            <p className="mt-1 text-xs text-mid">
              Not found in the current users list — you may have navigated here directly. Role management still
              works against this id.
            </p>
          )
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Access</CardTitle>
          <CardDescription>
            {isSelf
              ? "Roles from your own signed-in session — which projects they map to and what keys they grant."
              : "Every Role this person holds, which project each maps to, and the keys it grants there."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSelf && rolesQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-mid">
              <Spinner /> Loading roles…
            </div>
          )}
          {!isSelf && rolesQuery.isError && (
            <ApiErrorState error={rolesQuery.error} onRetry={() => rolesQuery.refetch()} />
          )}

          {(isSelf || rolesQuery.isSuccess) && (
            <>
              {roles.length === 0 ? (
                <p className="text-sm text-mid">No roles assigned — no project access.</p>
              ) : (
                <div className="space-y-2">
                  {roles.map((role) => {
                    // Cross-reference against the full catalog (which has
                    // projectId/keyPrefixes) — `listUserRoles`/whoami only
                    // ever return id+name. For isSelf, whoami's "id" is
                    // actually the role NAME (no real per-mapping id is
                    // exposed there), so match by name and show every
                    // mapping that name has; for admin view, match by the
                    // real role id (exactly one mapping).
                    const catalogMatches = isSelf
                      ? (allRolesQuery.data ?? []).filter((r) => r.name === role.name)
                      : (allRolesQuery.data ?? []).filter((r) => r.id === role.id);
                    const rows = catalogMatches.length > 0 ? catalogMatches : [role];
                    return rows.map((r) => (
                      <div
                        key={`${role.id}-${r.projectId ?? "?"}`}
                        className="flex items-center gap-3 rounded-md border border-line bg-surface-hover px-3 py-2"
                      >
                        <span className="shrink-0 text-xs font-medium text-ink">{role.name}</span>
                        {r.projectName ? (
                          <span className="text-xs text-mid">
                            {r.projectName} <span className="font-mono text-[11px] text-mid/70">({r.projectId})</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-mid">{r.projectId ?? "—"}</span>
                        )}
                        <div className="flex flex-1 flex-wrap gap-1">
                          {(r.keys ?? []).length === 0 && (r.keyPrefixes ?? []).length === 0 ? (
                            <span className="text-xs text-mid">no keys</span>
                          ) : (r.keys ?? []).length > 0 ? (
                            r.keys!.map((k) => (
                              <Badge key={k.prefix} tone="info" title={k.prefix}>
                                {k.name ?? <span className="font-mono">{k.prefix}</span>}
                              </Badge>
                            ))
                          ) : (
                            r.keyPrefixes!.map((kp) => (
                              <Badge key={kp} tone="info" className="font-mono">
                                {kp}
                              </Badge>
                            ))
                          )}
                        </div>
                        {!isSelf && (
                          <button
                            type="button"
                            title={`Remove ${role.name}`}
                            disabled={removeMutation.isPending}
                            onClick={() => removeMutation.mutate(role.id)}
                            className="shrink-0 rounded p-1 text-mid hover:bg-error/10 hover:text-error disabled:opacity-50"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ));
                  })}
                </div>
              )}

              {removeMutation.isError && <ApiErrorState error={removeMutation.error} />}

              {!isSelf && (
                <form
                  className="flex items-end gap-2 border-t border-line pt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (roleIdInput.trim()) assignMutation.mutate(roleIdInput.trim());
                  }}
                >
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-mid">Add a Role mapping</label>
                    {/* Same unique Role names as Roles §1, not the mapping table. */}
                    <Select
                      value={roleIdInput}
                      onChange={setRoleIdInput}
                      options={catalogRoles.map((r) => ({
                        value: r.id,
                        label: formatRoleOptionLabel(r),
                      }))}
                      disabled={!allRolesQuery.isSuccess || catalogRoles.length === 0}
                      placeholder={
                        !allRolesQuery.isSuccess
                          ? "Loading…"
                          : catalogRoles.length === 0
                            ? "No Roles yet — create one on the Roles page"
                            : "Select a Role…"
                      }
                      ariaLabel="Role to assign"
                      className="w-full"
                      triggerClassName="w-full justify-between h-9"
                    />
                  </div>
                  <Button type="submit" disabled={!roleIdInput.trim() || assignMutation.isPending}>
                    {assignMutation.isPending ? <Spinner className="mr-1.5" /> : null}
                    Assign
                  </Button>
                </form>
              )}
              {assignMutation.isError && <ApiErrorState error={assignMutation.error} />}
            </>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Password login and access control for this person.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-mid">System admin</h3>
              <p className="mb-3 text-xs text-mid">
                Grants the same rights as the engine env allow-list: user/role management, credits, and
                Role-free access to every mind. Not a catalog Role — this is a flag on the person.
              </p>
              {user?.adminSource === "env" ? (
                <p className="text-xs text-mid">
                  This email is listed in <span className="font-mono">USER_MODULE_ADMIN_EMAILS</span> and
                  cannot be revoked here. Remove it from the engine env and restart.
                </p>
              ) : user?.isAdmin ? (
                <Button
                  variant="secondary"
                  disabled={systemAdminMutation.isPending}
                  onClick={() => systemAdminMutation.mutate(false)}
                >
                  {systemAdminMutation.isPending ? <Spinner className="mr-1.5" /> : null}
                  Revoke system_admin
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={systemAdminMutation.isPending || !user}
                  onClick={() => systemAdminMutation.mutate(true)}
                >
                  {systemAdminMutation.isPending ? <Spinner className="mr-1.5" /> : null}
                  Grant system_admin
                </Button>
              )}
              {systemAdminMutation.isError && (
                <div className="mt-2">
                  <ApiErrorState error={systemAdminMutation.error} />
                </div>
              )}
            </div>

            <div className="border-t border-line pt-5">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-mid">Password</h3>
              <p className="mb-3 text-xs text-mid">
                An additional login method alongside SSO, not a replacement. Setting a new one also clears
                any existing lockout.
              </p>
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newPassword.length >= 8 && !setPasswordMutation.isPending) {
                    setPasswordMutation.mutate(newPassword);
                  }
                }}
              >
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-mid">New password (min 8 characters)</label>
                  <Input
                    type="password"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={newPassword.length < 8 || setPasswordMutation.isPending}>
                  {setPasswordMutation.isPending ? <Spinner className="mr-1.5" /> : null}
                  Set
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={setPasswordMutation.isPending}
                  onClick={() => setPasswordMutation.mutate(null)}
                >
                  Clear
                </Button>
              </form>
              {setPasswordMutation.isSuccess && (
                <p className="mt-2 text-xs text-success">
                  {setPasswordMutation.variables ? "Password set." : "Password cleared — SSO-only now."}
                </p>
              )}
              {setPasswordMutation.isError && <ApiErrorState error={setPasswordMutation.error} />}
            </div>

            {!isSelf && (
              <div className="border-t border-line pt-5">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-error">Danger zone</h3>
                {user?.status === "disabled" ? (
                  <>
                    <p className="mb-3 text-xs text-mid">
                      This person is disabled — signed out, and can't sign back in. Their Role assignments were
                      kept, so reactivating restores full access immediately with no re-setup.
                    </p>
                    <Button
                      variant="secondary"
                      disabled={reactivateMutation.isPending}
                      onClick={() => reactivateMutation.mutate()}
                    >
                      {reactivateMutation.isPending ? <Spinner className="mr-1.5" /> : null}
                      Reactivate
                    </Button>
                    {reactivateMutation.isError && <div className="mt-2"><ApiErrorState error={reactivateMutation.error} /></div>}
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-xs text-mid">
                      Soft delete — disables sign-in and revokes any active session immediately. Their Role
                      assignments and history are kept, so this can be undone with "Reactivate" at any time.
                    </p>
                    {!confirmingDelete ? (
                      <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                        Delete User
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-ink">Delete {user?.email ?? "this user"} — are you sure?</span>
                        <Button
                          variant="danger"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate()}
                        >
                          {deleteMutation.isPending ? <Spinner className="mr-1.5" /> : null}
                          Confirm Delete
                        </Button>
                        <Button variant="ghost" disabled={deleteMutation.isPending} onClick={() => setConfirmingDelete(false)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                    {deleteMutation.isError && <div className="mt-2"><ApiErrorState error={deleteMutation.error} /></div>}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && id && <SpendCapCard userId={id} />}

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>
            {isSelf
              ? "Runs made with your own signed-in identity, most recent first."
              : "See this person's own sessions on Run Mind's Fleet Sessions view (admin-only, filterable by user)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isSelf ? <MySessionsTable /> : (
            <div className="p-6">
              <EmptyState
                icon={<Clock className="mx-auto" size={28} strokeWidth={1.5} />}
                title="Not this user's own session"
                description="Go to Run Mind → Fleet Sessions and filter by this person's email to see their history."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </AdminSectionLayout>
  );
}

/**
 * An employee's personal spend cap (S131 §7.2).
 *
 * This is NOT a wallet. An edge employee has no credit balance of their own —
 * they draw on the workspace owner's pool, and this cap is the only per-person
 * limit that exists. Raising it does not add credits to anyone.
 *
 * Two states that look similar and must never be conflated:
 *   - `maxBudgetUsd === null`  -> UNCAPPED (the default, and the common case)
 *   - `maxBudgetUsd === 0`     -> capped at zero, i.e. every call blocked
 */
function SpendCapCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("30d");

  const capQuery = useQuery({
    queryKey: ["spendCap", userId],
    queryFn: ({ signal }) => getUserSpendCap(userId, signal),
  });

  const saveMutation = useMutation({
    mutationFn: ({ max, dur }: { max: number | null; dur: string | null }) =>
      setUserSpendCap(userId, max, dur),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spendCap", userId] }),
  });

  const cap = capQuery.data;
  const isCapped = typeof cap?.maxBudgetUsd === "number";
  const parsed = Number(amount);
  const canSave = amount.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && duration.trim() !== "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend cap</CardTitle>
        <CardDescription>
          A personal ceiling on this person&rsquo;s LLM spend. They have no credit balance of their
          own — they draw on the workspace owner&rsquo;s pool, and this is the only limit specific to
          them. Raising it does not add credits to anyone. All caps are listed on{" "}
          <Link to="/credits" className="text-accent hover:underline">
            Credits
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {capQuery.isLoading ? (
          <Spinner />
        ) : capQuery.isError ? (
          <ApiErrorState error={capQuery.error} />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-mid">Current</span>
            {isCapped ? (
              <span className="text-sm text-ink">
                ${cap!.maxBudgetUsd}
                {cap!.budgetDuration ? (
                  <span className="text-mid"> per {cap!.budgetDuration}</span>
                ) : null}
              </span>
            ) : (
              <span className="text-sm text-mid">
                Uncapped — limited only by the workspace pool
              </span>
            )}
          </div>
        )}

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave && !saveMutation.isPending) {
              saveMutation.mutate({ max: parsed, dur: duration.trim() });
            }
          }}
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-mid">Cap (USD)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 25"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs font-medium text-mid">Resets every</label>
            <Input
              placeholder="30d"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!canSave || saveMutation.isPending}>
            {saveMutation.isPending ? <Spinner className="mr-1.5" /> : null}
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={saveMutation.isPending || !isCapped}
            onClick={() => saveMutation.mutate({ max: null, dur: null })}
          >
            Remove cap
          </Button>
        </form>
        <p className="text-xs text-mid">
          A reset window is required. Without one the cap never resets, so the person stays blocked
          permanently once they reach it.
        </p>

        {saveMutation.isSuccess && (
          // `live: false` is a SUCCESS, not a failure — the cap is saved in the
          // engine's database and is re-applied the next time this person's key
          // is minted. Saying "saved" and nothing else would be wrong; saying
          // "failed" would be worse, and would prompt a pointless retry.
          <p className={saveMutation.data?.live === false ? "text-xs text-warning" : "text-xs text-success"}>
            {saveMutation.variables?.max === null
              ? "Cap removed."
              : saveMutation.data?.live === false
                ? "Saved, but not yet live on the proxy — it applies the next time this person signs in."
                : "Cap saved and live."}
          </p>
        )}
        {saveMutation.isError && <ApiErrorState error={saveMutation.error} />}
      </CardContent>
    </Card>
  );
}

function MySessionsTable() {
  const sessionsQuery = useQuery({ queryKey: ["mySessions"], queryFn: ({ signal }) => listMySessions(50, undefined, signal) });

  if (sessionsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-mid">
        <Spinner /> Loading sessions…
      </div>
    );
  }
  if (sessionsQuery.isError) {
    return <ApiErrorState error={sessionsQuery.error} onRetry={() => sessionsQuery.refetch()} />;
  }
  const sessions = sessionsQuery.data ?? [];
  if (sessions.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Clock className="mx-auto" size={28} strokeWidth={1.5} />}
          title="No runs yet"
          description="Go to Run Mind to execute something — it'll show up here."
        />
      </div>
    );
  }
  return (
    <Table>
      <THead>
        <tr>
          <TH>Mind</TH>
          <TH>Status</TH>
          <TH>Tokens</TH>
          <TH>Cost</TH>
          <TH>When</TH>
        </tr>
      </THead>
      <TBody>
        {sessions.map((s) => (
          <TR key={s.sessionId}>
            <TD className="font-mono text-xs">{s.mindId}</TD>
            <TD>
              <Badge tone={statusTone(s.status)}>{s.status}</Badge>
            </TD>
            <TD>{s.totalTokens}</TD>
            <TD>{s.costUsd != null ? `$${s.costUsd.toFixed(4)}` : "—"}</TD>
            <TD className="text-mid">{s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
