import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

const page = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../page.tsx"), "utf8");

/**
 * The home page's assurance panel is the storefront's most-read trust copy, and
 * it shipped four claims the code refused:
 *
 *  · "100% — Sellers verified before listing" and "Business documentation is
 *    reviewed before a seller can list". approveSeller moves PENDING_REVIEW to
 *    ACTIVE without looking at a document, and pilot-catalog.ts upserts its
 *    sellers straight to ACTIVE; those sellers held every live listing and had
 *    no document on file.
 *  · "MADA, Apple Pay, card, bank transfer and STC Pay". api/orders/route.ts
 *    answers 503 for all but bank transfer.
 *  · "VAT and delivery are computed and shown before you pay", above a rail of
 *    "Price on request" tiles, when purchase orders carry no computed delivery
 *    charge and delivery terms are confirmed during processing.
 *  · "Complete buyer protection — protected from payment through to delivery",
 *    when the Terms (§5) say there is no escrow.
 *
 * The rows now carry disclosures instead. This asserts the SUBSTANCE of each —
 * an editor can improve a sentence but not quietly delete the limitation it
 * states — and that the page still renders the keys that carry them, because
 * a disclosure that lives only in the message file protects nobody.
 */
describe("home page assurances", () => {
  it("makes no seller-verification figure, payment-choice list or blanket protection promise, in either language", () => {
    const home = JSON.stringify({ en: en.home, ar: ar.home });
    // The payment pattern is the old OFFER — a menu of methods — and not the
    // method names themselves: the disclosure that replaced it names card,
    // mada, Apple Pay and STC Pay precisely in order to say they are
    // unavailable, and a test that forbade the words would forbid the truth.
    expect(home).not.toMatch(
      /100%|verified before listing|documentation is reviewed before a seller|complete buyer protection|protected from payment through|multiple payment options|MADA, Apple Pay, card, bank transfer|computed and shown before you pay/i,
    );
    expect(home).not.toMatch(/١٠٠٪|حماية كاملة|موثّقون قبل الإدراج|محمي من الدفع|خيارات دفع متعددة/);
  });

  it("keeps the disclosures the rows exist to make", () => {
    expect(en.home.protect2Desc).toMatch(/bank transfer/i);
    expect(en.home.protect2Desc).toMatch(/remain unavailable/i);
    expect(ar.home.protect2Desc).toMatch(/التحويل البنكي/);
    expect(ar.home.protect2Desc).toMatch(/غير متاحة/);
    expect(en.home.protect3Desc).toMatch(/confirmed/i);
    expect(en.home.protect3Desc).not.toMatch(/before you pay|shown at checkout|calculated at checkout/i);
    expect(ar.home.protect3Desc).toMatch(/تأكيد/);
  });

  it("renders those rows, and not the removed badge or seller row", () => {
    for (const key of ["protect2Desc", "protect3Desc", "protect4Desc"]) {
      expect(page).toContain(`t("${key}")`);
    }
    expect(page).not.toMatch(/protectStat|protect1(Title|Desc)/);
  });
});
