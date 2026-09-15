import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrandListResponseSchema,
  CategoryListResponseSchema,
  ErrorEnvelopeSchema,
} from "@avenick/contracts";

/**
 * GET /api/v1/categories and /api/v1/brands — the two reads that draw a menu.
 *
 * The category tree is the one place the mobile contract deliberately differs
 * in SHAPE rather than in content: `/api/categories` nests `children` to
 * unbounded depth, which is a recursive schema most Dart generators flatten
 * badly or refuse. `parentId` + `depth`, emitted depth-first, is the same
 * information in a shape every generator handles.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueUser: vi.fn(),
  findManyCategories: vi.fn(),
  groupByProducts: vi.fn(),
  findManyBrands: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true, count: 1, limit: 120, resetAt: Date.now() + 60_000 }),
  clientIpFrom: () => "203.0.113.7",
}));
vi.mock("@avenick/observability", () => {
  const log = { error: mocks.logError, info: vi.fn(), warn: vi.fn(), debug: vi.fn(), with: () => log };
  return { log, instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }) };
});
vi.mock("@avenick/database", () => ({
  db: {
    user: { findUnique: mocks.findUniqueUser },
    category: { findMany: mocks.findManyCategories },
    product: { groupBy: mocks.groupByProducts },
    brand: { findMany: mocks.findManyBrands },
  },
  PUBLIC_CATALOG_SELLER: { is: { deletedAt: null, status: "ACTIVE" } },
}));

import { GET as GET_BRANDS } from "../../brands/route";
import { GET as GET_CATEGORIES } from "../route";

function category(id: string, slug: string, parentId: string | null, imageUrl: string | null = null) {
  return { id, slug, nameEn: slug, nameAr: `ع-${slug}`, parentId, imageUrl };
}

function get(path: string) {
  return new NextRequest(`https://customer.test${path}`, { method: "GET" });
}

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(null);
});

describe("the flattened category tree", () => {
  it("emits depth-first with parentId and depth, and conforms to the contract", async () => {
    mocks.findManyCategories.mockResolvedValue([
      category("root", "ppe", null),
      category("mid", "head-protection", "root"),
      category("leaf", "helmets", "mid"),
      category("other", "tools", null),
    ]);
    // Imported catalogues put products on the LEAF, which is why a direct count
    // reads zero for every branch.
    mocks.groupByProducts.mockResolvedValue([
      { categoryId: "leaf", _count: { _all: 12 } },
      { categoryId: "other", _count: { _all: 3 } },
    ]);

    const response = await GET_CATEGORIES(get("/api/v1/categories"));
    expect(response.status).toBe(200);
    const { data } = CategoryListResponseSchema.parse(await response.json());

    expect(data.map((node) => [node.slug, node.parentId, node.depth, node.productCount])).toEqual([
      ["ppe", null, 0, 12],
      ["head-protection", "root", 1, 12],
      ["helmets", "mid", 2, 12],
      ["tools", null, 0, 3],
    ]);
  });

  it("counts what is BENEATH a node, so a branch never reads zero", async () => {
    mocks.findManyCategories.mockResolvedValue([
      category("root", "ppe", null),
      category("a", "gloves", "root"),
      category("b", "helmets", "root"),
    ]);
    mocks.groupByProducts.mockResolvedValue([
      { categoryId: "a", _count: { _all: 4 } },
      { categoryId: "b", _count: { _all: 7 } },
    ]);
    const { data } = CategoryListResponseSchema.parse(
      await (await GET_CATEGORIES(get("/api/v1/categories"))).json(),
    );
    expect(data.find((node) => node.slug === "ppe")!.productCount).toBe(11);
  });

  it("omits a branch that dead-ends", async () => {
    mocks.findManyCategories.mockResolvedValue([
      category("root", "ppe", null),
      category("empty", "obsolete", null),
    ]);
    mocks.groupByProducts.mockResolvedValue([{ categoryId: "root", _count: { _all: 2 } }]);
    const { data } = CategoryListResponseSchema.parse(
      await (await GET_CATEGORIES(get("/api/v1/categories"))).json(),
    );
    expect(data.map((node) => node.slug)).toEqual(["ppe"]);
  });

  it("does not advertise products behind a withdrawn seller", async () => {
    mocks.findManyCategories.mockResolvedValue([category("root", "ppe", null)]);
    mocks.groupByProducts.mockResolvedValue([{ categoryId: "root", _count: { _all: 1 } }]);
    await GET_CATEGORIES(get("/api/v1/categories"));
    expect(mocks.groupByProducts.mock.calls[0]![0].where).toEqual({
      status: "ACTIVE",
      deletedAt: null,
      isPubliclyDiscoverable: true,
      seller: { is: { deletedAt: null, status: "ACTIVE" } },
    });
  });

  it("terminates on a malformed parent chain instead of spinning", async () => {
    // A row pointing at itself, and a two-node cycle. Neither can hang a public
    // route.
    mocks.findManyCategories.mockResolvedValue([
      category("self", "self", "self"),
      category("x", "x", "y"),
      category("y", "y", "x"),
    ]);
    mocks.groupByProducts.mockResolvedValue([{ categoryId: "self", _count: { _all: 1 } }]);
    const response = await GET_CATEGORIES(get("/api/v1/categories"));
    expect(response.status).toBe(200);
    const { data } = CategoryListResponseSchema.parse(await response.json());
    expect(data.map((node) => node.slug)).toEqual(["self"]);
  });

  it("is served to a guest, without touching the session", async () => {
    mocks.findManyCategories.mockResolvedValue([category("root", "ppe", null)]);
    mocks.groupByProducts.mockResolvedValue([{ categoryId: "root", _count: { _all: 1 } }]);
    expect((await GET_CATEGORIES(get("/api/v1/categories"))).status).toBe(200);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
});

describe("brands", () => {
  const brand = (id: string, nameEn: string, count = 4) => ({
    id,
    slug: nameEn.toLowerCase(),
    nameEn,
    nameAr: null,
    logoUrl: "/brands/demo-x.svg",
    _count: { products: count },
  });

  it("answers a cursor-paginated page conforming to the contract", async () => {
    mocks.findManyBrands.mockResolvedValue([brand("b1", "Ansell"), brand("b2", "Honeywell")]);
    const response = await GET_BRANDS(get("/api/v1/brands?limit=1"));
    expect(response.status).toBe(200);
    const page = BrandListResponseSchema.parse(await response.json());
    expect(page.data).toEqual([{
      id: "b1",
      slug: "ansell",
      nameEn: "Ansell",
      nameAr: null,
      // An SVG URL states no pixel size, so the logo ships without one — it
      // used to ship as null, and the brand strip was a row of gaps.
      logo: { url: "https://customer.test/brands/demo-x.svg", alt: "Ansell" },
      productCount: 4,
    }]);
    expect(page.meta.hasMore).toBe(true);
  });

  it("cursors on (nameEn, id), because brand names tie", async () => {
    mocks.findManyBrands.mockResolvedValue([brand("b1", "Ansell"), brand("b2", "Ansell")]);
    const first = BrandListResponseSchema.parse(
      await (await GET_BRANDS(get("/api/v1/brands?limit=1"))).json(),
    );
    mocks.findManyBrands.mockResolvedValue([brand("b2", "Ansell")]);
    const second = BrandListResponseSchema.parse(
      await (await GET_BRANDS(
        get(`/api/v1/brands?limit=1&cursor=${encodeURIComponent(first.meta.cursor!)}`),
      )).json(),
    );
    expect(second.data[0]!.id).toBe("b2");
    expect(mocks.findManyBrands.mock.calls[1]![0].where.AND).toEqual([
      { OR: [{ nameEn: { gt: "Ansell" } }, { nameEn: "Ansell", id: { gt: "b1" } }] },
    ]);
  });

  it("lists only brands whose listing has something in it", async () => {
    mocks.findManyBrands.mockResolvedValue([]);
    await GET_BRANDS(get("/api/v1/brands"));
    expect(mocks.findManyBrands.mock.calls[0]![0].where.products).toEqual({
      some: {
        status: "ACTIVE",
        deletedAt: null,
        isPubliclyDiscoverable: true,
        seller: { is: { deletedAt: null, status: "ACTIVE" } },
      },
    });
  });

  it("answers 400 for a malformed cursor", async () => {
    const response = await GET_BRANDS(get("/api/v1/brands?cursor=!!!"));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.cursor).toBeDefined();
    expect(mocks.findManyBrands).not.toHaveBeenCalled();
  });

  it("refuses a limit above the contract's ceiling", async () => {
    const response = await GET_BRANDS(get("/api/v1/brands?limit=500"));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.limit).toBeDefined();
  });
});
