import { describe, expect, it } from "vitest";
import {
  resolveDestinationCoverage,
  toShippingCoverage,
  type ShippingZoneRow,
} from "../checkout-shipping-coverage";

/** A Prisma Decimal, as far as the projection is concerned. */
const decimal = (value: string) => ({ toString: () => value });

const gcc: ShippingZoneRow = {
  code: "GCC",
  nameEn: "GCC mainland",
  nameAr: "دول الخليج",
  countries: ["ae", "SA "],
  isActive: true,
  fallbackPrice: decimal("25.00"),
  freeOverSubtotal: decimal("500"),
  rates: [
    { currency: "AED", isActive: true },
    { currency: "AED", isActive: true },
    { currency: "SAR", isActive: false },
  ],
};

const retired: ShippingZoneRow = {
  code: "OLD",
  nameEn: "Retired",
  nameAr: "قديم",
  countries: ["AE", "OM"],
  isActive: false,
  fallbackPrice: 10,
  freeOverSubtotal: null,
  rates: [],
};

describe("toShippingCoverage", () => {
  it("projects only active zones, as numbers, with normalised countries", () => {
    const coverage = toShippingCoverage([gcc, retired]);
    expect(coverage.configured).toBe(true);
    expect(coverage.zones).toEqual([
      {
        code: "GCC",
        nameEn: "GCC mainland",
        nameAr: "دول الخليج",
        countries: ["AE", "SA"],
        fallbackPrice: 25,
        freeOverSubtotal: 500,
        ratedCurrencies: ["AED"],
      },
    ]);
  });

  it("reports an unconfigured tariff when no zone is active", () => {
    expect(toShippingCoverage([retired])).toEqual({ configured: false, zones: [] });
    expect(toShippingCoverage([])).toEqual({ configured: false, zones: [] });
  });
});

describe("resolveDestinationCoverage", () => {
  const coverage = toShippingCoverage([gcc, { ...retired, isActive: true, code: "TWIN", countries: ["SA"] }]);

  it("never pre-judges a destination when the tariff is unknown or no country is chosen", () => {
    expect(resolveDestinationCoverage(null, "AE")).toEqual({ status: "UNKNOWN" });
    expect(resolveDestinationCoverage(coverage, "")).toEqual({ status: "UNKNOWN" });
  });

  it("distinguishes 'no tariff at all' from 'not served'", () => {
    expect(resolveDestinationCoverage({ configured: false, zones: [] }, "OM")).toEqual({ status: "NOT_CONFIGURED" });
    expect(resolveDestinationCoverage(coverage, "OM")).toEqual({ status: "UNSERVED", country: "OM" });
  });

  it("finds the single zone for a served country, case-insensitively", () => {
    const served = resolveDestinationCoverage(coverage, "ae");
    expect(served.status).toBe("SERVED");
    if (served.status === "SERVED") expect(served.zone.code).toBe("GCC");
  });

  it("refuses to choose between two zones that claim one country", () => {
    expect(resolveDestinationCoverage(coverage, "SA")).toEqual({
      status: "AMBIGUOUS",
      country: "SA",
      zoneCodes: ["GCC", "TWIN"],
    });
  });
});
