import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The category scope on `getTrendingProducts`, asserted at the query boundary.
 *
 * The pure tests in product-signals.test.ts show the ranking maths does not
 * know a scope exists. What they cannot show is the part that runs in SQL: that
 * the category set joins the visibility predicate INSIDE the aggregate, that
 * the HAVING threshold and the candidate cut are byte-identical to the
 * unscoped call, that the winning rows are re-checked against the scope at
 * fetch time, and that a scope which names nothing is answered with an empty
 * rail rather than the catalogue-wide one.
 *
 * Nothing here opens a connection. The database client is replaced with a
 * recorder, and the test reads back exactly what the service asked of it.
 */

const fake = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  signalGroupBy: vi.fn(),
  signalFindMany: vi.fn(),
  productFindMany: vi.fn(),
  reviewGroupBy: vi.fn(),
}));

vi.mock("../index", async () => {
  // The barrel re-exports @prisma/client (enums the service modules import at
  // load time) and the client. Everything else it exports is a service this
  // test never calls.
  const prisma = await import("@prisma/client");
  return {
    ...prisma,
    db: {
      $queryRaw: fake.queryRaw,
      productViewSignal: { groupBy: fake.signalGroupBy, findMany: fake.signalFindMany },
      product: { findMany: fake.productFindMany },
      productReview: { groupBy: fake.reviewGroupBy },
    },
  };
});

import { setCacheStore } from "../cache";
import {
  MIN_TRENDING_PRODUCTS,
  MIN_VIEWS_FOR_TRENDING,
  TRENDING_CANDIDATE_FACTOR,
  TRENDING_MIN_CANDIDATES,
  getTrendingProducts,
  trendingWindowStart,
  utcDayStart,
} from "../services/product-signals";
import { publicProductWhere } from "../services/storefront-sections";

// Every call must reach the recorder: a cache hit would make the second call
// in a test look like a database call that never happened.
setCacheStore({ get: async () => null, set: async () => {} });

const NOW = new Date("2026-09-05T11:30:00.000Z");
const LIMIT = 4;

/** A grouped candidate as Prisma returns it from the windowed SUM. */
function candidate(productId: string, views: number) {
  return { productId, _sum: { views } };
}

/** One bucket per candidate, all today, so the decay does not reorder them. */
function bucketsFor(candidates: Array<{ productId: string; _sum: { views: number } }>) {
  return candidates.map((c) => ({ productId: c.productId, bucketDate: utcDayStart(NOW), views: c._sum.views }));
}

/** The winning rows, in an order that is NOT the ranking, as findMany would. */
function rowsFor(ids: string[], categoryId: string) {
  return [...ids].reverse().map((id) => ({ id, categoryId }));
}

const groupByCall = (n = 0) => fake.signalGroupBy.mock.calls[n]![0] as Record<string, any>;
const productFetchCall = (n = 0) => fake.productFindMany.mock.calls[n]![0] as Record<string, any>;

beforeEach(() => {
  vi.resetAllMocks();
  fake.reviewGroupBy.mockResolvedValue([]);
  fake.queryRaw.mockResolvedValue([]);
  fake.signalGroupBy.mockResolvedValue([]);
  fake.signalFindMany.mockResolvedValue([]);
  fake.productFindMany.mockResolvedValue([]);
});

/** Wire the recorder so `ids` qualify and win, inside `subtree`. */
function arrangeField(subtree: string[], ids: string[], views = 50) {
  const field = ids.map((id, i) => candidate(id, views - i));
  fake.queryRaw.mockResolvedValue(subtree.map((id) => ({ id })));
  fake.signalGroupBy.mockResolvedValue(field);
  fake.signalFindMany.mockResolvedValue(bucketsFor(field));
  fake.productFindMany.mockResolvedValue(rowsFor(ids, subtree[0] ?? "cat_root"));
}

