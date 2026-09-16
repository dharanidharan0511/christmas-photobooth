import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  footnote?: ReactNode;
}

/** Honest "not available yet" / "nothing here" state. Never render fake rows
 * — use this instead whenever the backing endpoint doesn't exist. */
export function EmptyState({ icon, title, description, footnote }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-sm text-mid">
      {icon && <div className="mb-1 text-3xl opacity-60">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-md text-sm text-mid">{description}</p>}
      {footnote && <p className="mt-2 max-w-md font-mono text-[11px] text-light">{footnote}</p>}
    </div>
  );
}
