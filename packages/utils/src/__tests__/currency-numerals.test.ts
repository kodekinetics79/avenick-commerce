import { describe, expect, it } from "vitest";
import { formatCurrency } from "../currency";

const GULF = ["AED", "SAR", "QAR", "KWD", "BHD", "OMR"] as const;

/**
 * Every amount on a page must use one numeral system.
 *
 * Each currency carries its own CLDR locale, and CLDR disagrees across the
 * Gulf: ar-AE defaults to Western digits while ar-SA and its neighbours default
 * to Arabic-Indic. An Arabic cart with an AED line and a SAR line therefore
 * printed "1,234.50" beside "١٬٢٣٤٫٥٠" in the same column.
 */
describe("currency numerals", () => {
  it.each(GULF)("%s renders Western digits in Arabic", (code) => {
    const out = formatCurrency(1234.5, code, "ar");
    expect(out, `${code} produced Arabic-Indic digits: ${out}`).toMatch(/[0-9]/);
    expect(out, `${code} produced Arabic-Indic digits: ${out}`).not.toMatch(/[٠-٩]/);
  });

  it("keeps every Gulf currency on the same numeral system as every other", () => {
    const digitsUsed = new Set(
      GULF.map((code) => (/[٠-٩]/.test(formatCurrency(1, code, "ar")) ? "arab" : "latn")),
    );
    expect(digitsUsed.size, "a page could show two numeral systems at once").toBe(1);
  });

  it("keeps each currency's own decimal precision", () => {
    // The three-decimal Gulf currencies are not a rounding error to normalise away.
    expect(formatCurrency(1, "KWD", "ar")).toContain("1.000");
    expect(formatCurrency(1, "AED", "ar")).toContain("1.00");
  });

  it("still formats English unchanged", () => {
    expect(formatCurrency(1234.5, "AED", "en")).toBe("AED 1,234.50");
    expect(formatCurrency(1234.5, "SAR", "en")).toBe("SAR 1,234.50");
  });
});
