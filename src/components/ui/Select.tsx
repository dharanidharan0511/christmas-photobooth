import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  /** Align the menu to the trigger's trailing edge (useful near the viewport right). */
  menuAlign?: "start" | "end";
}

/** TP-Web has no Radix/headless-ui dependency, so this follows AI Studio's
 * own inline hand-rolled dropdown pattern (`CreateProjectPanel.tsx`'s
 * Execution Cluster picker) rather than pulling in a new library: a
 * `useState` open flag, a portaled panel positioned from the trigger rect,
 * and document-level listeners that close it on outside click. */
export function Select({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Select...",
  ariaLabel,
  className,
  triggerClassName,
  menuAlign = "start",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, menuRef.current?.offsetWidth ?? rect.width);
    const viewportPadding = 8;
    let left =
      menuAlign === "end"
        ? rect.right - menuWidth
        : rect.left;

    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - menuWidth - viewportPadding));

    setMenuStyle({
      top: rect.bottom + 4,
      left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
  }, [open, menuAlign, options.length]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReposition = () => updateMenuPosition();

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, menuAlign, options.length]);

  const menu =
    open && menuStyle
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
            }}
            className="fixed z-[300] max-h-60 overflow-y-auto rounded-md border border-line bg-surface shadow-lg"
          >
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-mid">No options</p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full truncate px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-hover transition-colors",
                    opt.value === value && "bg-surface-hover font-medium",
                  )}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={rootRef} className={cn("relative inline-block max-w-full", className)}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => !disabled && setOpen((current) => !current)}
          className={cn(
            "flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink",
            "hover:bg-surface-hover transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-accent",
            "disabled:opacity-50 disabled:pointer-events-none",
            triggerClassName,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronDown size={14} className={cn("shrink-0 text-mid transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {menu}
    </>
  );
}