describe("getTrendingProducts — category scope at the query boundary", () => {
  it("resolves the category's active subtree first, by id, with the recursive walk listProducts uses", async () => {
    arrangeField(["cat_root", "cat_child", "cat_grandchild"], ["p1", "p2", "p3"]);

    await getTrendingProducts({ categoryId: "cat_root", now: NOW, limit: LIMIT });

    expect(fake.queryRaw).toHaveBeenCalledTimes(1);
    // A tagged template: the SQL fragments, then the one parameter — the id
    // travels as a bound value, never as text in the statement.
    const [fragments, ...values] = fake.queryRaw.mock.calls[0]!;
    const sql = (fragments as readonly string[]).join("?");
    expect(values).toEqual(["cat_root"]);
    expect(sql).toMatch(/WITH RECURSIVE category_tree AS/);
    expect(sql).toMatch(/WHERE id = \? AND "isActive" = true/);
    expect(sql).toMatch(/INNER JOIN category_tree parent ON child\."parentId" = parent\.id/);
    expect(sql).toMatch(/WHERE child\."isActive" = true/);
  });

  it("counts inside the subtree — the scope joins visibility in the aggregate, not after it", async () => {
    arrangeField(["cat_root", "cat_child"], ["p1", "p2", "p3"]);

    await getTrendingProducts({ categoryId: "cat_root", now: NOW, limit: LIMIT });

    expect(groupByCall().where).toEqual({
      bucketDate: { gte: trendingWindowStart(NOW, 7) },
      product: { ...publicProductWhere(undefined), categoryId: { in: ["cat_root", "cat_child"] } },
    });
  });

  it("asks the database the same question inside a category as outside it, except for the category", async () => {
    arrangeField(["cat_root", "cat_child"], ["p1", "p2", "p3"]);
    await getTrendingProducts({ now: NOW, limit: LIMIT });
    await getTrendingProducts({ categoryId: "cat_root", now: NOW, limit: LIMIT });

    const unscoped = groupByCall(0);
    const scoped = groupByCall(1);

    // The threshold and the cut, stated in the module's own constants: a scope
    // that could reach either would be a scope that could fill a rail.
    for (const call of [unscoped, scoped]) {
      expect(call.having).toEqual({ views: { _sum: { gte: MIN_VIEWS_FOR_TRENDING } } });
      expect(call.take).toBe(Math.max(TRENDING_MIN_CANDIDATES, LIMIT * TRENDING_CANDIDATE_FACTOR));
      expect(call.orderBy).toEqual({ _sum: { views: "desc" } });
      expect(call.by).toEqual(["productId"]);
    }

    // Everything else is identical once the one added clause is removed.
    const { categoryId, ...scopedProduct } = scoped.where.product;
    expect(categoryId).toEqual({ in: ["cat_root", "cat_child"] });
    expect({ ...scoped, where: { ...scoped.where, product: scopedProduct } }).toEqual(unscoped);
  });

  it("re-checks the scope, with visibility, when the winning rows are fetched", async () => {
    arrangeField(["cat_root", "cat_child"], ["p1", "p2", "p3"]);

    const rows = await getTrendingProducts({ categoryId: "cat_root", now: NOW, limit: LIMIT });

    expect(productFetchCall().where).toEqual({
      ...publicProductWhere(undefined),
      categoryId: { in: ["cat_root", "cat_child"] },
      id: { in: ["p1", "p2", "p3"] },
    });
    // And the rows come back in rank order, not in the order the fetch returned.
    expect(rows.map((row) => row.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("applies the quorum inside the category exactly as it applies it to the catalogue", async () => {
    // Two products qualify inside the category. The catalogue-wide rail refuses
    // two; so does the category's — and it says so before spending the bucket
    // and row queries, exactly like the unscoped path.
    fake.queryRaw.mockResolvedValue([{ id: "cat_root" }]);
    fake.signalGroupBy.mockResolvedValue([candidate("p1", 40), candidate("p2", 30)]);
    expect(MIN_TRENDING_PRODUCTS).toBeGreaterThan(2);

    const rows = await getTrendingProducts({ categoryId: "cat_root", now: NOW, limit: LIMIT });

    expect(rows).toEqual([]);
    expect(fake.signalFindMany).not.toHaveBeenCalled();
    expect(fake.productFindMany).not.toHaveBeenCalled();
  });

  it("answers a category that resolves to nothing with an empty rail, and never counts", async () => {
    // Unknown or inactive id: the walk returns no rows.
    fake.queryRaw.mockResolvedValue([]);
    expect(await getTrendingProducts({ categoryId: "cat_missing", now: NOW })).toEqual([]);
    expect(fake.signalGroupBy).not.toHaveBeenCalled();

    // An id that never reaches a query, and an explicitly empty set: each is a
    // question about a category, and the whole catalogue is not the answer.
    expect(await getTrendingProducts({ categoryId: "not an id", now: NOW })).toEqual([]);
    expect(await getTrendingProducts({ categoryIds: [], now: NOW })).toEqual([]);
    expect(fake.queryRaw).toHaveBeenCalledTimes(1);
    expect(fake.signalGroupBy).not.toHaveBeenCalled();
  });

  it("uses an explicit category set verbatim, and unions it with a root's subtree", async () => {
    arrangeField(["cat_root", "cat_child"], ["p1", "p2", "p3"]);

    await getTrendingProducts({ categoryIds: ["cat_x", "cat_y", "cat_x"], now: NOW, limit: LIMIT });
    // No expansion was asked for, so no walk was run.
    expect(fake.queryRaw).not.toHaveBeenCalled();
    expect(groupByCall(0).where.product.categoryId).toEqual({ in: ["cat_x", "cat_y"] });

    await getTrendingProducts({ categoryId: "cat_root", categoryIds: ["cat_x"], now: NOW, limit: LIMIT });
    expect(fake.queryRaw).toHaveBeenCalledTimes(1);
    const scoped = groupByCall(1).where.product.categoryId.in as string[];
    expect(scoped).toHaveLength(3);
    expect(scoped).toEqual(expect.arrayContaining(["cat_root", "cat_child", "cat_x"]));
  });

  it("leaves the unscoped call exactly as it was", async () => {
    arrangeField([], ["p1", "p2", "p3"]);

    const rows = await getTrendingProducts({ now: NOW, limit: LIMIT });

    expect(fake.queryRaw).not.toHaveBeenCalled();
    expect(groupByCall().where.product).toEqual(publicProductWhere(undefined));
    expect(productFetchCall().where).toEqual({ ...publicProductWhere(undefined), id: { in: ["p1", "p2", "p3"] } });
    expect(rows.map((row) => row.id)).toEqual(["p1", "p2", "p3"]);
  });
});
