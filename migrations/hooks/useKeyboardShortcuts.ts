'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useShortcuts } from "@/context/ShortcutsContext";
import { useAuth } from "@/hooks/useAuth";

/** Returns true if the keyboard event originates from a text-entry element. */
function isTypingContext(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    t.isContentEditable
  );
}

/**
 * Global single-key shortcuts — must be mounted once inside an authenticated layout.
 * Keys are ignored while the user is typing in a form field.
 *
 * Map (from reference design):
 *   h  -> Workbench (home) -- for ALL users
 *   c  -> CodeFlo+ repos
 *   d  -> DocFlo+ agents
 *   a  -> Administration (admin only)
 *   t  -> Cycle colour scheme
 *   k  -> Open shortcuts help (primary)
 *   ?  -> Open shortcuts help (alias)
 *   Cmd/Ctrl+K -> Open shortcuts help (alias)
 *   Esc -> Close shortcuts help
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const { cycleScheme } = useTheme();
  const { isOpen, openShortcuts, closeShortcuts } = useShortcuts();
  const auth = useAuth();
  const isAdmin = auth.mode === "key" || Boolean(auth.whoami?.isAdmin);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Cmd/Ctrl+K always opens help (even while typing)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openShortcuts();
        return;
      }

      // All other single-key shortcuts only fire outside text entry
      if (isTypingContext(e) || e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "h":
          router.push("/dashboard");
          break;
        case "c":
          router.push("/code-repos");
          break;
        case "d":
          router.push("/docflo/agents");
          break;
        case "a":
          if (isAdmin) router.push("/admin/users");
          break;
        case "t":
          cycleScheme();
          break;
        case "k":
        case "?":
          openShortcuts();
          break;
        case "Escape":
          if (isOpen) closeShortcuts();
          break;
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router, cycleScheme, openShortcuts, closeShortcuts, isOpen, isAdmin]);
}
