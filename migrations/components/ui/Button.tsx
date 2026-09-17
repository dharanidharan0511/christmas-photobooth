import { forwardRef, type ButtonHTMLAttributes } from "react";
import { LinedCorners } from "@/components/ui/LinedPanel";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Sharp corners + blueprint crosshairs (primary CTAs). */
  lined?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover border border-transparent",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-hover",
  ghost: "bg-transparent text-mid hover:bg-surface-hover hover:text-ink border border-transparent",
  danger: "bg-error text-white hover:opacity-90 border border-transparent",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5 gap-1.5",
  md: "text-sm px-3.5 py-2 gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", lined = false, className = "", disabled, ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          "focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none",
          lined ? "relative z-[1] rounded-none" : "rounded-md",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );

    if (!lined) return button;

    return (
      <span
        className={cn(
          "relative inline-flex shrink-0",
          /\bw-full\b/.test(className) && "w-full",
        )}
      >
        <LinedCorners />
        {button}
      </span>
    );
  },
);
Button.displayName = "Button";
