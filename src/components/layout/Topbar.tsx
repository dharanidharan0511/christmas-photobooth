import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ENGINE_URL, ENGINE_PROXY_TARGET } from "../../lib/engineClient";
import { useTheme } from "../../hooks/useTheme";
import { useShortcuts } from "../../context/ShortcutsContext";
import { cn } from "../../lib/utils";

const ENGINE_DISPLAY = ENGINE_URL || ENGINE_PROXY_TARGET || "not configured";


/** k · shortcuts button (matches reference design) */
function ShortcutsButton() {
  const { openShortcuts } = useShortcuts();
  return (
    <button
      type="button"
      title="Keyboard shortcuts (k)"
      onClick={openShortcuts}
      className="flex items-center gap-1 text-xs text-mid hover:text-ink transition-colors"
    >
      <kbd className="inline-flex h-5 items-center rounded border border-line bg-surface-active px-1.5 font-mono text-[10px] text-ink">
        k
      </kbd>
      <span>·</span>
      <span>shortcuts</span>
    </button>
  );
}

/** Edge runtime connection status — polls /user/whoami reachability. */
function RuntimeStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const target = ENGINE_URL || "";
        const res = await fetch(`${target}/user/whoami`, {
          credentials: "include",
          signal: AbortSignal.timeout(4000),
        });
        // 401 / 200 both mean the engine is alive
        if (!cancelled) setConnected(res.status !== 0);
      } catch {
        if (!cancelled) setConnected(false);
      }
    }
    void ping();
    const id = setInterval(ping, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const label =
    connected === null
      ? "Edge runtime · checking"
      : connected
        ? "Edge runtime · connected"
        : "Edge runtime · unreachable";

  return (
    <div className="flex items-center gap-1.5 text-xs text-mid whitespace-nowrap">
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          connected === null
            ? "bg-faint"
            : connected
              ? "bg-success"
              : "bg-error"
        }`}
      />
      {label}
    </div>
  );
}

export function Topbar() {
  const { theme } = useTheme();

  return (
    <header className="flex h-header shrink-0 items-center justify-between border-b border-line bg-bg px-4 gap-4">
      {/* ── Left: logo lockup + engine URL ──────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          to="/dashboard"
          title="Workbench"
          className="shrink-0 rounded-sm transition-opacity hover:opacity-80"
        >
          <span
            className={cn(
              "font-brand text-[17px] leading-none tracking-tight",
              theme === "dark" ? "text-[#F0EDE6]" : "text-[#26221A]",
            )}
          >
            <span className="font-semibold">ai/studio</span>
            {" "}
            <span className="font-semibold text-accent">Enterprise</span>
          </span>
        </Link>

        {/* Engine URL */}
        <span className="min-w-0 truncate text-xs text-mid">
          engine:{" "}
          <span className="font-mono text-ink">{ENGINE_DISPLAY}</span>
        </span>
      </div>

      {/* ── Right: shortcuts + runtime status ────────────── */}
      <div className="flex items-center gap-4 shrink-0">
        <ShortcutsButton />
        <RuntimeStatus />
      </div>
    </header>
  );
}
