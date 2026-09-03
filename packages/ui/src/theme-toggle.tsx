"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@avenick/utils";

/**
 * Theme toggle — flips the `dark` class on <html> and persists the choice.
 * Pair with `themeNoFlashScript` injected in <head> to avoid a flash on load.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");

    // The old stylesheet transitioned `body, .glass, [class*="bg-card"],
    // [class*="border-"]` permanently — an attribute-substring selector matching
    // nearly every element in the tree, which made hover mushy and would visibly
    // stutter now that real multi-layer shadows exist. The transition is scoped
    // to a class that is only present for the 200ms of the actual swap.
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 200);

    root.classList.toggle("dark", next);
    try {
      localStorage.setItem("avenick-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{ height: "var(--control-h-md)", width: "var(--control-h-md)" }}
      className={cn(
        "u-focus relative inline-flex items-center justify-center rounded-nested border border-border bg-surface-2 text-ink-3 shadow-elev-2 transition-colors duration-hover ease-standard hover:bg-surface-1 hover:text-ink-1",
        className,
      )}
    >
      <Sun className="h-[1.05rem] w-[1.05rem] rotate-0 scale-100 transition-transform duration-panel ease-standard dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.05rem] w-[1.05rem] rotate-90 scale-0 transition-transform duration-panel ease-standard dark:rotate-0 dark:scale-100" />
    </button>
  );
}

/** Inline this (dangerouslySetInnerHTML) in <head> before paint to prevent FOUC. */
export const themeNoFlashScript = `(function(){try{var t=localStorage.getItem('avenick-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&m)){document.documentElement.classList.add('dark');}}catch(e){}})();`;
