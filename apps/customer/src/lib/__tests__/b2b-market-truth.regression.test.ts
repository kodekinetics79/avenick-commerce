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

  it("offers no billing control that does nothing when clicked", () => {
    // The invariant is that a control on this page either works or is not
    // rendered. It was first met by labelling both exports "unavailable"; the
    // page now goes further — the statement button, which had no export behind
    // it at all, is gone, and the invoice download is rendered only for an
    // invoice that actually has a stored file, with "No file" otherwise. Both
    // satisfy the rule, so the assertions below test the rule and not either
    // wording: no payment action, no unconditional download, and a guard on the
    // one download that remains.
    const billing = readFileSync(resolve(customerRoot, "app/b2b/billing/page.tsx"), "utf8");
    // Comments are stripped first: a note explaining that a dead button was
    // removed names the button, and matching it would fail the file for
    // documenting the very fix under test.
    const rendered = billing.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(rendered).not.toContain(">Pay now<");
    expect(rendered).not.toMatch(/Download statement|Export statement/);
    // The PDF link must be behind a check on the stored file, never bare.
    expect(rendered).toMatch(/inv\.fileUrl \?/);
    // The fallback is translated now, so match the key OR the old literals —
    // what must hold is that the guarded branch has an else, not its wording.
    expect(rendered).toMatch(/No file|PDF unavailable|billing\.noFile/);
  });
});
