import { describe, expect, it } from "vitest";
import { formatCurrency, isSupportedCurrency } from "../currency";

describe("formatCurrency with an unsupported code", () => {
  it("renders the amount with its raw code instead of throwing", () => {
    // Reached from persisted client state an `as Currency` cast waved through:
    // a wishlist line saved before a currency was retired must not take the
    // whole page down, and must not borrow another currency's symbol either.
    const out = formatCurrency(1234.5, "XYZ" as never);
    expect(out).toBe("XYZ 1,234.50");
  });

  it("still formats a supported code with its symbol and decimals", () => {
    expect(formatCurrency(1234.5, "AED")).toBe("AED 1,234.50");
    // KWD is a three-decimal currency; the config, not the fallback, decides.
    expect(formatCurrency(1.2345, "KWD")).toBe("KWD 1.235");
  });

  it("isSupportedCurrency tells the two apart", () => {
    expect(isSupportedCurrency("SAR")).toBe(true);
    expect(isSupportedCurrency("XYZ")).toBe(false);
    // Inherited object properties are not currencies.
    expect(isSupportedCurrency("toString")).toBe(false);
  });
});
