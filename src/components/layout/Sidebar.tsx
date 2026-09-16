import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Shield,
  Play,
  Code,
  File,
  BookOpen,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { AppLogo } from "../ui/AppLogo";
import { ProfilePopover } from "../ui/ProfilePopover";
import { cn } from "../../lib/utils";

// ── Nav items ───────────────────────────────────────────────────────────────
// `abbr` is the 2-3 char label shown below the icon.
// Admin screens (Users / Roles / Credits / Audit) live behind the bottom
// Shield control — not as separate sidebar entries.
// Suite icons match Workbench cards: Code / File / Play.
const NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "Workbench",
    abbr: null, // icon-only — the "home" anchor
    Icon: LayoutDashboard,
    isActive: (p: string) => p === "/dashboard",
  },
  {
    to: "/code-repos",
    label: "CodeFlo+",
    abbr: "CF+",
    Icon: Code,
    isActive: (p: string) => p.startsWith("/code-repos"),
  },
  {
    to: "/docflo/agents",
    label: "DocFlo+",
    abbr: "DF+",
    Icon: File,
    isActive: (p: string) => p.startsWith("/docflo"),
  },
  {
    to: "/run",
    label: "Run Minds",
    abbr: "LIVE",
    Icon: Play,
    isActive: (p: string) => p === "/run",
  },
] as const;

function isAdminSection(path: string): boolean {
  return (
    path.startsWith("/users") ||
    path === "/roles" ||
    path === "/credits" ||
    path === "/audit"
  );
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { theme, scheme, cycleScheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);

  const isAdmin = auth.mode === "key" || Boolean(auth.whoami?.isAdmin);
  const adminActive = isAdminSection(location.pathname);
  const displayName = auth.whoami?.eml ?? (auth.mode === "key" ? "Admin Key" : "—");
  const initial = (auth.mode === "key" ? "K" : displayName.charAt(0)).toUpperCase();

  const SchemeIcon = scheme === "dark" ? Moon : scheme === "paper" ? BookOpen : Sun;

  return (
    <>
      <aside className="flex h-full w-sidebar-icon shrink-0 flex-col border-r border-line bg-bg">

        {/* ── Logo ─────────────────────────────────────────── */}
        <div
          className="flex h-header shrink-0 items-center justify-center border-b border-line cursor-pointer"
          onClick={() => navigate("/dashboard")}
          title="Workbench"
        >
          <AppLogo variant="short" size={26} theme={theme} />
        </div>

        {/* ── Nav ──────────────────────────────────────────── */}
        <nav className="flex flex-1 flex-col items-center gap-0.5 px-1.5 py-2">
          {NAV_ITEMS.map((item) => {
            const active = item.isActive(location.pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={cn(
                  "flex w-full flex-col items-center justify-center rounded-lg py-1.5 transition-colors",
                  active
                    ? "bg-accent/8 text-accent"
                    : "text-mid hover:bg-surface-active hover:text-ink",
                )}
              >
                <item.Icon size={17} strokeWidth={1.5} fill="none" />
                {item.abbr && (
                  <span className="mt-0.5 text-[8px] font-semibold tracking-wider leading-none">
                    {item.abbr}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Bottom ───────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-0.5 border-t border-line px-1.5 py-2">
          {/* Admin — opens Users (tabs cover Roles / Credits / Audit) */}
          {isAdmin && (
            <Link
              to="/users"
              title="Admin — Users, Roles, Credits, Audit"
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-lg py-1.5 transition-colors",
                adminActive
                  ? "bg-accent/8 text-accent"
                  : "text-mid hover:bg-surface-active hover:text-ink",
              )}
            >
              <Shield size={15} strokeWidth={1.5} />
              <span className="mt-0.5 text-[8px] font-semibold tracking-wider leading-none">
                ADM
              </span>
            </Link>
          )}

          {/* Theme cycle */}
          <button
            type="button"
            title={`Theme: ${scheme} — click to cycle`}
            onClick={cycleScheme}
            className="flex w-full items-center justify-center rounded-lg py-1.5 text-mid hover:bg-surface-active hover:text-ink transition-colors"
          >
            <SchemeIcon size={17} strokeWidth={1.5} />
          </button>

          {/* User avatar — opens profile popover */}
          <button
            ref={avatarRef}
            type="button"
            title={displayName}
            onClick={() => setProfileOpen((v) => !v)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-opacity hover:opacity-80",
              "bg-accent text-on-accent mt-0.5",
            )}
          >
            {initial}
          </button>
        </div>
      </aside>

      {/* Profile popover — rendered outside <aside> so it isn't clipped */}
      {profileOpen && (
        <ProfilePopover
          onClose={() => setProfileOpen(false)}
          anchorRef={avatarRef}
        />
      )}
    </>
  );
}
