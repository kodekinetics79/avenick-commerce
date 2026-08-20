import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { companyCurrencyForCountry } from "../company-currency";

const customerRoot = resolve(__dirname, "../..");

describe("B2B market truth", () => {
  it("derives the operational currency from the company jurisdiction", () => {
    expect(companyCurrencyForCountry("SA")).toBe("SAR");
    expect(companyCurrencyForCountry("AE")).toBe("AED");
    expect(companyCurrencyForCountry("QA")).toBe("QAR");
    expect(companyCurrencyForCountry("unknown")).toBe("USD");
  });

  it("does not hard-code AED or Dubai examples in company operational views", () => {
    const files = [
      "app/b2b/page.tsx",
      "app/b2b/team/page.tsx",
      "app/b2b/company/page.tsx",
      "app/b2b/billing/page.tsx",
      "app/b2b/analytics/page.tsx",
      "app/b2b/rfq/new/page.tsx",
      "app/b2b/addresses/page.tsx",
    ];
    const source = files.map((file) => readFileSync(resolve(customerRoot, file), "utf8")).join("\n");
    expect(source).not.toMatch(/formatCurrency\([^\n]+"AED"/);
    expect(source).not.toMatch(/Spend limit \(AED\)|Target Unit Price \(AED\)|JAFZA|Dubai/);
  });

  it("labels unavailable billing exports instead of presenting dead actions", () => {
    const billing = readFileSync(resolve(customerRoot, "app/b2b/billing/page.tsx"), "utf8");
    expect(billing).toContain("Statement export unavailable");
    expect(billing).toContain("PDF unavailable");
    expect(billing).not.toContain(">Pay now<");
  });
});
