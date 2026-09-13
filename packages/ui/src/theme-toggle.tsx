"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@avenick/utils";

/**
 * Theme toggle — flips the `dark` class on <html> and persists the choice.
 * Pair with `themeNoFlashScript` injected in <head> to avoid a flash on load.
 */
export interface ThemeToggleProps {
  className?: string;
  /**
   * `raised` (the default) is the bordered rung-2 chip the seller and admin
   * rails carry, and it is unchanged. `ghost` is the flat icon control: no
   * border, no plate, no shadow, and a state wash on hover. It is for a row of
   * utility icons such as the storefront header's wishlist, cart and account
   * controls. A raised chip among flat icons reads as the one actionable thing
   * in the row (LAW A), which a theme switch is not.
   */
  variant?: "raised" | "ghost";
  /**
   * `md` is --control-h-md, the icon-control height every portal already uses.
   * `lg` is a 44px touch target, for a sheet on a phone where it sits beside
   * other 44px controls.
   */
  size?: "md" | "lg";
  /**
   * The accessible names, in the active locale. A primitive cannot read a
   * portal's message tree, so every caller passes them, and there is no
   * fallback: a default here would be an English literal in JSX on an Arabic
   * page (§9), which is what this used to be in the seller and admin portals.
   */
  labels: { toDark: string; toLight: string };
}

const VARIANT: Record<NonNullable<ThemeToggleProps["variant"]>, string> = {
  raised: "border border-border bg-surface-2 text-ink-3 shadow-elev-2 hover:bg-surface-1 hover:text-ink-1",
  ghost: "text-ink-2 hover:bg-ink-1/[0.06] hover:text-ink-1",
};

export function ThemeToggle({ className, variant = "raised", size = "md", labels }: ThemeToggleProps) {
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

  const box = size === "lg" ? "2.75rem" : "var(--control-h-md)";
  // The ghost glyph matches the icons it sits beside; the raised chip keeps the
  // slightly smaller glyph its border was drawn around.
  const glyph = variant === "ghost" ? "h-[1.15rem] w-[1.15rem]" : "h-[1.05rem] w-[1.05rem]";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? labels.toLight : labels.toDark}
      style={{ height: box, width: box }}
      className={cn(
        "u-focus relative inline-flex shrink-0 items-center justify-center rounded-nested transition-colors duration-hover ease-standard",
        VARIANT[variant],
        className,
      )}
    >
      <Sun aria-hidden="true" className={cn(glyph, "rotate-0 scale-100 transition-transform duration-panel ease-standard dark:-rotate-90 dark:scale-0")} />
      <Moon aria-hidden="true" className={cn(glyph, "absolute rotate-90 scale-0 transition-transform duration-panel ease-standard dark:rotate-0 dark:scale-100")} />
    </button>
  );
}

/** Inline this (dangerouslySetInnerHTML) in <head> before paint to prevent FOUC. */
export const themeNoFlashScript = `(function(){try{var t=localStorage.getItem('avenick-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&m)){document.documentElement.classList.add('dark');}}catch(e){}})();`;
