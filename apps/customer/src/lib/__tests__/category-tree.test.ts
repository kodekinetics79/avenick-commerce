import { describe, expect, it } from "vitest";
import { buildCategoryTree, categoryTrail, type CategoryRow } from "../category-tree";

const row = (id: string, parentId: string | null, sortOrder = 0): CategoryRow => ({
  id,
  slug: id,
  nameEn: id.toUpperCase(),
  nameAr: id,
  iconName: null,
  parentId,
  sortOrder,
});

/**
 * The catalogue is a self-referencing tree with no depth limit, and the API
 * that feeds navigation used to return exactly two levels. A third-level
 * category holding real listings was invisible, and so was every product under
 * it. These cover the shapes that broke it and the ones that would break it
 * next.
 */
describe("buildCategoryTree", () => {
  it("nests four levels, which is the depth that was previously impossible", () => {
    const tree = buildCategoryTree([
      row("a", null),
      row("b", "a"),
      row("c", "b"),
      row("d", "c"),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.children[0]!.children[0]!.children[0]!.slug).toBe("d");
  });

  it("keeps the query's ordering at every level, not just the root", () => {
    // Rows arrive already ordered by sortOrder; the builder must not reorder.
    const tree = buildCategoryTree([
      row("root", null, 0),
      row("first", "root", 1),
      row("second", "root", 2),
    ]);
    expect(tree[0]!.children.map((c) => c.slug)).toEqual(["first", "second"]);
  });

  it("treats a row whose parent is absent as a root rather than dropping it", () => {
    // Dropping is the worse failure: an odd menu position is visible and
    // fixable, a missing branch looks like the catalogue does not stock it.
    const tree = buildCategoryTree([row("orphan", "gone")]);
    expect(tree.map((n) => n.slug)).toEqual(["orphan"]);
  });

  it("does not spin on a category that is its own parent", () => {
    const tree = buildCategoryTree([row("loop", "loop")]);
    expect(tree.map((n) => n.slug)).toEqual(["loop"]);
  });

  it("returns nothing for no rows", () => {
    expect(buildCategoryTree([])).toEqual([]);
  });
});

describe("categoryTrail", () => {
  const tree = buildCategoryTree([
    row("electrical", null),
    row("breakers", "electrical"),
    row("molded-case", "breakers"),
  ]);

  it("returns the full ancestor chain, root first", () => {
    expect(categoryTrail(tree, "molded-case").map((n) => n.slug)).toEqual([
      "electrical",
      "breakers",
      "molded-case",
    ]);
  });

  it("includes the category itself when it is a root", () => {
    expect(categoryTrail(tree, "electrical").map((n) => n.slug)).toEqual(["electrical"]);
  });

  it("returns empty for an unknown slug, so a caller renders no trail rather than a wrong one", () => {
    expect(categoryTrail(tree, "nope")).toEqual([]);
  });
});
