/** Tiny className joiner — TP-Web has no cva/clsx dependency, so this is the
 * trivial equivalent used wherever the design system's ported components
 * expect a `cn()` helper. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** One option per Role name from the Roles page catalog.
 *
 * `listAllRoles` returns every `edge_roles` row — the bare name created in
 * Roles §1 plus each project mapping from §2. Assign/create pickers should
 * match §1 (unique names), not the mapping table. Prefer a mapped row's id
 * so assignment still grants that project's keys; fall back to the bare
 * reservation when the name has no mapping yet. */
export function rolesFromCatalog<T extends { id: string; name: string; projectId?: string | null }>(roles: T[]): T[] {
  const byName = new Map<string, T[]>();
  for (const role of roles) {
    const name = role.name.trim();
    if (!name) continue;
    const group = byName.get(name) ?? [];
    group.push(role);
    byName.set(name, group);
  }
  return [...byName.values()]
    .map((group) => group.find((role) => role.projectId) ?? group[0])
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Label for a Role in assign/create pickers — the Role name only. */
export function formatRoleOptionLabel(role: { name: string }): string {
  return role.name.trim() || "Role";
}

