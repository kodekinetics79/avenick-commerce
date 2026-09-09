import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards on WHERE the checkout quote's money comes from.
 *
 * These read source rather than call it, on purpose. Every rule below is about
 * a function being reachable or not reachable from this route — which is a
 * property of the imports, not of any single execution — and each one has a
 * failure mode that produces no error at all at run time, only a wrong number.
 */
const v1Root = fileURLToPath(new URL("../../../", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../../../../../../../../", import.meta.url));

function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFilesUnder(path);
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

const v1Sources = sourceFilesUnder(v1Root).filter((path) => !path.includes("__tests__"));

/**
 * Source with its comments removed.
 *
 * The bans below are about what the code CAN CALL. Naming a forbidden function
 * in a comment that explains why it is forbidden is the opposite of the
 * problem, and a guard that cannot tell the two apart makes documenting the
 * hazard impossible — which is how the hazard gets forgotten again.
 */
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

describe("the stale pre-PR-#21 arithmetic stays unreachable", () => {
  it("finds v1 source files to check at all", () => {
    // A guard that silently checks nothing is worse than no guard.
    expect(v1Sources.length).toBeGreaterThan(3);
  });

  it.each(["calculateOrderTotal", "calculateVat"])(
    "never reaches %s from anywhere under /api/v1",
    (banned) => {
      /*
        `calculateOrderTotal` in packages/utils/src/currency.ts computes
        `subtotal + vat + shipping - discount` where the VAT is taken on the
        GOODS ONLY. That is precisely the defect PR #21 fixed in the order path:
        it adds the freight after tax and therefore never taxes it. It has no
        callers and is being deleted.

        `calculateVat` is the same family — it falls back to 5% for any country
        it does not know, which is a guess presented as a rate, and would tax a
        Saudi order at a third of what it owes.

        Neither is a crash. Both are a plausible-looking total that is wrong by
        the freight's VAT, on the one endpoint whose entire job is to state a
        total the buyer can trust.
      */
      const offenders = v1Sources.filter((path) => codeOf(path).includes(banned));
      expect(offenders, `${banned} must not be reachable from the v1 surface`).toEqual([]);
    },
  );

  it("assembles the order totals through composeOrderTotals and nothing else", () => {
    const service = codeOf(join(v1Root, "checkout/quote/quote-service.ts"));
    expect(service).toContain("composeOrderTotals");
    // The freight VAT, the declared vatAmount and the final total are that
    // function's output. A route that names shippingVatAmount is a route that
    // has started computing one of them itself.
    expect(service).not.toContain("shippingVatAmount");
  });
});

describe("the per-line arithmetic still mirrors the order transaction", () => {
  /*
    The goods loop inside createOrder cannot be shared: it lives inside
    db.$transaction, interleaved with advisory locks and stock reservation, and
    there is no seam to call it from outside an order. So the quote reproduces
    two expressions from it, and this test fails the moment either side is
    edited without the other.

    It reads source because that is the only thing that can catch the drift.
    The two implementations agree on today's fixtures by construction; what
    matters is that they still agree after somebody changes one of them, and no
    fixture can assert that. The real fix is to extract the loop into
    checkout-invariants.ts alongside composeOrderTotals — see the report.
  */
  const orders = readFileSync(join(repoRoot, "packages/database/src/services/orders.ts"), "utf8");
  const quoteLines = readFileSync(join(v1Root, "checkout/quote/quote-lines.ts"), "utf8");
  const quoteLinesCode = codeOf(join(v1Root, "checkout/quote/quote-lines.ts"));

  it.each([
    { what: "the line subtotal", expression: "money(unitPrice * item.quantity)" },
    { what: "the discounted line subtotal", expression: "money(line.lineSubtotal - lineDiscount)" },
  ])("$what is written the same way in both", ({ expression }) => {
    expect(orders, `orders.ts no longer contains "${expression}"`).toContain(expression);
    expect(quoteLines, `the quote no longer contains "${expression}"`).toContain(expression);
  });

  it("takes the goods VAT on the DISCOUNTED subtotal in both", () => {
    // Taxing the pre-discount figure overcharges every promoted order.
    expect(orders).toContain("money(discountedSubtotal * (line.vatRate / 100))");
    expect(quoteLines).toContain("money(discountedSubtotal * (input.vatRatePercent / 100))");
  });

  it("applies the jurisdiction's statutory rate, never the seller's price row", () => {
    // orders.ts: `const vatRate = governed ? Number(governed.vatRate) : jurisdiction.rate;`
    // The quote has no governed-PO path, so the statutory rate is the only rate.
    expect(orders).toContain("jurisdiction.rate");
    expect(quoteLines).toContain("vatRatePercent: input.vatRatePercent");
    // Reading ProductPrice.vatRate to decide tax is the two-sources-of-truth
    // defect the order path guards against; its non-null 5% default is wrong in
    // most GCC markets.
    expect(quoteLinesCode).not.toContain("tier.vatRate");
  });

  it("keeps the free-delivery threshold reading the PRE-discount subtotal", () => {
    // quoteShipping's threshold is a commercial promise about the order's goods
    // value; feeding it a discounted figure would withdraw free delivery from
    // exactly the orders a promotion was meant to reward.
    const service = readFileSync(join(v1Root, "checkout/quote/quote-service.ts"), "utf8");
    expect(service).toContain("subtotal: goods.subtotal");
    expect(orders).toContain("subtotal,");
  });
});

describe("the barrel traps this repository has been bitten by", () => {
  it("reaches rate limiting through the subpath, never the @avenick/auth barrel", () => {
    // The barrel pulls next-auth and Prisma into whatever imports it.
    for (const path of v1Sources) {
      const source = codeOf(path);
      expect(source, `${path} imports the @avenick/auth barrel`).not.toMatch(
        /from "@avenick\/auth"/,
      );
    }
  });
});
