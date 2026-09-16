import { useEffect } from "react";
import { useShortcuts } from "../../context/ShortcutsContext";
import { LinedPanel } from "./LinedPanel";

const SHORTCUT_ROWS: { keys: string[]; label: string }[] = [
  { keys: ["h"], label: "Workbench (home)" },
  { keys: ["c"], label: "CodeFlo+ repos" },
  { keys: ["d"], label: "DocFlo+ chat" },
  { keys: ["a"], label: "Administration" },
  { keys: ["n"], label: "New chat (in context)" },
  { keys: ["1", "2", "3"], label: "Kanban / Review / Code (in a project)" },
  { keys: ["["], label: "Toggle left panel" },
  { keys: ["]"], label: "Toggle right panel" },
  { keys: ["t"], label: "Light / dark theme" },
  { keys: ["k"], label: "This help" },
  { keys: ["esc"], label: "Close dialogs" },
];

function KbdKey({ k }: { k: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-accent/50 bg-surface px-1.5 font-mono text-[11px] font-medium text-accent">
      {k}
    </kbd>
  );
}

export function ShortcutsModal() {
  const { isOpen, closeShortcuts } = useShortcuts();

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeShortcuts();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeShortcuts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-[2px]"
        onClick={closeShortcuts}
      />

      {/* Panel */}
      <LinedPanel
        className="relative z-10 w-full max-w-sm bg-surface shadow-lg"
        contentClassName="px-6 py-5"
      >
        <h2 className="text-base font-semibold text-ink">Keyboard shortcuts</h2>
        <p className="mt-0.5 mb-4 text-xs text-mid">
          Single keys — active anywhere except while typing.
        </p>

        <div className="space-y-2.5">
          {SHORTCUT_ROWS.map(({ keys, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex shrink-0 gap-1">
                {keys.map((k) => (
                  <KbdKey key={k} k={k} />
                ))}
              </div>
              <span className="text-sm text-ink">{label}</span>
            </div>
          ))}
        </div>
      </LinedPanel>
    </div>
  );
}
