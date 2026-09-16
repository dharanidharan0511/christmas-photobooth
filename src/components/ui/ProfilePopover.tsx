import { useEffect, useRef, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Moon, Sun } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useTheme, type AccentVariant, type ColorScheme } from "../../hooks/useTheme";
import { Badge } from "./Badge";
import { cn } from "../../lib/utils";

interface ProfilePopoverProps {
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}

export function ProfilePopover({ onClose, anchorRef }: ProfilePopoverProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { scheme, accent, setScheme, setAccent } = useTheme();
  const popoverRef = useRef<HTMLDivElement>(null);

  const email = auth.whoami?.eml ?? (auth.mode === "key" ? "service key" : "—");
  const displayName = auth.whoami?.eml?.split("@")[0] ?? (auth.mode === "key" ? "Admin" : "—");
  const initial = (auth.mode === "key" ? "K" : displayName.charAt(0)).toUpperCase();
  const isAdmin = auth.mode === "key" || Boolean(auth.whoami?.isAdmin);

  // Close on outside click or Escape
  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        anchorRef.current?.contains(e.target as Node)
      )
        return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, anchorRef]);

  function handleSignOut() {
    auth.signOut();
    onClose();
    navigate("/");
  }

  const schemeOptions: { id: ColorScheme; Icon: typeof Sun; label: string }[] = [
    { id: "light", Icon: Sun, label: "Light" },
    { id: "paper", Icon: BookOpen, label: "Paper" },
    { id: "dark", Icon: Moon, label: "Dark" },
  ];

  const accentOptions: { id: AccentVariant; dot: string; label: string }[] = [
    { id: "steel", dot: "#292929", label: "Steel" },
    { id: "param-green", dot: "#2C9A68", label: "Param green" },
  ];

  return (
    <div
      ref={popoverRef}
      className="fixed z-[250] bottom-2 left-[52px] w-52 rounded-xl border border-line bg-surface shadow-lg"
    >
      {/* ── User info ──────────────────────────────────────── */}
      <div className="px-3 py-3 border-b border-line">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">{displayName}</p>
            <p className="text-[11px] text-mid truncate">{email}</p>
          </div>
        </div>
        {isAdmin && (
          <div className="mt-1.5 flex gap-1 flex-wrap">
            <Badge tone="admin">admin</Badge>
            {auth.mode === "key" && <Badge tone="neutral">key auth</Badge>}
          </div>
        )}
      </div>

      {/* ── Appearance ─────────────────────────────────────── */}
      <div className="px-3 py-2.5 border-b border-line space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
          Appearance
        </p>

        {/* Scheme */}
        <div className="flex gap-1">
          {schemeOptions.map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setScheme(id)}
              title={label}
              className={cn(
                "flex flex-1 items-center justify-center gap-0.5 rounded-md py-1 text-[11px] font-medium capitalize transition-colors",
                scheme === id
                  ? "bg-accent text-on-accent"
                  : "text-mid hover:bg-surface-hover hover:text-ink",
              )}
            >
              <Icon size={10} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>

        {/* Accent */}
        <div className="flex gap-1">
          {accentOptions.map(({ id, dot, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAccent(id)}
              title={label}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors",
                accent === id
                  ? "bg-surface-active text-ink ring-1 ring-line-strong"
                  : "text-mid hover:bg-surface-hover hover:text-ink",
              )}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0 ring-1 ring-black/10"
                style={{ backgroundColor: dot }}
              />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────── */}
      <div className="px-3 py-2 space-y-0.5">
        <button
          type="button"
          className="w-full rounded-md px-2 py-1.5 text-left text-sm text-mid hover:bg-surface-hover hover:text-ink transition-colors"
          onClick={() => {
            onClose();
            navigate("/user");
          }}
        >
          My profile &amp; access
        </button>
        <button
          type="button"
          className="w-full rounded-md px-2 py-1.5 text-left text-sm text-error hover:bg-error/5 transition-colors"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
