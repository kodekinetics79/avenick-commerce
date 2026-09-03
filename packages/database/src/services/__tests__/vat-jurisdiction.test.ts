import { describe, expect, it } from "vitest";
import type { Currency } from "@prisma/client";
import { VAT_RATES } from "@avenick/utils";
import { assertStatutoryVatRate, resolveTaxJurisdiction, type TaxJurisdiction } from "../orders";

/**
 * VAT is a rule about the place of supply, not a column on a price row.
 *
 * These are unit tests over the two functions createOrder actually calls to
 * price tax — resolveTaxJurisdiction and assertStatutoryVatRate — so they prove
 * the rule, not the wiring. The wiring (that createOrder reaches these on every
 * line, governed PO lines included) is covered by the Postgres checkout
 * integration suites in packages/database/src/__tests__.
 */

const address = (country: string) => ({ label: "L", line1: "L1", city: "C", country });

// Kept as explicitly typed tuples so a rate typo is a type error at the table,
// not a surprise inside the assertion.
const DESTINATIONS: Array<[country: string, rate: number]> = [
  ["SA", 15],
  ["AE", 5],
  ["QA", 0],
  ["KW", 0],
  ["BH", 10],
  ["OM", 5],
];

const CURRENCY_FALLBACKS: Array<[currency: Currency, country: string, rate: number]> = [
  ["SAR", "SA", 15],
  ["AED", "AE", 5],
  ["QAR", "QA", 0],
  ["KWD", "KW", 0],
  ["BHD", "BH", 10],
  ["OMR", "OM", 5],
];

describe("resolveTaxJurisdiction — destination is the authority", () => {
  it.each(DESTINATIONS)("charges the statutory rate for a delivery to %s", (country, rate) => {
    expect(resolveTaxJurisdiction(address(country), "AED")).toEqual({
      country,
      rate,
      source: "SHIPPING_DESTINATION",
    });
  });

  it("charges KSA 15% rather than the 5% the price-row default carried", () => {
    // The regression this file exists for: every order was taxed at whatever sat
    // on the price row, which defaults to 5.00, so KSA was under-collected.
    expect(resolveTaxJurisdiction(address("SA"), "SAR").rate).toBe(15);
  });

  it("follows the destination even when the currency belongs to another state", () => {
    // A Riyadh buyer paying in SAR but shipping to Dubai is a UAE supply.
    expect(resolveTaxJurisdiction(address("AE"), "SAR")).toMatchObject({ country: "AE", rate: 5 });
    // And the reverse: an AED-priced order delivered into KSA is a KSA supply.
    expect(resolveTaxJurisdiction(address("SA"), "AED")).toMatchObject({ country: "SA", rate: 15 });
  });

  it("normalises the declared country before matching", () => {
    expect(resolveTaxJurisdiction({ country: " sa " }, "AED")).toMatchObject({ country: "SA", rate: 15 });
  });

  it("refuses a destination with no configured jurisdiction rather than guessing", () => {
    // Never silently reinterpreted as the currency's home country: that would
    // tax a real, stated address by a guess.
    expect(() => resolveTaxJurisdiction(address("US"), "AED")).toThrow(/No VAT jurisdiction is configured.*"US"/);
    expect(() => resolveTaxJurisdiction(address("ZZ"), "SAR")).toThrow(/No VAT jurisdiction is configured/);
  });
});

describe("resolveTaxJurisdiction — currency home country is the last resort", () => {
  it.each(CURRENCY_FALLBACKS)("falls back to %s's issuing state when no destination is given", (currency, country, rate) => {
    expect(resolveTaxJurisdiction(undefined, currency)).toEqual({
      country,
      rate,
      source: "CURRENCY_HOME_COUNTRY",
    });
  });

  it("treats an absent, empty or whitespace country as no destination", () => {
    const missing: Array<Record<string, string> | null | undefined> = [
      undefined,
      null,
      {},
      { country: "" },
      { country: "   " },
    ];
    for (const shippingAddress of missing) {
      expect(resolveTaxJurisdiction(shippingAddress, "SAR")).toMatchObject({
        country: "SA",
        source: "CURRENCY_HOME_COUNTRY",
      });
    }
  });

  it("refuses a USD order with no destination — USD has no place of supply", () => {
    expect(() => resolveTaxJurisdiction(undefined, "USD")).toThrow(/USD has no home VAT jurisdiction/);
    // A USD order that does declare a GCC destination is still priceable.
    expect(resolveTaxJurisdiction(address("BH"), "USD")).toMatchObject({ country: "BH", rate: 10 });
  });
});

