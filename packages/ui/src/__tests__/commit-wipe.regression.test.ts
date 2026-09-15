import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * <CommitLabel> painted both of its labels at once.
 *
 * The wipe put the confirmed label and the resting label in one grid cell and
 * clipped only the resting one, on the theory that the confirmed label sat
 * "underneath" it. Text hides nothing between its glyphs, so at rest every
 * Add to cart button in the storefront — the PDP buy column, the phone buy bar,
 * the product card, the cart completion row, the wishlist — drew "Add to cart"
 * over "Added to cart" and read "AAdddedd to cart". Live: the committed span
 * had clip-path none and opacity 1 in the same cell as the resting one.
 *
 * The fix clips both layers to complementary sides of one travelling edge.
 * JSDOM cannot resolve clip-path from a stylesheet, so this file does the
 * cascade itself for the handful of selectors the wipe uses: it resolves each
 * layer's clip-path by specificity and source order, in both directions and
 * both states, and checks that at every frame of the shared transition the two
 * visible spans tile the label without overlapping. A selector shape it does
 * not model fails loudly rather than being skipped.
 */
const CSS = readFileSync(join(__dirname, "..", "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const SOURCE = readFileSync(join(__dirname, "..", "commit-row.tsx"), "utf8");

interface Rule {
  selector: string;
  decls: Record<string, string>;
  order: number;
}

const RULES: Rule[] = [];
for (const [, selectorText, body] of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selectors = selectorText!.split(",").map((s) => s.trim()).filter((s) => s.includes("u-wipe"));
  if (selectors.length === 0) continue;
  const decls: Record<string, string> = {};
  for (const declaration of body!.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon > 0) decls[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
  }
  for (const selector of selectors) RULES.push({ selector, decls, order: RULES.length });
}

interface El {
  tag: string;
  classes: string[];
  attrs: Record<string, string>;
  parent?: El;
}

const COMPOUND = /\*|[a-z]+|\.[\w-]+|\[[\w-]+="[^"]*"\]/gy;

/** [attribute+class count, type count] — ids never appear in this stylesheet. */
function specificity(selector: string): [number, number] {
  let b = 0;
  let c = 0;
  for (const compound of selector.replace(/>/g, " ").trim().split(/\s+/)) {
    for (const token of compound.match(/\*|[a-z]+|\.[\w-]+|\[[\w-]+="[^"]*"\]/g) ?? []) {
      if (token.startsWith(".") || token.startsWith("[")) b += 1;
      else if (token !== "*") c += 1;
    }
  }
  return [b, c];
}

function matchesCompound(el: El, compound: string): boolean {
  COMPOUND.lastIndex = 0;
  let consumed = 0;
  let ok = true;
  for (let m = COMPOUND.exec(compound); m; m = COMPOUND.exec(compound)) {
    consumed = COMPOUND.lastIndex;
    const token = m[0];
    if (token === "*") continue;
    if (token.startsWith(".")) ok &&= el.classes.includes(token.slice(1));
    else if (token.startsWith("[")) {
      const [, name, value] = token.match(/^\[([\w-]+)="([^"]*)"\]$/)!;
      ok &&= el.attrs[name!] === value;
    } else ok &&= el.tag === token;
  }
  if (consumed !== compound.length) {
    throw new Error(`commit-wipe test does not model "${compound}" — extend matchesCompound before relying on it`);
  }
  return ok;
}

function matches(el: El, selector: string): boolean {
  const parts = selector.replace(/\s*>\s*/g, " > ").trim().split(/\s+/);
  const walk = (node: El | undefined, i: number): boolean => {
    if (!node || !matchesCompound(node, parts[i]!)) return false;
    if (i === 0) return true;
    if (parts[i - 1] === ">") return walk(node.parent, i - 2);
    for (let up = node.parent; up; up = up.parent) if (walk(up, i - 1)) return true;
    return false;
  };
  return walk(el, parts.length - 1);
}

function computed(el: El, property: string): string | undefined {
  const winner = RULES.filter((r) => property in r.decls && matches(el, r.selector)).sort((x, y) => {
    const [xb, xc] = specificity(x.selector);
    const [yb, yc] = specificity(y.selector);
    return xb - yb || xc - yc || x.order - y.order;
  });
  return winner.at(-1)?.decls[property];
}

function label(dir: "ltr" | "rtl", state: "off" | "on") {
  const html: El = { tag: "html", classes: [], attrs: { dir } };
  const wipe: El = { tag: "span", classes: ["u-wipe"], attrs: { "data-state": state }, parent: html };
  return {
    from: { tag: "span", classes: ["u-wipe__from"], attrs: {}, parent: wipe } satisfies El,
    to: { tag: "span", classes: ["u-wipe__to"], attrs: {}, parent: wipe } satisfies El,
  };
}

/** inset(t r b l) as percentages of the layer's own width. */
function insets(el: El): [number, number, number, number] {
  const clip = computed(el, "clip-path");
  const inner = clip?.match(/^inset\(([^)]*)\)$/)?.[1];
  if (!inner) throw new Error(`expected an inset() clip-path, got ${clip}`);
  const v = inner.trim().split(/\s+/).map((part) => {
    if (part === "0") return 0;
    const pct = part.match(/^([\d.]+)%$/);
    if (!pct) throw new Error(`commit-wipe test models % and 0 only, got "${part}"`);
    return Number(pct[1]);
  });
  const [t, r = t, b = t, l = r] = v as [number, number?, number?, number?];
  return [t, r, b, l];
}

/** The horizontal span a layer shows at progress p of the off → on transition. */
function span(dir: "ltr" | "rtl", layer: "from" | "to", p: number): [number, number] {
  const off = insets(label(dir, "off")[layer]);
  const on = insets(label(dir, "on")[layer]);
  const right = off[1] + (on[1] - off[1]) * p;
  const left = off[3] + (on[3] - off[3]) * p;
  return [left, 100 - right];
}

const width = ([a, b]: [number, number]) => Math.max(0, b - a);

describe("<CommitLabel> wipe", () => {
  it("renders the confirmed layer with the class the stylesheet clips", () => {
    expect(SOURCE).toMatch(/className="u-wipe__to"/);
    expect(SOURCE).toMatch(/className="u-wipe__from"/);
  });

  describe.each(["ltr", "rtl"] as const)("%s", (dir) => {
    it("clips both layers in both states", () => {
      for (const state of ["off", "on"] as const) {
        const { from, to } = label(dir, state);
        expect(computed(from, "clip-path"), `__from, ${state}`).toMatch(/^inset\(/);
        expect(computed(to, "clip-path"), `__to, ${state}`).toMatch(/^inset\(/);
      }
    });

    it("shows only the resting label at rest and only the confirmed label once done", () => {
      expect(width(span(dir, "from", 0))).toBe(100);
      expect(width(span(dir, "to", 0))).toBe(0);
      expect(width(span(dir, "from", 1))).toBe(0);
      expect(width(span(dir, "to", 1))).toBe(100);
    });

    it("tiles the label with no overlap at every frame of the transition", () => {
      for (let p = 0; p <= 1; p += 0.125) {
        const from = span(dir, "from", p);
        const to = span(dir, "to", p);
        const overlap = Math.min(from[1], to[1]) - Math.max(from[0], to[0]);
        expect(overlap, `overlap at p=${p}`).toBeLessThanOrEqual(1e-9);
        expect(width(from) + width(to), `coverage at p=${p}`).toBeCloseTo(100, 9);
      }
    });

    it("reveals the confirmed label from the inline start", () => {
      const to = span(dir, "to", 0.25);
      if (dir === "ltr") expect(to[0]).toBe(0);
      else expect(to[1]).toBe(100);
    });

    it("moves both clips on one transition, so the edges cannot drift apart", () => {
      const { from, to } = label(dir, "off");
      const transition = computed(from, "transition");
      expect(transition).toMatch(/clip-path/);
      expect(computed(to, "transition")).toBe(transition);
    });
  });
});
