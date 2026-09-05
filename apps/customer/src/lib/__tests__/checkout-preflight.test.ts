import { describe, expect, it } from "vitest";
import {
  preflightCheckout,
  productFactsFromCatalogDetail,
  validateShippingAddress,
  vatJurisdictionFor,
  type PreflightInput,
  type PreflightLine,
  type ProductFacts,
} from "../checkout-preflight";
import type { ShippingCoverage } from "../checkout-shipping-coverage";

const address = { label: "Office", line1: "12 Sheikh Zayed Road", city: "Dubai", country: "AE" };

const coverage: ShippingCoverage = {
  configured: true,
  zones: [
    {
      code: "GCC",
      nameEn: "GCC mainland",
      nameAr: "دول الخليج",
      countries: ["AE", "SA"],
      fallbackPrice: 25,
      freeOverSubtotal: null,
      ratedCurrencies: ["AED"],
    },
  ],
};

const facts = (overrides: Partial<ProductFacts> = {}): ProductFacts => ({
  productId: "p1",
  moq: 1,
  weightKg: 1.5,
  activeVariantIds: [],
  isB2CEnabled: true,
  availableQty: 100,
  ...overrides,
});

const line = (overrides: Partial<PreflightLine> = {}): PreflightLine => ({
  id: "l1",
  productId: "p1",
  qty: 2,
  currency: "AED",
  channel: "B2C",
  vatRate: 5,
  ...overrides,
});

const run = (overrides: Partial<PreflightInput> = {}) =>
  preflightCheckout({
    lines: [line()],
    address,
    currency: "AED",
    coverage,
    facts: { l1: facts() },
    ...overrides,
  });

const kinds = (result: ReturnType<typeof preflightCheckout>) => result.refusals.map((r) => r.kind);

describe("validateShippingAddress mirrors CreateOrderSchema.shippingAddress", () => {
  it("accepts the schema's minimums exactly", () => {
    expect(validateShippingAddress({ label: "H", line1: "abc", city: "D", country: "AE" })).toEqual({});
  });

  it("names the field and the rule that would 400", () => {
    expect(validateShippingAddress({ label: "  ", line1: "ab", city: "", country: "" })).toEqual({
      label: "REQUIRED",
      line1: "TOO_SHORT",
      city: "REQUIRED",
      country: "REQUIRED",
    });
    expect(validateShippingAddress({ ...address, label: "x".repeat(81) }).label).toBe("TOO_LONG");
    expect(validateShippingAddress({ ...address, country: "US" }).country).toBe("UNSUPPORTED_COUNTRY");
  });
});

describe("vatJurisdictionFor", () => {
  it("names the statutory rate the server will apply, from the shared table", () => {
    expect(vatJurisdictionFor("ae")).toEqual({ country: "AE", ratePercent: 5 });
    expect(vatJurisdictionFor("SA")).toEqual({ country: "SA", ratePercent: 15 });
    // Zero-rated is a real answer, not a missing one.
    expect(vatJurisdictionFor("QA")).toEqual({ country: "QA", ratePercent: 0 });
  });

  it("returns null rather than a guess for an unknown destination", () => {
    expect(vatJurisdictionFor("US")).toBeNull();
    expect(vatJurisdictionFor("")).toBeNull();
    // A Record probe must not read Object.prototype members as rates.
    expect(vatJurisdictionFor("constructor")).toBeNull();
  });
});

describe("productFactsFromCatalogDetail", () => {
  const dto = {
    id: "p1",
    moq: 5,
    weight: "1.250",
    isB2CEnabled: true,
    inventory: [{ inStock: true, availableQty: 40, status: "IN_STOCK" }],
    variants: [
      { id: "v1", availableQty: 3, availabilityStatus: "IN_STOCK" },
      { id: "v2", availableQty: 0, availabilityStatus: "UNCONFIRMED" },
    ],
  };

  it("reads the base identity's stock and the Decimal weight string", () => {
    expect(productFactsFromCatalogDetail(dto)).toEqual({
      productId: "p1",
      moq: 5,
      weightKg: 1.25,
      activeVariantIds: ["v1", "v2"],
      isB2CEnabled: true,
      availableQty: 40,
    });
  });

  it("reads the chosen variant's stock, and null for unconfirmed stock", () => {
    expect(productFactsFromCatalogDetail(dto, "v1")?.availableQty).toBe(3);
    expect(productFactsFromCatalogDetail(dto, "v2")?.availableQty).toBeNull();
    expect(productFactsFromCatalogDetail({ ...dto, inventory: [{ status: "UNCONFIRMED", availableQty: 0 }] })?.availableQty).toBeNull();
  });

  it("keeps an unweighed product unweighed and rejects an unrecognisable shape", () => {
    expect(productFactsFromCatalogDetail({ ...dto, weight: null })?.weightKg).toBeNull();
    expect(productFactsFromCatalogDetail({ id: "p1" })).toBeNull();
    expect(productFactsFromCatalogDetail(null)).toBeNull();
  });
});

