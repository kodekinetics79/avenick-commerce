import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@avenick/database", () => ({
  db: { product: { findFirst: mocks.findFirst } },
  PUBLIC_CATALOG_SELLER: { is: { deletedAt: null, status: "ACTIVE" } },
}));

import {
  isUnservable,
  productMetadata,
  readProductMeta,
  SITE_SHARE_CARD,
  type ProductMeta,
} from "../product-meta";

/**
 * A product page has a head of its own, and a slug that names nothing is a 404.
 *
 * THE DEFECT. /products/[slug] is a client page that fetches on mount, so it
 * could export no metadata: every product in the catalogue was titled with the
 * bare platform name, carried the site description and share card, and had no
 * canonical. The server HTML contained the product's name zero times. And
 * /products/<anything> answered 200 — the not-found plate and its noindex
 * arrived only after hydration — while /api/products/<same> said 404.
 *
 * What these hold: the lean read uses the API's row rule and selects no price,
 * stock or rating; a missing or non-ACTIVE product is unservable (the layout
 * turns that into notFound() before anything streams); a listing that is not
 * publicly discoverable is NOT a 404 — the layout cannot see ?b2b=true, which
 * legitimately serves it to company members — but its head says nothing about
 * it; and a discoverable product's head is built from its own fields only.
 */

// A block body on purpose: vitest runs a function RETURNED from beforeEach as
// that test's teardown, and mockReset() returns the mock itself.
beforeEach(() => {
  mocks.findFirst.mockReset();
});

const product: ProductMeta = {
  slug: "pilot-3m-itm-004049-aabf56f5",
  status: "ACTIVE",
  isPubliclyDiscoverable: true,
  nameEn: "Wire & Cable Lubricants",
  nameAr: "مزلقات الأسلاك والكابلات",
  descriptionEn: "A clear, low-friction gel for pulling cable through conduit.",
  descriptionAr: "هلام شفاف منخفض الاحتكاك لسحب الكابلات عبر المواسير.",
  sku: "ITM-004049",
  brand: { nameEn: "3M", nameAr: null },
  images: [{ url: "https://images.test/wcl.png", altEn: "Gel tub", altAr: null }],
};

const describeFallback = ({ name, brand, sku }: { name: string; brand: string; sku: string }) =>
  `fallback:${name}|${brand}|${sku}`;
const build = (overrides: Partial<ProductMeta> = {}, locale: "en" | "ar" = "en") =>
  productMetadata({ ...product, ...overrides }, { locale, siteName: "Platform", describe: describeFallback });

describe("readProductMeta", () => {
  it("reads by the API's row rule and selects nothing a head must not say", async () => {
    mocks.findFirst.mockResolvedValue(product);
    expect(await readProductMeta("pilot-3m-itm-004049-aabf56f5")).toEqual({ kind: "found", product });
    const { where, select } = mocks.findFirst.mock.calls[0]![0];
    expect(where).toEqual({
      slug: "pilot-3m-itm-004049-aabf56f5",
      deletedAt: null,
      seller: { is: { deletedAt: null, status: "ACTIVE" } },
    });
    for (const forbidden of ["prices", "inventory", "reviews", "variants", "rating", "commercialMetadata"]) {
      expect(select).not.toHaveProperty(forbidden);
    }
  });

  it("tells a missing row apart from a failed read", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(await readProductMeta("nothing")).toEqual({ kind: "missing" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.findFirst.mockRejectedValue(new Error("connection reset"));
    expect(await readProductMeta("anything")).toEqual({ kind: "unknown" });
    consoleError.mockRestore();
  });
});

describe("isUnservable", () => {
  it("is the API's 404: no row, or a row that is not ACTIVE", () => {
    expect(isUnservable({ kind: "missing" })).toBe(true);
    expect(isUnservable({ kind: "found", product: { ...product, status: "SUSPENDED" } })).toBe(true);
    expect(isUnservable({ kind: "found", product: { ...product, status: "DRAFT" } })).toBe(true);
  });

  it("does not 404 a business-only listing, which ?b2b=true serves to company members", () => {
    expect(isUnservable({ kind: "found", product: { ...product, isPubliclyDiscoverable: false } })).toBe(false);
  });

  it("does not 404 a product it could not read", () => {
    expect(isUnservable({ kind: "unknown" })).toBe(false);
  });
});

describe("productMetadata", () => {
  it("titles the document with the product and states its canonical, card and description", () => {
    const meta = build();
    expect(meta.title).toBe("Wire & Cable Lubricants");
    expect(meta.description).toBe("A clear, low-friction gel for pulling cable through conduit.");
    expect(meta.alternates).toEqual({ canonical: "/products/pilot-3m-itm-004049-aabf56f5" });
    expect(meta.openGraph).toMatchObject({
      type: "website",
      siteName: "Platform",
      title: "Wire & Cable Lubricants",
      url: "/products/pilot-3m-itm-004049-aabf56f5",
      images: [{ url: "https://images.test/wcl.png", alt: "Gel tub" }],
    });
    expect(meta.twitter).toMatchObject({ title: "Wire & Cable Lubricants", images: ["https://images.test/wcl.png"] });
  });

  it("gives a gated listing a noindex head that does not name it", () => {
    const meta = build({ isPubliclyDiscoverable: false });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
    expect(JSON.stringify(meta)).not.toContain("Lubricants");
  });

  it("cuts a long description at a word, never through one", () => {
    const long = `${"Industrial conduit lubricant ".repeat(8)}end`;
    const description = String(build({ descriptionEn: long }).description);
    expect(description.length).toBeLessThanOrEqual(155);
    expect(description.endsWith("…")).toBe(true);
    expect(long.startsWith(description.slice(0, -1))).toBe(true);
    expect(long.charAt(description.length - 1)).toBe(" ");
  });

  it("falls back to the message tree's sentence, never to the other language's paragraph", () => {
    expect(build({ descriptionEn: null }).description).toBe("fallback:Wire & Cable Lubricants|3M|ITM-004049");
    expect(build({ descriptionAr: null }, "ar").description).toBe("fallback:مزلقات الأسلاك والكابلات|3M|ITM-004049");
    expect(build({ brand: null, descriptionEn: "   " }).description).toBe("fallback:Wire & Cable Lubricants||ITM-004049");
  });

  it("follows the reader's language for the name and description", () => {
    const meta = build({}, "ar");
    expect(meta.title).toBe("مزلقات الأسلاك والكابلات");
    expect(meta.description).toBe(product.descriptionAr);
  });

  it("keeps the site's card when the product has no photograph, because a child openGraph replaces the parent's", () => {
    const meta = build({ images: [] });
    expect(meta.openGraph).toMatchObject({ images: [{ url: SITE_SHARE_CARD, alt: "Platform" }] });
    expect(meta.twitter).toMatchObject({ images: [SITE_SHARE_CARD] });
  });

  it("asserts no price, offer, stock or rating", () => {
    const serialized = JSON.stringify(build()).toLowerCase();
    for (const claim of ["price", "offer", "rating", "stock", "sar", "aed"]) expect(serialized).not.toContain(claim);
  });
});
