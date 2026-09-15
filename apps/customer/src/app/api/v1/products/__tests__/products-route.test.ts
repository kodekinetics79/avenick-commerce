import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ErrorEnvelopeSchema,
  ProductDetailResponseSchema,
  ProductListResponseSchema,
} from "@avenick/contracts";

/**
 * GET /api/v1/products and /api/v1/products/{slug}.
 *
 * Every successful body below is parsed through the CONTRACT's own response
 * schema rather than an inline shape written here — a test that restates the
 * envelope is a second source of truth for the envelope. `ProductListResponseSchema`
 * is `pageEnvelope(ProductCard)`, which is `.strict()` and REQUIRES `meta`, so
 * a page that forgot its cursor block fails at the parse.
 *
 * What is stubbed is only what needs a database. The price a card prints, the
 * currency it prints it in and the stock badge beside it are all resolved by
 * the real `toCatalogListDto` — the same projection the web storefront renders
 * from — so an assertion here that the tile costs 42.5 AED is an assertion
 * about the platform's own price resolution, not about a number this file
 * chose.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueUser: vi.fn(),
  findManyProducts: vi.fn(),
  findManyCategories: vi.fn(),
  attachProductRatings: vi.fn(),
  listProducts: vi.fn(),
  getProductBySlug: vi.fn(),
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
    product: { findMany: mocks.findManyProducts },
    category: { findMany: mocks.findManyCategories },
  },
  PRODUCT_LIST_INCLUDE: {},
  PUBLIC_CATALOG_SELLER: { is: { deletedAt: null, status: "ACTIVE" } },
  attachProductRatings: mocks.attachProductRatings,
  listProducts: mocks.listProducts,
  getProductBySlug: mocks.getProductBySlug,
  // Mirrors services/products.ts: no reviews means NO rating, never zero stars.
  shapeProductRating: (average: number | null, count: number) =>
    count > 0 && average != null ? { average: Math.round(average * 100) / 100, count } : null,
}));

import { GET as GET_DETAIL } from "../[slug]/route";
import { GET as GET_LIST } from "../route";

function card(id: string, createdAt: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    sellerId: "sel_1",
    categoryId: "cat_1",
    brandId: "brand_1",
    sku: `SKU-${id}`,
    slug: `product-${id}`,
    nameEn: `Product ${id}`,
    nameAr: `منتج ${id}`,
    descriptionEn: "A long description a card never draws.",
    descriptionAr: null,
    status: "ACTIVE",
    isPubliclyDiscoverable: true,
    isB2CEnabled: true,
    isB2BEnabled: true,
    origin: "AE",
    weight: 1.2,
    tags: ["ppe"],
    moq: 1,
    createdAt: new Date(createdAt),
    images: [{ url: "https://placehold.co/600x600/FFD700/000?text=Helmet", altEn: "Helmet", altAr: null, isPrimary: true, sortOrder: 0 }],
    prices: [{ id: "pp1", type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 42.5, vatRate: 5, isActive: true }],
    inventory: [{ variantId: null, qty: 10, reservedQty: 0 }],
    variants: [],
    category: { nameEn: "PPE", nameAr: "معدات", slug: "ppe" },
    brand: { nameEn: "Honeywell", nameAr: null },
    seller: { businessNameEn: "Gulf Safety", businessNameAr: null, tier: "GOLD", rating: null },
    ...overrides,
  };
}

function get(path: string) {
  return new NextRequest(`https://customer.test${path}`, { method: "GET" });
}

async function pageOf(response: Response) {
  // Parsing through the contract IS the assertion.
  return ProductListResponseSchema.parse(await response.json());
}

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

function signedInConsumer(companyId: string | null = null) {
  mocks.auth.mockResolvedValue({ user: { id: "usr_1" } });
  mocks.findUniqueUser.mockResolvedValue({
    role: "CONSUMER",
    status: "ACTIVE",
    deletedAt: null,
    companyMember: companyId
      ? { companyId, isActive: true, company: { status: "ACTIVE", deletedAt: null } }
      : null,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.findManyCategories.mockResolvedValue([]);
  mocks.attachProductRatings.mockImplementation(async (rows: Array<{ id: string }>) =>
    rows.map((row) => ({ ...row, rating: null })));
  mocks.findManyProducts.mockResolvedValue([card("a", "2026-03-01T00:00:00.000Z")]);
});

describe("the page a phone scrolls", () => {
  it("answers { data, meta } and nothing else", async () => {
    const response = await GET_LIST(get("/api/v1/products"));
    expect(response.status).toBe(200);
    const body = (await response.clone().json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["data", "meta"]);

    const page = await pageOf(response);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]).toEqual({
      id: "a",
      slug: "product-a",
      nameEn: "Product a",
      nameAr: "منتج a",
      image: {
        url: "https://placehold.co/600x600/FFD700/000?text=Helmet",
        width: 600,
        height: 600,
        alt: "Helmet",
      },
      price: { amount: 42.5, currency: "AED", vatRatePercent: 5, isFrom: false },
      moq: 1,
      availability: "IN_STOCK",
      priceTiered: false,
      rating: null,
      brandName: "Honeywell",
      sellableInChannel: true,
    });
  });

  it("carries no total, and asks the database for no count", async () => {
    // /api/products runs an unbounded count() beside every page query, once per
    // relevance tier, on a public route sharing a pool with checkout.
    const response = await GET_LIST(get("/api/v1/products"));
    const body = (await response.json()) as { meta: Record<string, unknown> };
    expect(Object.keys(body.meta).sort()).toEqual(["cursor", "hasMore"]);
    expect(mocks.findManyProducts).toHaveBeenCalledTimes(1);
  });

  it("reads one row more than it returns, and that row IS hasMore", async () => {
    mocks.findManyProducts.mockResolvedValue([
      card("a", "2026-03-03T00:00:00.000Z"),
      card("b", "2026-03-02T00:00:00.000Z"),
      card("c", "2026-03-01T00:00:00.000Z"),
    ]);
    const page = await pageOf(await GET_LIST(get("/api/v1/products?limit=2")));
    expect(mocks.findManyProducts.mock.calls[0]![0].take).toBe(3);
    expect(page.data.map((row) => row.id)).toEqual(["a", "b"]);
    expect(page.meta.hasMore).toBe(true);
    // The cursor points at the last row RETURNED, never at the probe row.
    expect(page.meta.cursor).not.toBeNull();
  });

  it("has no next cursor on the last page", async () => {
    const page = await pageOf(await GET_LIST(get("/api/v1/products?limit=2")));
    expect(page.meta).toEqual({ cursor: null, hasMore: false });
  });
});

describe("the cursor", () => {
  it("round-trips, and resumes strictly after the last row shown", async () => {
    mocks.findManyProducts.mockResolvedValue([
      card("a", "2026-03-03T00:00:00.000Z"),
      card("b", "2026-03-02T00:00:00.000Z"),
    ]);
    const first = await pageOf(await GET_LIST(get("/api/v1/products?limit=1")));
    expect(first.data.map((row) => row.id)).toEqual(["a"]);

    const cursor = first.meta.cursor!;
    mocks.findManyProducts.mockResolvedValue([card("b", "2026-03-02T00:00:00.000Z")]);
    const second = await pageOf(
      await GET_LIST(get(`/api/v1/products?limit=1&cursor=${encodeURIComponent(cursor)}`)),
    );
    expect(second.data.map((row) => row.id)).toEqual(["b"]);

    // The keyset itself: strictly after (createdAt, id), with the id tiebreak
    // that stops two products created in the same millisecond colliding.
    const where = mocks.findManyProducts.mock.calls[1]![0].where;
    expect(where.AND).toEqual([
      {
        OR: [
          { createdAt: { lt: new Date("2026-03-03T00:00:00.000Z") } },
          { createdAt: new Date("2026-03-03T00:00:00.000Z"), id: { gt: "a" } },
        ],
      },
    ]);
  });

  it("keys on the column the caller sorted by, not always on the date", async () => {
    mocks.findManyProducts.mockResolvedValue([
      card("a", "2026-03-03T00:00:00.000Z", { moq: 5 }),
      card("b", "2026-03-02T00:00:00.000Z", { moq: 5 }),
    ]);
    const first = await pageOf(await GET_LIST(get("/api/v1/products?limit=1&sort=moq_asc")));
    const cursor = first.meta.cursor!;

    await GET_LIST(get(`/api/v1/products?limit=1&sort=moq_asc&cursor=${encodeURIComponent(cursor)}`));
    // moq defaults to 1 for nearly the whole catalogue, so this ordering is
    // almost all ties — which is exactly why the id half is not optional.
    expect(mocks.findManyProducts.mock.calls[1]![0].where.AND).toEqual([
      { OR: [{ moq: { gt: 5 } }, { moq: 5, id: { gt: "a" } }] },
    ]);
  });

  it("answers 400 for a malformed cursor, naming the field", async () => {
    const response = await GET_LIST(get("/api/v1/products?cursor=not-a-cursor"));
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe("validation_failed");
    expect(error.fieldErrors?.cursor).toBeDefined();
    expect(mocks.findManyProducts).not.toHaveBeenCalled();
  });

  it("answers 400 for a well-formed cursor holding something else", async () => {
    // base64url of `{"m":"x"}` — it decodes, so only the shape check catches it.
    const foreign = Buffer.from(JSON.stringify({ m: "x" }), "utf8").toString("base64url");
    const response = await GET_LIST(get(`/api/v1/products?cursor=${foreign}`));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe("validation_failed");
  });

  it("refuses a cursor issued by the OTHER paging path", async () => {
    // A relevance search pages by rank; a plain browse pages by keyset.
    // Replaying one against the other would silently resume in the wrong place,
    // which is worse than a refusal: an infinite-scroll list would loop.
    mocks.listProducts.mockResolvedValue({
      products: [{ ...card("a", "2026-03-01T00:00:00.000Z"), rating: null }],
      total: 5,
      page: 1,
      limit: 1,
      totalPages: 5,
      search: { status: "ran", term: "bolt", strategy: "text" },
    });
    const searched = await pageOf(await GET_LIST(get("/api/v1/products?limit=1&search=bolt")));
    const rankCursor = searched.meta.cursor!;

    const response = await GET_LIST(get(`/api/v1/products?limit=1&cursor=${encodeURIComponent(rankCursor)}`));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.cursor).toBeDefined();
  });
});

describe("the channel prices the catalogue, it does not filter it", () => {
  it("lists what is publicly discoverable behind a live seller, and nothing narrower", async () => {
    await GET_LIST(get("/api/v1/products"));
    const where = mocks.findManyProducts.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      status: "ACTIVE",
      deletedAt: null,
      isPubliclyDiscoverable: true,
      seller: { is: { deletedAt: null, status: "ACTIVE" } },
    });
    // The reversal: filtering here returned an EMPTY consumer catalogue, because
    // the pilot importer writes isB2CEnabled:false on every row it creates.
    expect(Object.keys(where)).not.toContain("isB2CEnabled");
    expect(Object.keys(where)).not.toContain("isB2BEnabled");
  });

  it("STATES sellability per row instead of hiding the row", async () => {
    mocks.findManyProducts.mockResolvedValue([
      card("sellable", "2026-03-03T00:00:00.000Z", { isB2CEnabled: true }),
      // The whole pilot catalogue: priced in B2C, sellable to nobody.
      card("quote-only", "2026-03-02T00:00:00.000Z", { isB2CEnabled: false }),
    ]);
    const page = await pageOf(await GET_LIST(get("/api/v1/products")));
    expect(page.data.map((row) => [row.id, row.sellableInChannel])).toEqual([
      ["sellable", true],
      ["quote-only", false],
    ]);
  });

  it("does not read the PRICED channel as sellability", async () => {
    // The trap: a row priced in B2C with isB2CEnabled:false. Reading
    // `channel === "B2C"` as "sellable" is true for every production row and
    // correct for none.
    mocks.findManyProducts.mockResolvedValue([
      card("a", "2026-03-01T00:00:00.000Z", {
        isB2CEnabled: false,
        prices: [{ id: "pp1", type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 42.5, vatRate: 5, isActive: true }],
      }),
    ]);
    const page = await pageOf(await GET_LIST(get("/api/v1/products")));
    // A B2C price IS resolved...
    expect(page.data[0]!.price).toEqual({ amount: 42.5, currency: "AED", vatRatePercent: 5, isFrom: false });
    // ...and the product still cannot be bought.
    expect(page.data[0]!.sellableInChannel).toBe(false);
  });

  it("answers the B2B channel from isB2BEnabled, not from the B2C column", async () => {
    signedInConsumer("comp_1");
    mocks.findManyProducts.mockResolvedValue([
      card("a", "2026-03-01T00:00:00.000Z", { isB2CEnabled: false, isB2BEnabled: true }),
    ]);
    const page = await pageOf(await GET_LIST(get("/api/v1/products?channel=B2B")));
    expect(page.data[0]!.sellableInChannel).toBe(true);
  });

  it("refuses business pricing to a guest", async () => {
    const response = await GET_LIST(get("/api/v1/products?channel=B2B"));
    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe("unauthenticated");
    expect(mocks.findManyProducts).not.toHaveBeenCalled();
  });

  it("refuses business pricing to a signed-in buyer with no live company", async () => {
    signedInConsumer(null);
    const response = await GET_LIST(get("/api/v1/products?channel=B2B"));
    expect(response.status).toBe(403);
    expect((await errorOf(response)).code).toBe("forbidden");
    expect(mocks.findManyProducts).not.toHaveBeenCalled();
  });

  it("serves business pricing to a member of an active company", async () => {
    signedInConsumer("comp_1");
    mocks.findManyProducts.mockResolvedValue([
      card("a", "2026-03-01T00:00:00.000Z", {
        prices: [{ id: "pp1", type: "B2B", currency: "AED", minQty: 1, maxQty: null, price: 30, vatRate: 5, isActive: true }],
      }),
    ]);
    const page = await pageOf(await GET_LIST(get("/api/v1/products?channel=B2B")));
    // The channel resolves the B2B price bands; it does not narrow the listing.
    expect(page.data[0]!.price).toEqual({ amount: 30, currency: "AED", vatRatePercent: 5, isFrom: false });
  });
});

describe("filters", () => {
  it("rejects a filter it cannot apply rather than answering a wider question", async () => {
    // `listProducts` drops `inStock: false` on the floor — its baseWhere applies
    // the predicate only when the flag is truthy. Answering "out of stock only"
    // with the whole catalogue is the defect `?b2c=true` was.
    mocks.listProducts.mockResolvedValue({
      products: [], total: 0, page: 1, limit: 24, totalPages: 0, search: { status: "none" },
    });
    const response = await GET_LIST(get("/api/v1/products?search=bolt&inStock=false"));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.inStock).toBeDefined();
    expect(mocks.listProducts).not.toHaveBeenCalled();
  });

  it("refuses a malformed filter at the contract, before any query runs", async () => {
    const response = await GET_LIST(get("/api/v1/products?minRating=9"));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.minRating).toBeDefined();
  });

  it("refuses an empty MOQ window, which would read as a reasonable filter", async () => {
    const response = await GET_LIST(get("/api/v1/products?moqMin=100&moqMax=10"));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe("validation_failed");
  });

  it("resolves a category to its whole active subtree, not an exact-slug dead end", async () => {
    mocks.findManyCategories.mockResolvedValue([
      { id: "cat_root", slug: "ppe", nameEn: "PPE", nameAr: "معدات", parentId: null, imageUrl: null },
      { id: "cat_leaf", slug: "helmets", nameEn: "Helmets", nameAr: "خوذ", parentId: "cat_root", imageUrl: null },
    ]);
    await GET_LIST(get("/api/v1/products?categorySlug=ppe"));
    expect(mocks.findManyProducts.mock.calls[0]![0].where.categoryId).toEqual({
      in: ["cat_root", "cat_leaf"],
    });
  });

  it("matches nothing for a category that does not exist, rather than everything", async () => {
    mocks.findManyCategories.mockResolvedValue([]);
    await GET_LIST(get("/api/v1/products?categorySlug=nope"));
    expect(mocks.findManyProducts.mock.calls[0]![0].where.categoryId).toEqual({ in: [] });
  });
});

describe("a search, which still ranks by relevance", () => {
  it("delegates to the service rather than restating its tier predicates", async () => {
    mocks.listProducts.mockResolvedValue({
      // `listProducts` attaches the review aggregate to every row it returns.
      products: [{ ...card("a", "2026-03-01T00:00:00.000Z"), rating: null }],
      total: 3,
      page: 1,
      limit: 1,
      totalPages: 3,
      search: { status: "ran", term: "M6", strategy: "identifier" },
    });
    const page = await pageOf(await GET_LIST(get("/api/v1/products?limit=1&search=M6")));
    expect(mocks.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "M6",
        status: "ACTIVE",
        publiclyDiscoverable: true,
        page: 1,
        limit: 1,
        // Not narrowed by channel — otherwise a search for "bolt" would find
        // nothing while browsing the same category found four hundred.
        b2c: undefined,
        b2b: undefined,
      }),
    );
    expect(page.meta.hasMore).toBe(true);
    // The next page resumes at rank position 2, not at an offset the client chose.
    const next = page.meta.cursor!;
    await GET_LIST(get(`/api/v1/products?limit=1&search=M6&cursor=${encodeURIComponent(next)}`));
    expect(mocks.listProducts.mock.calls[1]![0]).toMatchObject({ page: 2 });
  });

  it("propagates a REFUSED search as a stop, not as an endless empty scroll", async () => {
    // A term below the trigram floor and not identifier-shaped is refused by
    // the service with zero rows. `hasMore: false` stops the app paging.
    mocks.listProducts.mockResolvedValue({
      products: [], total: 0, page: 1, limit: 24, totalPages: 0,
      search: { status: "too_short", term: "a", minLength: 3 },
    });
    const page = await pageOf(await GET_LIST(get("/api/v1/products?search=a")));
    expect(page.data).toEqual([]);
    expect(page.meta).toEqual({ cursor: null, hasMore: false });
  });
});

describe("one product, in full", () => {
  const DETAIL = {
    id: "prod_1",
    sellerId: "sel_1",
    sku: "SKU-1",
    slug: "safety-helmet",
    nameEn: "Safety Helmet",
    nameAr: "خوذة أمان",
    descriptionEn: "Shell and harness.",
    descriptionAr: null,
    status: "ACTIVE",
    isB2CEnabled: true,
    isB2BEnabled: true,
    isPubliclyDiscoverable: true,
    origin: "AE",
    weight: { toString: () => "1.250" },
    moq: 2,
    tags: ["ppe", "head"],
    images: [
      { url: "https://placehold.co/600x600/FFD700/000?text=Front", altEn: "Front", altAr: null, isPrimary: true, sortOrder: 0 },
      { url: "https://assets.test/no-size.jpg", altEn: null, altAr: null, isPrimary: false, sortOrder: 1 },
    ],
    prices: [{ type: "B2C", currency: "AED", minQty: 1, maxQty: null, price: { toString: () => "42.50" }, vatRate: { toString: () => "5.00" } }],
    inventory: [{ variantId: null, available: 40 }],
    variants: [],
    brand: { id: "brand_1", nameEn: "Honeywell", nameAr: null },
    category: { id: "cat_1", slug: "ppe", nameEn: "PPE", nameAr: "معدات" },
    seller: {
      id: "sel_1",
      businessNameEn: "Gulf Safety",
      businessNameAr: null,
      tier: "GOLD",
      city: "Dubai",
      country: "AE",
      reviewSummary: { averageRating: 4.5, reviewCount: 12 },
    },
    reviews: [],
    reviewTotal: 0,
  };

  function detail(slug = "safety-helmet", query = "") {
    return GET_DETAIL(get(`/api/v1/products/${slug}${query}`), { params: { slug } });
  }

  beforeEach(() => {
    mocks.getProductBySlug.mockResolvedValue(DETAIL);
    mocks.attachProductRatings.mockResolvedValue([{ id: "prod_1", rating: { average: 4.2, count: 9 } }]);
  });

  it("answers the fat DTO, and it conforms to the contract", async () => {
    const response = await detail();
    expect(response.status).toBe(200);
    const { data } = ProductDetailResponseSchema.parse(await response.json());
    expect(data).toMatchObject({
      id: "prod_1",
      sku: "SKU-1",
      moq: 2,
      availability: "IN_STOCK",
      availableQty: 40,
      origin: "AE",
      weightKg: 1.25,
      tags: ["ppe", "head"],
      channel: "B2C",
      brand: { id: "brand_1", nameEn: "Honeywell", nameAr: null },
      category: { id: "cat_1", slug: "ppe" },
      rating: { average: 4.2, count: 9 },
      sellableInChannel: true,
    });
    expect(data.prices).toEqual([
      { channel: "B2C", currency: "AED", minQty: 1, maxQty: null, price: 42.5, vatRatePercent: 5 },
    ]);
    expect(data.seller.rating).toEqual({ average: 4.5, count: 12 });
  });

  it("ships an image whose size is unknown, unsized rather than guessed", async () => {
    const { data } = ProductDetailResponseSchema.parse(await (await detail()).json());
    // Both pictures reach the gallery. The one whose URL states its size
    // carries it so the client can reserve the box; the other says nothing.
    expect(data.images).toHaveLength(2);
    expect(data.images[0]).toMatchObject({ width: 600, height: 600 });
    expect(data.images[1]!.width).toBeUndefined();
    expect(data.images[1]!.url).toBe("https://assets.test/no-size.jpg");
  });

  it("does not inline review bodies", async () => {
    const { data } = ProductDetailResponseSchema.parse(await (await detail()).json());
    expect(Object.keys(data)).not.toContain("reviews");
  });

  it("uses the product's own aggregate, not the twenty reviews the service loaded", async () => {
    await detail();
    expect(mocks.attachProductRatings).toHaveBeenCalledWith([{ id: "prod_1" }]);
  });

  it("is 404 when the product is gone", async () => {
    mocks.getProductBySlug.mockResolvedValue(null);
    const response = await detail("missing");
    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe("not_found");
  });

  it("OPENS an unsellable product and says so, rather than 404ing every card", async () => {
    // It used to 404 here, which made every tile in a quote-only catalogue tap
    // through to a not-found screen.
    mocks.getProductBySlug.mockResolvedValue({ ...DETAIL, isB2CEnabled: false });
    const response = await detail();
    expect(response.status).toBe(200);
    const { data } = ProductDetailResponseSchema.parse(await response.json());
    expect(data.sellableInChannel).toBe(false);
    // The priced channel is still B2C. The two answers are different fields
    // because they are different questions.
    expect(data.channel).toBe("B2C");
  });

  it("is still 404 for a product the listing does not show", async () => {
    // Public discoverability and a live seller remain the gate; an indexed URL
    // that outlives its listing lands on an item checkout will refuse.
    mocks.getProductBySlug.mockResolvedValue({ ...DETAIL, isPubliclyDiscoverable: false });
    expect((await detail()).status).toBe(404);
  });

  it("refuses a business deep link to a guest before reading the catalogue", async () => {
    const response = await detail("safety-helmet", "?channel=B2B");
    expect(response.status).toBe(401);
    expect(mocks.getProductBySlug).not.toHaveBeenCalled();
  });

  it("rejects a slug the contract's pattern refuses, before any query", async () => {
    const response = await GET_DETAIL(get("/api/v1/products/Not_A_Slug"), {
      params: { slug: "Not_A_Slug" },
    });
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.slug).toBeDefined();
  });

  it("NEVER lets a body the contract does not describe reach the client", async () => {
    // The wrapper validates the response. A projection that grew a field, or
    // lost one, fails here instead of reaching a Dart client that cannot parse it.
    mocks.getProductBySlug.mockResolvedValue({ ...DETAIL, sku: "" });
    const response = await detail();
    expect(response.status).toBe(500);
    expect((await errorOf(response)).code).toBe("internal");
    expect(mocks.logError).toHaveBeenCalledWith(
      "v1 response violates its contract",
      expect.anything(),
      expect.objectContaining({ route: "/api/v1/products/[slug]" }),
    );
  });
});
