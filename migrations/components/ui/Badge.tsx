import type { HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "admin";

const BASE = "inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-active text-mid",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-surface-active text-error",
  info: "bg-accent/10 text-accent",
  admin: "bg-accent/10 text-accent",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return <span className={`${BASE} ${toneClasses[tone]} ${className}`} {...props} />;
}

/** Maps common user-module status strings to a badge tone. Unknown values
 * fall back to neutral rather than guessing. */
export function statusTone(status: string): Tone {
  switch (status.toLowerCase()) {
    case "active":
      return "success";
    case "pending":
    case "invited":
      return "warning";
    case "disabled":
    case "suspended":
    case "revoked":
      return "danger";
    default:
      return "neutral";
  }
}
