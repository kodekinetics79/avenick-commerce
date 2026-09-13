import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cn } from "../cn";

/**
 * cn() dropped real classes whenever a class list held one of the type scale's
 * sizes and a text colour.
 *
 * tailwind-merge only knows Tailwind's own font-size steps. It filed
 * `text-ui`, `text-body`, `text-meta` and the rest of
 * packages/config/tailwind.config.base.js's fontSize keys as COLOURS, and two
 * colours in one list collapse to the last. So
 * `cn("bg-primary text-primary-foreground px-5 text-ui")` returned
 * `"bg-primary px-5 text-ui"` — which is the primary Button's variant plus its
 * size, so every filled button in three portals — at every size but `icon`,
 * which sets no type size — painted its label in inherited ink: 3.4:1 on the
 * green in light theme and 1.6:1 in dark. Badge lost its
 * SIZE the same way in the other order.
 *
 * The scale is read from the Tailwind config here, so a size added there and
 * not in cn.ts fails this file instead of silently eating a colour again.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const tailwind = createRequire(import.meta.url)(
  resolve(repoRoot, "packages/config/tailwind.config.base.js"),
) as { theme: { extend: { fontSize: Record<string, unknown>; colors: Record<string, unknown> } } };

const SIZES = Object.keys(tailwind.theme.extend.fontSize);

/** `primary: { DEFAULT, foreground }` → `primary`, `primary-foreground`. */
function colourNames(tree: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const name = key === "DEFAULT" ? prefix : prefix ? `${prefix}-${key}` : key;
    return typeof value === "string" ? [name] : colourNames(value as Record<string, unknown>, name);
  });
}
const COLOURS = colourNames(tailwind.theme.extend.colors);

const classes = (list: string) => list.split(" ").sort();

describe("cn() and the type scale", () => {
  it("reads a non-empty scale and colour list from the Tailwind config", () => {
    // Guards the guard: an empty list would make every loop below vacuous.
    expect(SIZES).toContain("ui");
    expect(COLOURS).toContain("primary-foreground");
  });

  it("keeps the primary button's label colour beside its size", () => {
    // The literal class list Button builds for variant="primary" size="md".
    expect(classes(cn("bg-primary text-primary-foreground px-5 text-ui"))).toEqual(
      classes("bg-primary text-primary-foreground px-5 text-ui"),
    );
    expect(cn("bg-danger text-danger-foreground px-8 text-body")).toContain("text-danger-foreground");
  });

  it.each(SIZES)("keeps a colour and text-%s together, in either order", (size) => {
    expect(classes(cn(`text-ink-1 text-${size}`))).toEqual(classes(`text-ink-1 text-${size}`));
    expect(classes(cn(`text-${size} text-ink-1`))).toEqual(classes(`text-${size} text-ink-1`));
  });

  it.each(COLOURS)("still files text-%s as a colour, not a size", (colour) => {
    expect(classes(cn(`text-${colour} text-ui`))).toEqual(classes(`text-${colour} text-ui`));
  });

  it("still collapses two sizes to the last one", () => {
    expect(cn("text-ui text-body")).toBe("text-body");
    expect(cn("text-fig-card text-h2")).toBe("text-h2");
    // A scale size and a Tailwind step are the same property too.
    expect(cn("text-sm text-ui")).toBe("text-ui");
    expect(cn("text-ui text-sm")).toBe("text-sm");
  });

  it("still collapses two colours to the last one", () => {
    expect(cn("text-ink-1 text-primary-foreground")).toBe("text-primary-foreground");
    expect(cn("text-ui text-ink-2 text-ink-3")).toBe("text-ui text-ink-3");
  });

  it("leaves a leading-* written after the size alone", () => {
    // Before the size, it goes — the scale's utilities set line-height, and
    // that is tailwind-merge's rule for text-sm as well.
    expect(cn("text-ui leading-none")).toBe("text-ui leading-none");
    expect(cn("leading-none text-ui")).toBe("text-ui");
  });
});
