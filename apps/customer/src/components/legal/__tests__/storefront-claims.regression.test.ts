import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../../../../messages/en.json";
import ar from "../../../../messages/ar.json";
import { identityCopy } from "@/app/auth/identity-copy";

const appDir = fileURLToPath(new URL("../../../app/", import.meta.url));

/** Page source with comments removed, so a note explaining a removal cannot trip the check. */
function renderedText(page: string): string {
  return readFileSync(join(appDir, page, "page.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const INFO_PAGES = ["about", "support", "contact", "terms", "privacy", "shipping", "warranty"];

/**
 * Three claims the information pages made that the platform does not back
 * (LAW F).
 *
 * 1. CONSUMER BUYING. /about said the catalogue serves "a person buying one
 *    item" and the platform is "B2C-ready"; the register chooser said a
 *    personal account lets you "Buy for yourself"; the terms, the privacy policy
 *    and the help centre said "B2B/B2C". Whether a product is sold to
 *    individuals is a per-product channel its supplier sets, and on production
 *    no live product had it on.
 *
 * 2. TOOLS AND OFFICE PROCUREMENT. /about and the support FAQ said suppliers list
 *    "tools and office procurement". Every live category is electrical and
 *    industrial supply.
 *
 * 3. SUPPLIER REVIEW. /about, /contact and the checkout trust strip said a
 *    supplier's application is reviewed "including the commercial registration"
 *    and that "business documentation is reviewed before a seller can list".
 *    approveSeller checks no document, and the operator catalogue script
 *    activates sellers without it; every live listing on production came from a
 *    seller with no reviewed document. "Approved suppliers" on the delivery and
 *    warranty pages rested on the same premise.
 *
 * What replaced each is narrower and true on every path, and these checks hold
 * the substance rather than the sentence.
 */
describe("information pages make no claim the platform cannot back", () => {
  it.each(INFO_PAGES)("/%s does not promise consumer buying or a catalogue it does not carry", (page) => {
    const text = renderedText(page);
    expect(text).not.toMatch(/B2C-ready|B2B\/B2C|B2B and B2C|person buying one item/i);
    expect(text).not.toMatch(/tools,? and office/i);
    expect(text).not.toMatch(/جاهزة للأفراد|قطعة واحدة|والأدوات والمشتريات المكتبية|والأدوات والمستلزمات المكتبية/);
  });

  it.each(INFO_PAGES)("/%s does not claim suppliers are document-reviewed or approved", (page) => {
    const text = renderedText(page);
    expect(text).not.toMatch(/including the commercial registration|approved suppliers|documentation is reviewed/i);
    expect(text).not.toMatch(/بما فيها السجل التجاري|موردون معتمدون|موردين معتمدين|الموردين المعتمدين|الموردون المعتمدون/);
  });

  it("does not tell a personal-account applicant they can simply buy", () => {
    expect(identityCopy("en").register.consumerBody).not.toMatch(/buy for yourself/i);
    expect(identityCopy("ar").register.consumerBody).not.toMatch(/الشراء لنفسك/);
    // It points at where the per-product fact is actually shown.
    expect(identityCopy("en").register.consumerBody).toMatch(/product page/i);
  });

  it("keeps the checkout trust strip to what holds on every activation path", () => {
    for (const tree of [en, ar]) {
      const { verifiedSellers, verifiedSellersDesc } = tree.checkout.trust;
      expect(`${verifiedSellers} ${verifiedSellersDesc}`).not.toMatch(/verified|documentation|reviewed|موثّق|المستندات|تُراجَع/i);
    }
  });
});
