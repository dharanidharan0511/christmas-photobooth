import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  assignRole,
  createRole,
  createRoleName,
  listMyMinds,
  listUsers,
  resolveShareKey,
} from "../../lib/engineClient";
import type { EngineRole, EngineUser, MindSummary } from "../../types/engine";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Spinner } from "../ui/Spinner";
import { ApiErrorState } from "../ui/ApiErrorState";
import { cn } from "../../lib/utils";

type Step = 1 | 2 | 3;

type RegisteredKey = {
  prefix: string;
  projectId: string;
  projectName?: string | null;
  keyName?: string | null;
  rawKey?: string;
  minds: MindSummary[];
  /** Keys discovered from existing roles (no raw value to re-store). */
  fromCatalog: boolean;
};

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "01 · Define" },
  { id: 2, label: "02 · Grant keys" },
  { id: 3, label: "03 · Members" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shortPrefix(value: string): string {
  return value.trim().slice(0, 12);
}

function catalogKeysFromRoles(roles: EngineRole[]): RegisteredKey[] {
  const byPrefix = new Map<string, RegisteredKey>();
  for (const role of roles) {
    if (!role.projectId) continue;
    const keys =
      (role.keys ?? []).length > 0
        ? role.keys!
        : (role.keyPrefixes ?? []).map((prefix) => ({
            prefix,
            name: undefined as string | undefined,
            hasStoredKey: false,
          }));
    for (const key of keys) {
      const prefix = shortPrefix(key.prefix);
      if (!prefix || byPrefix.has(prefix)) continue;
      byPrefix.set(prefix, {
        prefix,
        projectId: role.projectId,
        projectName: role.projectName,
        keyName: key.name ?? null,
        fromCatalog: true,
        minds: [],
      });
    }
  }
  return [...byPrefix.values()].sort((a, b) => a.prefix.localeCompare(b.prefix));
}

export function NewRoleModal({
  open,
  onClose,
  existingRoles,
}: {
  open: boolean;
  onClose: () => void;
  existingRoles: EngineRole[];
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pasteKey, setPasteKey] = useState("");
  const [manualProjectId, setManualProjectId] = useState("");
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [sessionKeys, setSessionKeys] = useState<RegisteredKey[]>([]);
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: ({ signal }) => listUsers(signal),
    enabled: open,
  });

  const catalogKeys = useMemo(() => catalogKeysFromRoles(existingRoles), [existingRoles]);
  const allKeys = useMemo(() => {
    const map = new Map<string, RegisteredKey>();
    for (const key of catalogKeys) map.set(key.prefix, key);
    for (const key of sessionKeys) map.set(key.prefix, key); // session wins (has raw + minds)
    return [...map.values()];
  }, [catalogKeys, sessionKeys]);

  const selectedKeys = allKeys.filter((key) => selectedPrefixes.has(key.prefix));
  const mindCount = selectedKeys.reduce((n, key) => n + (key.minds.length || 0), 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const roleName = name.trim();
      if (!roleName) throw new Error("Role name is required.");

      const reserved = await createRoleName(roleName);
      const roleIds = new Set<string>([reserved.id]);

      const byProject = new Map<
        string,
        { projectName?: string | null; prefixes: string[]; rawKeys: Record<string, string>; keyNames: Record<string, string> }
      >();

      for (const key of selectedKeys) {
        const group = byProject.get(key.projectId) ?? {
          projectName: key.projectName,
          prefixes: [],
          rawKeys: {},
          keyNames: {},
        };
        if (!group.prefixes.includes(key.prefix)) group.prefixes.push(key.prefix);
        if (key.rawKey) group.rawKeys[key.prefix] = key.rawKey;
        if (key.keyName) group.keyNames[key.prefix] = key.keyName;
        if (key.projectName) group.projectName = key.projectName;
        byProject.set(key.projectId, group);
      }

      for (const [projectId, group] of byProject) {
        const mapped = await createRole(roleName, projectId, group.prefixes, {
          projectName: group.projectName ?? undefined,
          keyNames: Object.keys(group.keyNames).length ? group.keyNames : undefined,
          rawKeys: Object.keys(group.rawKeys).length ? group.rawKeys : undefined,
        });
        roleIds.add(mapped.id);
      }

      const users = [...selectedUserIds];
      for (const userId of users) {
        for (const roleId of roleIds) {
          try {
            await assignRole(userId, roleId);
          } catch {
            // Duplicate assignment or bare-name id may 409 — keep going.
          }
        }
      }

      return { roleName, roleIds: [...roleIds] };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["userRoles"] });
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
    if (open) return;
    setStep(1);
    setName("");
    setDescription("");
    setPasteKey("");
    setManualProjectId("");
    setValidateError(null);
    setSessionKeys([]);
    setSelectedPrefixes(new Set());
    setSelectedUserIds(new Set());
  }, [open]);

  async function validateAndAdd() {
    const raw = pasteKey.trim();
    setValidateError(null);
    if (!raw) {
      setValidateError("Paste a Mind Share Key first.");
      return;
    }
    setValidating(true);
    try {
      const resolved = await resolveShareKey(raw);
      const prefix = shortPrefix(resolved.keyPrefix || raw);
      let projectId = resolved.found && resolved.projectId ? resolved.projectId : manualProjectId.trim();
      if (!projectId) {
        setValidateError(
          "Key not in this cluster’s registry — paste the Project UUID from AI Studio → Project Settings, then validate again.",
        );
        setValidating(false);
        return;
      }
      if (!UUID_RE.test(projectId)) {
        setValidateError("Project ID should be a UUID.");
        setValidating(false);
        return;
      }

      let minds: MindSummary[] = [];
      try {
        minds = await listMyMinds(raw);
      } catch {
        minds = [];
      }

      const entry: RegisteredKey = {
        prefix,
        projectId,
        projectName: resolved.projectName,
        keyName: resolved.keyName,
        rawKey: raw.length > 12 ? raw : undefined,
        minds,
        fromCatalog: false,
      };

      setSessionKeys((prev) => {
        const next = prev.filter((k) => k.prefix !== prefix);
        next.push(entry);
        return next;
      });
      setSelectedPrefixes((prev) => new Set(prev).add(prefix));
      setPasteKey("");
      setManualProjectId("");
    } catch (error) {
      setValidateError(error instanceof Error ? error.message : "Could not validate key.");
    } finally {
      setValidating(false);
    }
  }

  function togglePrefix(prefix: string) {
    setSelectedPrefixes((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  }

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const canNextFromDefine = Boolean(name.trim());
  const users = (usersQuery.data ?? []).filter((u) => u.status !== "disabled");

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
        aria-labelledby="new-role-title"
        className="relative flex max-h-[min(92vh,44rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id="new-role-title" className="text-base font-semibold text-ink">
            New role
          </h2>
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

        <div className="flex gap-1 border-b border-line bg-bg-subtle px-3 py-2">
          {STEPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 1) setStep(1);
                else if (item.id === 2 && canNextFromDefine) setStep(2);
                else if (item.id === 3 && canNextFromDefine) setStep(3);
              }}
              className={cn(
                "flex-1 rounded-md px-2 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                step === item.id
                  ? "bg-accent text-on-accent"
                  : "text-mid hover:bg-surface-hover hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-mid leading-relaxed">
                A Role is the edge-local unit of access: it grants{" "}
                <span className="font-mono text-xs text-ink">mind-share key-ids</span> to people. Name
                it after the job, not the key.
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mid">Role name</label>
                <Input
                  autoFocus
                  placeholder="e.g. support, analytics, developer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mid">Description</label>
                <textarea
                  placeholder="What this role is for — shows on the Roles board"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <p className="mt-1.5 text-[11px] text-faint">
                  Keys and members are optional — you can create the Role name now and map them
                  later when you have a Mind Share Key or the right people.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-mid leading-relaxed">
                Pick the key-ids this Role grants — or register a new one by pasting a Mind Share Key
                from any ai/Studio workspace / project. The minds under each key come along with it.
              </p>

              <div className="rounded-lg border border-dashed border-line p-3 space-y-2">
                <p className="text-[11px] font-medium text-mid">
                  Register a new key — ai/Studio → Project → Mind Share Keys — copy
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    className="font-mono text-xs"
                    placeholder="msk_… — paste the raw key"
                    value={pasteKey}
                    onChange={(e) => setPasteKey(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    disabled={validating || !pasteKey.trim()}
                    onClick={() => void validateAndAdd()}
                  >
                    {validating ? <Spinner className="mr-1.5" /> : null}
                    Validate &amp; add
                  </Button>
                </div>
                {validateError?.includes("Project UUID") && (
                  <Input
                    className="font-mono text-xs"
                    placeholder="Project UUID from AI Studio → Project Settings"
                    value={manualProjectId}
                    onChange={(e) => setManualProjectId(e.target.value)}
                  />
                )}
                <p className="text-[11px] text-faint">
                  The raw key is stored encrypted on this engine and never shown again — Roles and
                  users only ever see its key-id.
                </p>
                {validateError && <p className="text-xs text-error">{validateError}</p>}
              </div>

              {allKeys.length === 0 ? (
                <p className="text-sm text-mid">No keys on this cluster yet — register one above.</p>
              ) : (
                <ul className="divide-y divide-line-subtle rounded-lg border border-line">
                  {allKeys.map((key) => {
                    const checked = selectedPrefixes.has(key.prefix);
                    return (
                      <li key={key.prefix} className="px-3 py-3">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-line"
                            checked={checked}
                            onChange={() => togglePrefix(key.prefix)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="font-mono text-sm font-medium text-ink">{key.prefix}</span>
                              <span className="text-[11px] text-faint">
                                {key.minds.length > 0
                                  ? `${key.minds.length} mind${key.minds.length === 1 ? "" : "s"} under this key`
                                  : key.fromCatalog
                                    ? "from existing Roles"
                                    : "key registered"}
                                {key.projectName ? ` · ${key.projectName}` : ""}
                              </span>
                            </div>
                            {key.minds.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {key.minds.map((mind) => (
                                  <span
                                    key={mind.id}
                                    className="rounded-md border border-line px-2 py-0.5 text-[11px] text-mid"
                                    title={mind.description || mind.name}
                                  >
                                    {mind.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="text-[11px] text-faint">
                Optional — skip this step if you don&apos;t have a key yet. Ticking a key grants all
                its minds on this engine. One Role can bundle keys from different workspaces and
                projects.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-mid leading-relaxed">
                Optionally assign edge SSO users — everyone you tick receives the minds granted by
                this Role. Skip if you&apos;ll map people later. This mapping never leaves the
                engine.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-line p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                    This role grants
                  </p>
                  {selectedKeys.length === 0 ? (
                    <p className="mt-3 text-sm text-mid">
                      No keys granted yet — go back to{" "}
                      <button
                        type="button"
                        className="font-medium text-accent hover:underline"
                        onClick={() => setStep(2)}
                      >
                        step 02
                      </button>{" "}
                      and pick keys.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {selectedKeys.map((key) => (
                        <li key={key.prefix}>
                          <p className="font-mono text-xs font-medium text-ink">{key.prefix}</p>
                          {key.minds.length > 0 ? (
                            <p className="text-[11px] text-mid">
                              {key.minds.map((m) => m.name).join(" · ")}
                            </p>
                          ) : (
                            <p className="text-[11px] text-faint">All minds under this key</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
                  {usersQuery.isLoading ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-mid">
                      <Spinner /> Loading users…
                    </div>
                  ) : usersQuery.isError ? (
                    <div className="p-3">
                      <ApiErrorState
                        error={usersQuery.error}
                        onRetry={() => void usersQuery.refetch()}
                      />
                    </div>
                  ) : users.length === 0 ? (
                    <p className="p-4 text-sm text-mid">No users to assign yet.</p>
                  ) : (
                    <ul className="divide-y divide-line-subtle">
                      {users.map((user: EngineUser) => (
                        <li key={user.id}>
                          <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-surface-hover">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-line"
                              checked={selectedUserIds.has(user.id)}
                              onChange={() => toggleUser(user.id)}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-ink">
                                {user.displayName || user.email.split("@")[0]}
                              </span>
                              <span className="block truncate font-mono text-[11px] text-mid">
                                {user.email}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-faint">
                Need different minds for different people? Create one Role per grant set.
              </p>

              <div className="rounded-lg border border-line bg-bg-subtle px-3 py-2.5 text-sm text-mid">
                {selectedKeys.length === 0 && selectedUserIds.size === 0 ? (
                  <>
                    Review — reserve{" "}
                    <span className="font-medium text-ink">{name.trim() || "unnamed"}</span>
                    {description.trim() ? (
                      <span className="text-faint"> · {description.trim()}</span>
                    ) : null}{" "}
                    with no keys or members. You can grant keys and assign people later.
                  </>
                ) : (
                  <>
                    Review —{" "}
                    <span className="font-medium text-ink">{name.trim() || "unnamed"}</span>
                    {description.trim() ? (
                      <span className="text-faint"> · {description.trim()}</span>
                    ) : null}
                    : grants{" "}
                    <span className="text-ink">
                      {mindCount > 0 ? mindCount : selectedKeys.length > 0 ? "all" : 0} mind
                      {mindCount === 1 ? "" : "s"}
                    </span>{" "}
                    across{" "}
                    <span className="text-ink">
                      {selectedKeys.length} key-id{selectedKeys.length === 1 ? "" : "s"}
                    </span>{" "}
                    to{" "}
                    <span className="text-ink">
                      {selectedUserIds.size} member{selectedUserIds.size === 1 ? "" : "s"}
                    </span>
                    .
                  </>
                )}
              </div>

              {createMutation.isError && <ApiErrorState error={createMutation.error} />}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={onClose}
            className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="secondary"
                disabled={createMutation.isPending}
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              >
                ← Back
              </Button>
            )}
            {step < 3 && (
              <Button
                type="button"
                variant="ghost"
                disabled={!canNextFromDefine || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                title="Save the Role name now — add keys and members later"
              >
                {createMutation.isPending ? <Spinner className="mr-1.5" /> : null}
                Create &amp; finish later
              </Button>
            )}
            {step < 3 ? (
              <Button
                type="button"
                disabled={step === 1 && !canNextFromDefine}
                onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              >
                Next →
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!canNextFromDefine || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Spinner className="mr-1.5" /> : null}
                Create role
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
