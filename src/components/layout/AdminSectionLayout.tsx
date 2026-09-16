import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";

const ADMIN_TABS = [
  {
    to: "/users",
    label: "Users",
    isActive: (path: string) => path.startsWith("/users"),
  },
  {
    to: "/roles",
    label: "Roles",
    isActive: (path: string) => path === "/roles",
  },
  {
    to: "/credits",
    label: "Credits",
    isActive: (path: string) => path === "/credits",
  },
  {
    to: "/audit",
    label: "Audit log",
    isActive: (path: string) => path === "/audit",
  },
] as const;

/**
 * Centered admin section shell — horizontal tabs + max-width column,
 * matching the Workbench / Run Minds centered layout.
 */
export function AdminSectionLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <nav
          aria-label="Admin section"
          className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line"
        >
          {ADMIN_TABS.map((tab) => {
            const active = tab.isActive(pathname);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-mid hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}

/** Shared page title block used under the admin tabs. */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pt-1">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 text-sm text-mid leading-relaxed">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
