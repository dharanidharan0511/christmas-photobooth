interface FilePathBreadcrumbProps {
  path: string;
}

export function FilePathBreadcrumb({ path }: FilePathBreadcrumbProps) {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav className="flex min-w-0 items-center gap-0.5 text-xs text-mid" aria-label="File location">
      {segments.map((segment, index) => (
        <span key={`${index}-${segment}`} className="flex min-w-0 items-center gap-0.5">
          {index > 0 && <span className="shrink-0 text-light">/</span>}
          <span
            className={`truncate ${index === segments.length - 1 ? "font-medium text-ink" : ""}`}
            title={segment}
          >
            {segment}
          </span>
        </span>
      ))}
    </nav>
  );
}
