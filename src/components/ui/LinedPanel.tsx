import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type Corner = "tl" | "tr" | "bl" | "br";

/** Shared crosshair stroke — muted ink (cards + lined buttons). */
const CROSSHAIR_COLOR = "color(srgb 0.14902 0.133333 0.101961 / 0.2)";

/**
 * Corner crosshair — slightly heavier than a 1px border so the mark reads,
 * without returning to a bold glyph.
 */
function LinedCross({ pos }: { pos: Corner }) {
  const top = pos === "tl" || pos === "tr";
  const left = pos === "tl" || pos === "bl";

  return (
    <i
      aria-hidden
      className={cn(
        "corner pointer-events-none absolute z-[2] block h-0 w-0",
        top ? "top-0" : "bottom-0",
        left ? "left-0" : "right-0",
      )}
    >
      {/* horizontal arm — short so adjacent cards keep a clear gutter */}
      <span
        className={cn(
          "absolute h-[2px] w-2.5",
          top ? "-top-px" : "-bottom-px",
          left ? "-left-[5px]" : "-right-[5px]",
        )}
        style={{ backgroundColor: CROSSHAIR_COLOR }}
      />
      {/* vertical arm */}
      <span
        className={cn(
          "absolute w-[2px] h-2.5",
          left ? "-left-px" : "-right-px",
          top ? "-top-[5px]" : "-bottom-[5px]",
        )}
        style={{ backgroundColor: CROSSHAIR_COLOR }}
      />
    </i>
  );
}

/** Four corner crosses for lined panels / buttons. */
export function LinedCorners() {
  return (
    <>
      <LinedCross pos="tl" />
      <LinedCross pos="tr" />
      <LinedCross pos="bl" />
      <LinedCross pos="br" />
    </>
  );
}

/**
 * Blueprint / lined-UI panel.
 * Default: light hairline on page bg. Hover/active: theme accent frame;
 * corner crosses use a 2px stroke (border stays 1px).
 */
export function LinedPanel({
  children,
  className,
  contentClassName,
  interactive = false,
  active = false,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Border shifts to accent on group-hover / focus. */
  interactive?: boolean;
  /** Force accent frame (e.g. pending navigation). */
  active?: boolean;
}) {
  return (
    <div className={cn("relative bg-bg", className)}>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 border border-line transition-colors duration-150",
          interactive &&
            "group-hover:border-accent group-focus-visible:border-accent",
          active && "border-accent",
        )}
      />
      <LinedCorners />
      <div className={cn("relative z-[1]", contentClassName)}>{children}</div>
    </div>
  );
}
