import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A printed page carried the room it sits in.
 *
 * There was no @media print anywhere in the product. A buyer who printed or
 * saved a product page into a procurement pack got the ambient field (fixed, so
 * Chromium repeats it on every sheet), the sticky header with its search field,
 * and a blank hole wherever a staged reveal had not been scrolled to, because
 * <RevealRoot> holds those at opacity 0 until they arrive on screen. The home
 * hero's white copy would print white on white, because printing drops
 * backgrounds by default.
 *
 * Print media cannot be exercised in JSDOM, so the guard is on the stylesheet:
 * there is one print block, and it still does each of those jobs.
 */
const CSS = readFileSync(join(__dirname, "..", "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function printBlocks(): string[] {
  const blocks: string[] = [];
  for (let at = CSS.indexOf("@media print"); at !== -1; at = CSS.indexOf("@media print", at + 1)) {
    const start = CSS.indexOf("{", at) + 1;
    let i = start;
    for (let depth = 1; depth > 0 && i < CSS.length; i++) {
      if (CSS[i] === "{") depth++;
      else if (CSS[i] === "}") depth--;
    }
    blocks.push(CSS.slice(start, i - 1));
  }
  return blocks;
}

/** Every declaration body in `block` whose selector list names `selector` exactly. */
function declarationsFor(block: string, selector: string): string {
  return [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, list]) => list!.split(",").map((s) => s.trim()).includes(selector))
    .map(([, , body]) => body)
    .join(";");
}

const blocks = printBlocks();
const block = blocks[0] ?? "";

describe("print stylesheet", () => {
  it("is one block, so there is one place to read what paper gets", () => {
    expect(blocks).toHaveLength(1);
  });

  it.each([".u-field", ".u-scroll-progress", ".u-chrome", "[data-grain]::after"])("keeps %s off paper", (selector) => {
    expect(declarationsFor(block, selector)).toMatch(/display:\s*none\s*!important/);
  });

  it("prints every staged reveal as revealed, with no fade to catch mid-way", () => {
    const body = declarationsFor(block, "[data-reveal]");
    expect(body).toMatch(/opacity:\s*1\s*!important/);
    expect(body).toMatch(/transform:\s*none\s*!important/);
    expect(body).toMatch(/transition:\s*none\s*!important/);
  });

  it("keeps the rim's masked shoulder off paper, which printed the price panel blank", () => {
    expect(declarationsFor(block, "[data-rim]::before")).toMatch(/display:\s*none\s*!important/);
  });

  it("keeps the brand panel's fill, which its white copy depends on", () => {
    expect(declarationsFor(block, ".u-panel-brand")).toMatch(/(^|[;\s])print-color-adjust:\s*exact/);
  });
});
