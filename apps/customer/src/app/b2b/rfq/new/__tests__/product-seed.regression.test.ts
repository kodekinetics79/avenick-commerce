import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@avenick/database", () => ({
  db: { product: { findFirst: mocks.findFirst } },
  PUBLIC_CATALOG_SELLER: { is: { deletedAt: null, status: "ACTIVE" } },
}));

import { rfqHrefForProduct } from "@/components/product/product-facts";
import { readRfqProductSeed } from "../product-seed";

/**
 * "Request a quote" lands on a request for THAT product.
 *
 * THE DEFECT. The product page, the catalogue tile and the cart drawer all
 * linked the RFQ form with `?supplier=<id>&product=<id>` (the supplier card with
 * `?supplier=` alone), and the form read neither. Anonymous visitors were sent
 * through sign-in with the parameters intact, only for them to be discarded: the
 * buyer arrived on a blank form and retyped the name of the product they had
 * just pressed the button on. On a catalogue that is quoted rather than carted,
 * that form is the purchase path.
 *
 * What these hold: the id is resolved under the product API's visibility rule
 * (so the seed cannot name a listing this viewer could not open), the line opens
 * with the catalogue's own name, SKU and a quantity a supplier would accept, and
 * anything malformed or failing seeds nothing rather than breaking the form.
 */

beforeEach(() => {
  mocks.findFirst.mockReset();
});

const row = { nameEn: "Wire & Cable Lubricant", nameAr: "مزلق الأسلاك والكابلات", sku: "3M-WCL-1", moq: 72, variants: [] };

describe("readRfqProductSeed", () => {
  it("seeds the line with the product's name, SKU and MOQ", async () => {
    mocks.findFirst.mockResolvedValue(row);
    const seed = await readRfqProductSeed({ product: "cprod123" }, { locale: "en", isCompanyMember: false });
    expect(seed).toEqual({ description: "Wire & Cable Lubricant · 3M-WCL-1", quantity: "72" });
  });

  it("reads under the product API's rule: active, live seller, and discoverable for a viewer without a company", async () => {
    mocks.findFirst.mockResolvedValue(row);
    await readRfqProductSeed({ product: "cprod123" }, { locale: "en", isCompanyMember: false });
    const { where } = mocks.findFirst.mock.calls[0]![0];
    expect(where).toMatchObject({
      id: "cprod123",
      deletedAt: null,
      status: "ACTIVE",
      seller: { is: { deletedAt: null, status: "ACTIVE" } },
    });
    expect(where.OR).toEqual([{ isPubliclyDiscoverable: true }]);
  });

  it("lets a company member seed from a business-only listing, as the business product request does", async () => {
    mocks.findFirst.mockResolvedValue(row);
    await readRfqProductSeed({ product: "cprod123" }, { locale: "en", isCompanyMember: true });
    expect(mocks.findFirst.mock.calls[0]![0].where.OR).toEqual([{ isPubliclyDiscoverable: true }, { isB2BEnabled: true }]);
  });

  it("seeds nothing for a product the rule refuses", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(await readRfqProductSeed({ product: "chidden1" }, { locale: "en", isCompanyMember: false })).toBeUndefined();
  });

  it("never queries for a malformed or repeated id", async () => {
    for (const product of [undefined, "", "has space", "a".repeat(65), ["cprod123", "cprod456"], "../etc"]) {
      expect(await readRfqProductSeed({ product }, { locale: "en", isCompanyMember: false })).toBeUndefined();
    }
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("keeps the buyer's quantity only when a supplier would accept it", async () => {
    mocks.findFirst.mockResolvedValue(row);
    const seedFor = async (qty: unknown) =>
      (await readRfqProductSeed({ product: "cprod123", qty }, { locale: "en", isCompanyMember: false }))?.quantity;
    expect(await seedFor("144")).toBe("144");
    expect(await seedFor("10")).toBe("72");
    expect(await seedFor("72.5")).toBe("72");
    expect(await seedFor("5000000")).toBe("72");
    expect(await seedFor("abc")).toBe("72");
  });

  it("names the chosen variant and quotes against its SKU", async () => {
    mocks.findFirst.mockResolvedValue({ ...row, variants: [{ nameEn: "5 L drum", nameAr: null, sku: "3M-WCL-5L" }] });
    const seed = await readRfqProductSeed({ product: "cprod123", variant: "cvar1" }, { locale: "en", isCompanyMember: false });
    expect(seed?.description).toBe("Wire & Cable Lubricant · 5 L drum · 3M-WCL-5L");
    expect(mocks.findFirst.mock.calls[0]![0].select.variants.where).toEqual({ id: { in: ["cvar1"] }, isActive: true });
  });

  it("reads no variant rows when the link names none", async () => {
    mocks.findFirst.mockResolvedValue(row);
    await readRfqProductSeed({ product: "cprod123" }, { locale: "en", isCompanyMember: false });
    expect(mocks.findFirst.mock.calls[0]![0].select.variants.where).toEqual({ id: { in: [] }, isActive: true });
  });

  it("writes the line in the reader's language", async () => {
    mocks.findFirst.mockResolvedValue(row);
    const seed = await readRfqProductSeed({ product: "cprod123" }, { locale: "ar", isCompanyMember: false });
    expect(seed?.description).toBe("مزلق الأسلاك والكابلات · 3M-WCL-1");
  });

  it("leaves the form blank rather than failing it when the catalogue cannot be read", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.findFirst.mockRejectedValue(new Error("connection reset"));
    expect(await readRfqProductSeed({ product: "cprod123" }, { locale: "en", isCompanyMember: false })).toBeUndefined();
    consoleError.mockRestore();
  });
});

describe("rfqHrefForProduct", () => {
  it("carries ids and the quantity, never text a URL could forge", () => {
    expect(rfqHrefForProduct({ sellerId: "s1", productId: "p1" })).toBe("/b2b/rfq/new?supplier=s1&product=p1");
    expect(rfqHrefForProduct({ sellerId: "s1", productId: "p1", variantId: "v1", quantity: 144 }))
      .toBe("/b2b/rfq/new?supplier=s1&product=p1&variant=v1&qty=144");
    expect(rfqHrefForProduct({ sellerId: "s 1", productId: "p&1", quantity: 0 }))
      .toBe("/b2b/rfq/new?supplier=s+1&product=p%261");
  });
});
