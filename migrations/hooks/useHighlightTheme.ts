'use client';

import { useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

const LINK_ID = "aistudio-hljs-theme";

/**
 * Inject the correct highlight.js GitHub stylesheet for the active scheme.
 * "paper" is a warm light scheme -> uses the light highlight theme.
 * Only "dark" scheme triggers the dark stylesheet.
 */
export function useHighlightTheme() {
  const { scheme } = useTheme();

  useEffect(() => {
    const href =
      scheme === "dark"
        ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github-dark.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github.min.css";

    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [scheme]);
}
