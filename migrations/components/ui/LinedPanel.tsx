import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Corner = "tl" | "tr" | "bl" | "br";

/** Shared crosshair stroke — muted ink (cards + lined buttons). */
const CROSSHAIR_COLOR = "color(srgb 0.14902 0.133333 0.101961 / 0.2)";

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
      <span
        className={cn(
          "absolute h-[2px] w-2.5",
          top ? "-top-px" : "-bottom-px",
          left ? "-left-[5px]" : "-right-[5px]",
        )}
        style={{ backgroundColor: CROSSHAIR_COLOR }}
      />
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
  interactive?: boolean;
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
