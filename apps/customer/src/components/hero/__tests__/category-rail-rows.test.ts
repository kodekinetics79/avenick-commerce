import { describe, expect, it } from "vitest";
import {
  CHILD_ROW_PX,
  MAX_CHILDREN_PER_ROOT,
  RAIL_LIST_PX,
  ROOT_ROW_PX,
  categoryRailRows,
  childRowBudget,
} from "../category-rail-rows";

interface Node {
  slug: string;
  children?: Node[];
}

function root(slug: string, childCount: number): Node {
  return { slug, children: Array.from({ length: childCount }, (_, i) => ({ slug: `${slug}-${i + 1}` })) };
}

/**
 * The desktop category rail beside the hero stretched to the slab's height and
 * listed only the seven top-level categories, leaving over half of the panel
 * empty. It now shows the taxonomy one level deeper, within a row budget that
 * must never make the rail taller than the band it shares with the hero.
 */
describe("categoryRailRows", () => {
  it("fits the live catalogue's seven roots without growing the band, in Arabic line heights", () => {
    const budget = childRowBudget(7);
    expect(budget).toBeGreaterThan(7);
    expect(7 * ROOT_ROW_PX + budget * CHILD_ROW_PX).toBeLessThanOrEqual(RAIL_LIST_PX);
    expect(7 * ROOT_ROW_PX + (budget + 1) * CHILD_ROW_PX).toBeGreaterThan(RAIL_LIST_PX);
  });

  it("deals first children to every root before any root gets a second", () => {
    const roots = [root("a", 3), root("b", 3), root("c", 3)];
    const rows = categoryRailRows(roots, 4);
    expect(rows.map((row) => row.children.map((c) => c.slug))).toEqual([["a-1", "a-2"], ["b-1"], ["c-1"]]);
  });

  it("keeps every root, in order, and shows each root's children as a prefix of its own", () => {
    const roots = [root("a", 0), root("b", 5), root("c", 1)];
    const rows = categoryRailRows(roots, 50);
    expect(rows.map((row) => row.root.slug)).toEqual(["a", "b", "c"]);
    expect(rows[0]!.children).toEqual([]);
    expect(rows[1]!.children.map((c) => c.slug)).toEqual(["b-1", "b-2", "b-3"]);
    expect(rows[1]!.children).toHaveLength(MAX_CHILDREN_PER_ROOT);
    expect(rows[2]!.children.map((c) => c.slug)).toEqual(["c-1"]);
  });

  it("never spends more than the budget, and shows no children when there is no room", () => {
    const roots = Array.from({ length: 9 }, (_, i) => root(`r${i}`, 3));
    const total = (budget: number) => categoryRailRows(roots, budget).reduce((sum, row) => sum + row.children.length, 0);
    expect(total(5)).toBe(5);
    expect(total(0)).toBe(0);
    expect(total(-3)).toBe(0);
    expect(childRowBudget(15)).toBe(0);
    expect(categoryRailRows(Array.from({ length: 15 }, (_, i) => root(`r${i}`, 2))).every((row) => row.children.length === 0)).toBe(true);
  });

  it("treats a root with no children array as a root with no children", () => {
    expect(categoryRailRows([{ slug: "bare" } as Node], 10)).toEqual([{ root: { slug: "bare" }, children: [] }]);
  });
});
