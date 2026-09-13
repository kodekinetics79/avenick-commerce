// @vitest-environment jsdom

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { NavigationProgress } from "../navigation-progress";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: reduce && query.includes("reduce"), media: query })),
  );
}

function clickInternalLink() {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", "/support");
  // A real navigation would leave the page; the capture-phase listener has
  // already done its work by the time the default action would run.
  anchor.addEventListener("click", (e) => e.preventDefault());
  document.body.appendChild(anchor);
  act(() => {
    anchor.click();
  });
  anchor.remove();
}

const bar = () => document.querySelector<HTMLElement>("[data-navigation-progress]");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("NavigationProgress", () => {
  /**
   * The first build's bar was a three-stop gradient with an indigo neon glow,
   * `shadow-[0_0_10px_rgba(99,102,241,0.7)…]`, on a green brand. It animated
   * `width`, sat at z-[9999] above every dialog and laid a second
   * full-viewport overlay across the page. A glow utility is banned outright
   * (DESIGN_SYSTEM §9) and width is not on the list of things that may animate
   * (§8). The replacement is the brass rule: one element, scaleX from the
   * inline start.
   */
  it("draws one brass rule with a transform, not a glowing gradient that animates width", () => {
    stubReducedMotion(false);
    render(<NavigationProgress />);
    expect(bar()).toBeNull();

    clickInternalLink();
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const el = bar();
    expect(el).not.toBeNull();
    expect(el!.className).toContain("bg-brass");
    expect(el!.className).not.toMatch(/shadow|gradient|z-\[9999\]/);
    expect(el!.style.width).toBe("");
    expect(el!.style.transform).toMatch(/^scaleX\(0\.\d+\)$/);
    expect(el!.style.transformOrigin).toBe("var(--origin-inline-start)");
    expect(el!.getAttribute("aria-hidden")).toBe("true");
    // Nothing else was mounted to dim the page.
    expect(document.body.querySelectorAll(".fixed")).toHaveLength(1);
  });

  /**
   * The creep is movement. A visitor who asked for less of it gets the rule at
   * its resting length, with no transform transition, so it never travels.
   */
  it("does not creep under reduced motion", () => {
    stubReducedMotion(true);
    render(<NavigationProgress />);

    clickInternalLink();
    const first = bar()!.style.transform;
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(first).toBe("scaleX(0.9)");
    expect(bar()!.style.transform).toBe("scaleX(0.9)");
    expect(bar()!.style.transition).not.toMatch(/transform/);
  });
});