describe("assertStatutoryVatRate — a contradicting price row is refused", () => {
  const jurisdiction = (country: string): TaxJurisdiction =>
    resolveTaxJurisdiction(address(country), "AED");

  it("refuses a 5% price row for a KSA supply and names every term of the conflict", () => {
    let thrown: unknown;
    try {
      assertStatutoryVatRate("Bosch GBH Rotary Hammer", 5, jurisdiction("SA"));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain("Bosch GBH Rotary Hammer");
    expect(message).toContain("configured at 5%");
    expect(message).toContain("statutory rate in SA is 15%");
    expect(message).toContain("SHIPPING_DESTINATION");
  });

  it("refuses an over-charging price row just as loudly as an under-charging one", () => {
    expect(() => assertStatutoryVatRate("Safety Helmet", 15, jurisdiction("AE")))
      .toThrow(/configured at 15%.*statutory rate in AE is 5%/s);
  });

  it("refuses a zero-rated row where the jurisdiction is not zero-rated", () => {
    // ProductPrice has no exemption marker, so a bare 0 cannot be distinguished
    // from a mis-keyed rate. It is refused rather than assumed to be exempt.
    expect(() => assertStatutoryVatRate("Insulated Gloves", 0, jurisdiction("AE")))
      .toThrow(/statutory rate in AE is 5%/);
  });

  it("accepts a zero rate only where the jurisdiction itself levies nothing", () => {
    expect(assertStatutoryVatRate("Insulated Gloves", 0, jurisdiction("QA"))).toBe(0);
    expect(assertStatutoryVatRate("Insulated Gloves", 0, jurisdiction("KW"))).toBe(0);
  });

  it("returns the jurisdiction's rate when the price row agrees", () => {
    expect(assertStatutoryVatRate("Rotary Hammer", 15, jurisdiction("SA"))).toBe(15);
    expect(assertStatutoryVatRate("Rotary Hammer", 5, jurisdiction("AE"))).toBe(5);
    expect(assertStatutoryVatRate("Rotary Hammer", 10, jurisdiction("BH"))).toBe(10);
  });

  it("tolerates the two-decimal storage of Decimal(5,2) without float drift", () => {
    // ProductPrice.vatRate round-trips as 15.00 / 5.00, not 15 / 5.
    expect(assertStatutoryVatRate("Rotary Hammer", 15.0, jurisdiction("SA"))).toBe(15);
    expect(() => assertStatutoryVatRate("Rotary Hammer", 15.01, jurisdiction("SA"))).toThrow(/mismatch/);
  });

  it("refuses a structurally invalid configured rate", () => {
    expect(() => assertStatutoryVatRate("Rotary Hammer", Number.NaN, jurisdiction("SA")))
      .toThrow(/Configured VAT rate for "Rotary Hammer" is invalid/);
    expect(() => assertStatutoryVatRate("Rotary Hammer", -5, jurisdiction("SA")))
      .toThrow(/is invalid/);
  });
});

describe("there is exactly one VAT rate table", () => {
  it("resolves every jurisdiction from @avenick/utils rather than a local copy", () => {
    // If someone re-introduces a private rate table in the order path, one of
    // these will disagree with the table the admin settings page renders.
    for (const [country, rate] of Object.entries(VAT_RATES)) {
      expect(resolveTaxJurisdiction(address(country), "AED").rate).toBe(rate);
    }
  });
});
