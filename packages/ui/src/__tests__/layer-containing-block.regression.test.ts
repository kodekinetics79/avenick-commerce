import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A `position: fixed` element positions against the viewport — UNLESS an
 * ancestor establishes a containing block for it. `transform`, `perspective`,
 * `filter`, `backdrop-filter`, `contain: paint|layout|strict|content` and
 * `will-change` naming any of those all do that.
 *
 * `.u-layer-root` wraps every Layer's fixed panel and is a zero-height static
 * div at the end of the portal. When it carried `perspective: 1000px`, the
 * panel's `top:0/bottom:0` resolved against THAT box: on the product page the
 * cart drawer opened at y≈2880 and on mobile the navigation opened at y≈10577
 * — each one exactly the document height, i.e. just past the last pixel of the
 * page. The dialog was open, focus-trapped and screen-reader correct; it was
 * simply nowhere a person could see, behind a scrim that looked right because
 * it is a sibling of the wrapper rather than a child.
 *
 * The failure is invisible to JSDOM (no layout) and to every unit test, so the
 * guard is on the stylesheet itself.
 */
const CSS = readFileSync(join(__dirname, "..", "globals.css"), "utf8");

function ruleBodiesFor(selector: string): string[] {
  const bodies: string[] = [];
  const pattern = new RegExp(`(^|\\})([^{}]*${selector.replace(/[.[\]*]/g, "\\$&")}[^{}]*)\\{([^}]*)\\}`, "g");
  for (const match of CSS.matchAll(pattern)) {
    // Skip @keyframes step selectors (`from`, `to`, `0%`) — those live inside a
    // keyframes block and never create containing blocks for anything.
    if (/^\s*(from|to|\d+%)\s*$/.test(match[2])) continue;
    bodies.push(match[3]);
  }
  return bodies;
}

const CONTAINING_BLOCK_PROPS = [
  "perspective",
  "transform",
  "rotate",
  "scale",
  "translate",
  "filter",
  "backdrop-filter",
  "contain",
  "will-change",
];

describe.each([
  [".u-layer-root", "traps the fixed panel at the end of the document"],
  // <RouteFade>'s wrapper sits directly inside <main>, so the same property
  // would trap every fixed element on the page and clip every sticky one. It
  // animates opacity, which creates a stacking context and nothing else.
  [".u-route", "traps every fixed element inside <main> and clips the sticky ones"],
])("%s", (selector, consequence) => {
  it("is declared in the stylesheet", () => {
    expect(ruleBodiesFor(selector).length).toBeGreaterThan(0);
  });

  it.each(CONTAINING_BLOCK_PROPS)(`never sets %s, which ${"" || ""}`, (prop) => {
    for (const body of ruleBodiesFor(selector)) {
      expect(
        body,
        `${selector} sets ${prop}, which ${consequence}`,
      ).not.toMatch(new RegExp(`(^|[;\\s])${prop}\\s*:`));
    }
  });

  it.skipIf(selector !== ".u-layer-root")("keeps the centred panel's depth as a perspective() transform function on the panel itself", () => {
    // translateZ without a perspective in its own transform list is a no-op, so
    // moving the depth here has to bring the perspective with it.
    const centreSteps = CSS.match(/@keyframes layer-(in|out)-center\s*\{[^}]*\}[^}]*\}/g) ?? [];
    expect(centreSteps.length).toBe(2);
    for (const block of centreSteps) {
      for (const step of block.match(/transform:[^;]+;/g) ?? []) {
        expect(step).toContain("perspective(");
        expect(step.indexOf("perspective(")).toBeLessThan(
          step.includes("translateZ(") ? step.indexOf("translateZ(") : Number.MAX_SAFE_INTEGER,
        );
      }
    }
  });
});
