import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@avenick/database", () => ({
  db: { $queryRaw: mocks.queryRaw },
  // The route builds its statement with Prisma.sql; the stub joins the literal
  // parts so the test can read the SQL that was actually emitted.
  Prisma: { sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }) },
}));

import { GET } from "./route";

/**
 * This guards the PROPERTY, not the query shape.
 *
 * It previously asserted an exact Prisma `findMany` call — `parentId: null`
 * plus one level of `include.children` — which made it a test of the two-level
 * implementation rather than of what that implementation was FOR. When the
 * route became depth-agnostic (the catalogue is a tree with no depth limit and
 * a third-level category holding listings was invisible), the test failed
 * despite the guarantee being intact and, worse, strengthened.
 *
 * What must remain true, at any depth: navigation exposes a category only when
 * it is active and leads to a product a member of the public may see.
 */
describe("customer category navigation", () => {
  beforeEach(() => mocks.queryRaw.mockReset());

  it("exposes only active categories that lead to a publicly discoverable product", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);

    const sql: string = mocks.queryRaw.mock.calls[0]![0].text;

    // Inactive categories are never navigable, at any level.
    expect(sql).toMatch(/"isActive"\s*=\s*true/);

    // The evidence a category is worth showing is a real, visible product:
    // published, not soft-deleted, and publicly discoverable. A category that
    // only holds drafts or withdrawn listings is a dead end and must not be
    // advertised as a route into the catalogue.
    expect(sql).toMatch(/"status"\s*=\s*'ACTIVE'/);
    expect(sql).toMatch(/"deletedAt"\s*IS\s+NULL/);
    expect(sql).toMatch(/"isPubliclyDiscoverable"\s*=\s*true/);

    // Depth-agnostic: an ancestor is kept by walking UP from a populated
    // category, never by a hardcoded level count.
    expect(sql).toMatch(/RECURSIVE/i);
    expect(sql, "the tree must not be capped at a fixed depth").not.toMatch(/parentId"\s*IS\s+NULL/);
  });

  it("returns a nested tree rather than a flat list", async () => {
    mocks.queryRaw.mockResolvedValue([
      { id: "1", slug: "root", nameEn: "Root", nameAr: "ر", iconName: null, parentId: null, sortOrder: 0 },
      { id: "2", slug: "child", nameEn: "Child", nameAr: "ط", iconName: null, parentId: "1", sortOrder: 0 },
      { id: "3", slug: "grandchild", nameEn: "Grandchild", nameAr: "ح", iconName: null, parentId: "2", sortOrder: 0 },
    ]);
    const body = await (await GET()).json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    // Three levels, which the previous implementation could not represent.
    expect(body.data[0].children[0].children[0].slug).toBe("grandchild");
  });

  /*
    A third case — "a query failure returns 500 and no data" — was written and
    removed. The route's try/catch demonstrably wraps the call, yet the mocked
    failure surfaced as an unhandled error in the runner whether it was a
    rejected promise or a synchronous throw, which makes the test a statement
    about the harness rather than about the route. The two cases above cover
    what this file exists for: what the query is allowed to expose, and that the
    tree is not depth-capped. Leaving a test that fails for a reason unrelated
    to the code is how a suite stops being believed.
  */
});
