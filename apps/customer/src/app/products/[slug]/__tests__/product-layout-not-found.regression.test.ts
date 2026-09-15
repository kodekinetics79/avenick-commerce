import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  // The server renderer's request cache; a pass-through is the same read.
  cache: <T,>(fn: T) => fn,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@avenick/utils/portal-config", () => ({ platformName: () => "Platform", selfOrigin: () => "https://shop.example" }));
vi.mock("../product-meta", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../product-meta")>()),
  readProductMeta: mocks.read,
}));
vi.mock("@avenick/database", () => ({ db: {}, PUBLIC_CATALOG_SELLER: {} }));

import ProductLayout, { generateMetadata } from "../layout";

/**
 * An unknown product slug keeps a head: a noindex and the site's own title.
 *
 * THE DEFECT. The first version of this layout called notFound() inside
 * generateMetadata as well as in the layout body. Next 14.2 answers a not-found
 * thrown during metadata by resolving the head again for the not-found view,
 * over the same segment tree, so this generateMetadata ran twice and threw
 * twice, and the 404 was served with no <title> at all (curl of
 * /products/this-slug-does-not-exist-xyz on the dev server: a robots noindex
 * and nothing else). The soft 404 it replaced had at least said the platform's
 * name.
 *
 * What these hold: generateMetadata never throws for an unservable slug and
 * says noindex instead; the layout body is the one place that refuses the URL;
 * and a product that exists, or one that could not be read, is not refused.
 */

beforeEach(() => {
  mocks.read.mockReset();
  mocks.notFound.mockClear();
});

const params = { params: { slug: "nothing-here" } };
const product = {
  slug: "p1",
  status: "ACTIVE",
  isPubliclyDiscoverable: true,
  nameEn: "Conduit adapter",
  nameAr: "",
  descriptionEn: null,
  descriptionAr: null,
  sku: "SKU-1",
  brand: null,
  images: [],
};

describe("the product layout's head for a slug that names nothing", () => {
  it("is a noindex head, not a thrown not-found that would erase the head", async () => {
    mocks.read.mockResolvedValue({ kind: "missing" });
    await expect(generateMetadata(params)).resolves.toEqual({ robots: { index: false, follow: false } });
    mocks.read.mockResolvedValue({ kind: "found", product: { ...product, status: "SUSPENDED" } });
    await expect(generateMetadata(params)).resolves.toEqual({ robots: { index: false, follow: false } });
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("is refused by the layout body, which is what makes it a 404", async () => {
    mocks.read.mockResolvedValue({ kind: "missing" });
    await expect(ProductLayout({ ...params, children: null })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("does not refuse a product that exists, or one the read could not answer for", async () => {
    mocks.read.mockResolvedValue({ kind: "found", product });
    await expect(ProductLayout({ ...params, children: "page" })).resolves.toBe("page");
    expect((await generateMetadata(params)).title).toBe("Conduit adapter");
    mocks.read.mockResolvedValue({ kind: "unknown" });
    await expect(ProductLayout({ ...params, children: "page" })).resolves.toBe("page");
    await expect(generateMetadata(params)).resolves.toEqual({});
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
