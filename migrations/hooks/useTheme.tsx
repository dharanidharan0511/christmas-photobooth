'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Full three-way colour scheme. */
export type ColorScheme = "light" | "paper" | "dark";

/** Accent family. "steel" = near-black (default). "param-green" = forest green. */
export type AccentVariant = "steel" | "param-green";

/**
 * Backward-compat alias: code that only cares about light vs dark uses this.
 * "paper" maps to "light" here — it is still a light-mode scheme.
 */
export type Theme = "light" | "dark";

const SCHEME_KEY = "aistudio:scheme";
const ACCENT_KEY = "aistudio:accent";

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function applySchemeAndAccent(scheme: ColorScheme, accent: AccentVariant) {
  const root = document.documentElement;

  root.setAttribute("data-theme", scheme);

  root.classList.remove("light", "paper", "dark");
  root.classList.add(scheme === "dark" ? "dark" : "light");

  if (accent === "param-green") {
    root.setAttribute("data-accent", "param-green");
  } else {
    root.removeAttribute("data-accent");
  }
}

function readStored<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && allowed.includes(v as T)) return v as T;
  } catch {
    // ignore
  }
  return fallback;
}

function getInitialScheme(): ColorScheme {
  const stored = readStored<ColorScheme>(SCHEME_KEY, ["light", "paper", "dark"], "light");
  if (stored !== "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialAccent(): AccentVariant {
  return readStored<AccentVariant>(ACCENT_KEY, ["steel", "param-green"], "param-green");
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ThemeContextValue {
  /** Full three-way scheme: "light" | "paper" | "dark". */
  scheme: ColorScheme;
  /**
   * Derived binary theme for backward-compat consumers (AppLogo, highlight.js).
   * "dark" only when scheme === "dark"; "light" otherwise.
   */
  theme: Theme;
  accent: AccentVariant;

  /** Cycles light -> paper -> dark -> light. */
  cycleScheme: () => void;
  /** Legacy two-way toggle: light <-> dark (skips paper). */
  toggleTheme: () => void;
  setScheme: (s: ColorScheme) => void;
  setAccent: (a: AccentVariant) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const SCHEME_CYCLE: ColorScheme[] = ["light", "paper", "dark"];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(getInitialScheme);
  const [accent, setAccentState] = useState<AccentVariant>(getInitialAccent);

  useEffect(() => {
    applySchemeAndAccent(scheme, accent);
    try {
      localStorage.setItem(SCHEME_KEY, scheme);
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      // ignore — preferences just won't persist
    }
  }, [scheme, accent]);

  const setScheme = (s: ColorScheme) => setSchemeState(s);
  const setAccent = (a: AccentVariant) => setAccentState(a);

  const cycleScheme = () =>
    setSchemeState((current) => {
      const idx = SCHEME_CYCLE.indexOf(current);
      return SCHEME_CYCLE[(idx + 1) % SCHEME_CYCLE.length];
    });

  const toggleTheme = () =>
    setSchemeState((current) => (current === "dark" ? "light" : "dark"));

  const theme: Theme = scheme === "dark" ? "dark" : "light";

  return (
    <ThemeContext.Provider value={{ scheme, theme, accent, cycleScheme, toggleTheme, setScheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