describe("preflightCheckout", () => {
  it("lets a clean B2C order through and states how delivery will be quoted", () => {
    const result = run();
    expect(result.refusals).toEqual([]);
    expect(result.notices).toEqual([]);
    expect(result.canSubmit).toBe(true);
    expect(result.jurisdiction).toEqual({ country: "AE", ratePercent: 5 });
    expect(result.vatRateDiffers).toBe(false);
    expect(result.delivery).toEqual({
      kind: "QUOTED",
      zone: { code: "GCC", nameEn: "GCC mainland", nameAr: "دول الخليج" },
      basis: "WEIGHT_BAND",
      fallbackPrice: 25,
      freeOverSubtotal: null,
    });
  });

  it("refuses a destination no active zone covers and offers nothing else (ShippingZoneUnavailableError)", () => {
    const result = run({ address: { ...address, country: "OM" } });
    expect(result.refusals).toEqual([{ kind: "DESTINATION_UNSERVED", country: "OM" }]);
    expect(result.delivery).toEqual({ kind: "UNSERVED", country: "OM" });
    expect(result.canSubmit).toBe(false);
  });

  it("refuses a destination two zones claim (ShippingZoneAmbiguousError)", () => {
    const twin = { ...coverage.zones[0]!, code: "TWIN" };
    const result = run({ coverage: { configured: true, zones: [coverage.zones[0]!, twin] } });
    expect(result.refusals).toEqual([{ kind: "DESTINATION_AMBIGUOUS", country: "AE", zoneCodes: ["GCC", "TWIN"] }]);
  });

  it("refuses a country outside the schema enum before consulting the tariff", () => {
    const result = run({ address: { ...address, country: "US" } });
    expect(kinds(result)).toEqual(["DESTINATION_UNSUPPORTED"]);
    expect(result.addressErrors.country).toBe("UNSUPPORTED_COUNTRY");
    expect(result.delivery).toEqual({ kind: "UNKNOWN" });
  });

  it("does not pre-judge the destination when the tariff could not be read, or is not configured", () => {
    expect(run({ coverage: null }).delivery).toEqual({ kind: "UNKNOWN" });
    expect(run({ coverage: null }).canSubmit).toBe(true);
    const none = run({ coverage: { configured: false, zones: [] } });
    expect(none.delivery).toEqual({ kind: "NOT_CONFIGURED" });
    expect(none.canSubmit).toBe(true);
  });

  it("discloses the flat fallback rate when a line has no recorded weight (basis FALLBACK)", () => {
    const result = run({ facts: { l1: facts({ weightKg: null }) } });
    expect(result.refusals).toEqual([]);
    expect(result.notices).toEqual([{ kind: "DELIVERY_FALLBACK_RATE", lineIds: ["l1"], zoneCode: "GCC", fallbackPrice: 25 }]);
    expect(result.delivery).toMatchObject({ kind: "QUOTED", basis: "FALLBACK" });
  });

  it("refuses a weighed basket in a currency the zone publishes no band for (ShippingRateUnavailableError)", () => {
    const result = run({
      currency: "SAR",
      lines: [line({ currency: "SAR" })],
    });
    expect(kinds(result)).toEqual(["RATE_UNAVAILABLE"]);
    // With a free threshold the server may never reach the bands, so the
    // refusal is no longer certain and must not be issued.
    const withThreshold = run({
      currency: "SAR",
      lines: [line({ currency: "SAR" })],
      coverage: { configured: true, zones: [{ ...coverage.zones[0]!, freeOverSubtotal: 500 }] },
    });
    expect(withThreshold.refusals).toEqual([]);
    // Unweighed baskets take the fallback price, which needs no band.
    const unweighed = run({ currency: "SAR", lines: [line({ currency: "SAR" })], facts: { l1: facts({ weightKg: null }) } });
    expect(kinds(unweighed)).toEqual([]);
  });

  it("states the MOQ from the catalogue, falling back to the cart's own when unverified (assertMinimumOrderQuantity)", () => {
    expect(run({ facts: { l1: facts({ moq: 5 }) } }).refusals).toEqual([{ kind: "BELOW_MOQ", lineId: "l1", moq: 5, qty: 2 }]);
    expect(run({ lines: [line({ moq: 3 })], facts: {} }).refusals).toEqual([{ kind: "BELOW_MOQ", lineId: "l1", moq: 3, qty: 2 }]);
    expect(run({ lines: [line({ qty: 1.5 })] }).refusals).toEqual([{ kind: "BELOW_MOQ", lineId: "l1", moq: 1, qty: 1.5 }]);
  });

  it("mirrors the variant rules: required when active variants exist, unavailable when the chosen one is not active", () => {
    expect(run({ facts: { l1: facts({ activeVariantIds: ["v1"] }) } }).refusals).toEqual([{ kind: "VARIANT_REQUIRED", lineId: "l1" }]);
    expect(run({ lines: [line({ variantId: "v9" })], facts: { l1: facts({ activeVariantIds: ["v1"] }) } }).refusals)
      .toEqual([{ kind: "VARIANT_UNAVAILABLE", lineId: "l1" }]);
    expect(run({ lines: [line({ variantId: "v1" })], facts: { l1: facts({ activeVariantIds: ["v1"] }) } }).refusals).toEqual([]);
  });

  it("mirrors the stock rule, and treats unconfirmed stock as the zero the server will find", () => {
    expect(run({ facts: { l1: facts({ availableQty: 1 }) } }).refusals)
      .toEqual([{ kind: "INSUFFICIENT_STOCK", lineId: "l1", available: 1, qty: 2, unconfirmed: false }]);
    expect(run({ facts: { l1: facts({ availableQty: null }) } }).refusals)
      .toEqual([{ kind: "INSUFFICIENT_STOCK", lineId: "l1", available: 0, qty: 2, unconfirmed: true }]);
  });

  it("routes B2B lines and non-B2C products away from the B2C endpoint", () => {
    expect(kinds(run({ lines: [line({ channel: "B2B" })] }))).toContain("B2B_LINES");
    expect(kinds(run({ facts: { l1: facts({ isB2CEnabled: false }) } }))).toEqual(["CHANNEL_NOT_B2C"]);
  });

  it("refuses a basket that is not in the checkout currency", () => {
    expect(kinds(run({ lines: [line(), line({ id: "l2", productId: "p2", currency: "SAR" })], facts: { l1: facts(), l2: facts({ productId: "p2" }) } })))
      .toEqual(["MIXED_CURRENCY"]);
    expect(kinds(run({ currency: "SAR" }))).toContain("MIXED_CURRENCY");
  });

  it("reports what it could not verify without refusing it", () => {
    const missing = run({ facts: {} });
    expect(missing.refusals).toEqual([]);
    expect(missing.notices).toEqual([{ kind: "FACTS_UNVERIFIED", lineIds: ["l1"] }]);
    expect(missing.delivery).toMatchObject({ kind: "QUOTED", basis: "UNDETERMINED" });
    expect(missing.canSubmit).toBe(true);

    const withdrawn = run({ facts: { l1: { productId: "p1", unavailable: true } } });
    expect(withdrawn.refusals).toEqual([]);
    expect(withdrawn.notices).toEqual([{ kind: "CATALOGUE_MISS", lineId: "l1" }]);
  });

  it("flags a displayed VAT rate that differs from the destination's statutory rate", () => {
    const result = run({ address: { ...address, country: "SA" } });
    expect(result.jurisdiction).toEqual({ country: "SA", ratePercent: 15 });
    expect(result.vatRateDiffers).toBe(true);
  });

  it("never lets an empty basket or an invalid address through", () => {
    expect(run({ lines: [] }).canSubmit).toBe(false);
    expect(run({ address: { ...address, line1: "" } }).canSubmit).toBe(false);
  });
});
