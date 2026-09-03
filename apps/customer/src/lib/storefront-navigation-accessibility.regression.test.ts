import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * These guard accessibility PROPERTIES, not the markup that happened to provide
 * them when the guard was written.
 *
 * The original assertions pinned literal strings — an English aria-label, a
 * utility class string, `<details className="group relative">`. Every one of
 * those was a correct implementation detail and every one of them broke on a
 * redesign that improved the thing being guarded: the labels are translated
 * now, and the account menu is a real button with aria-expanded rather than a
 * <details> element. A test that fails when the code gets better teaches people
 * to edit the test, which is how the property it protects eventually gets lost.
 * So each assertion below names the requirement and accepts any markup meeting it.
 */
describe("storefront navigation accessibility", () => {
  it("keeps card actions outside the product link and labels them persistently", () => {
    const card = source("../components/products/product-card.tsx");
    // Located by what the element IS, not by how it happens to be wrapped: the
    // opening tag is multi-line now, and a single-line match silently found
    // nothing rather than failing on the property under test.
    const hrefIndex = card.indexOf("href={productHref}");
    expect(hrefIndex, "product link not found").toBeGreaterThan(-1);
    const productLinkStart = card.lastIndexOf("<Link", hrefIndex);
    const productLinkEnd = card.indexOf("</Link>", hrefIndex);

    expect(productLinkStart).toBeGreaterThan(-1);
    expect(productLinkEnd).toBeGreaterThan(productLinkStart);
    // A button inside an anchor is not reachable as a button; the wishlist
    // control must live outside the product link.
    expect(card.slice(productLinkStart, productLinkEnd)).not.toContain("<button");

    // The wishlist control reports its own state, and its label names the
    // product it acts on so a screen reader hears which card was toggled.
    //
    // The label is built from the message tree now, so the product name arrives
    // as an interpolation value rather than a template literal. Assert that the
    // name reaches the label by SOME mechanism rather than pinning one syntax —
    // pinning it is what made this test fail twice on redesigns that improved
    // the very thing it guards.
    expect(card).toContain("aria-pressed={wishlisted}");
    const labelIndex = card.indexOf("aria-label={wishlisted ?");
    expect(labelIndex, "wishlist control has no state-dependent label").toBeGreaterThan(-1);
    const label = card.slice(labelIndex, labelIndex + 260);
    expect(label, "the wishlist label does not name the product").toMatch(/\$\{name\}|\{\s*name\s*\}/);

    // Controls must not be revealed on hover alone: a keyboard or touch user
    // never triggers :hover, so a hover-gated action is an action they cannot
    // reach at all.
    expect(card).not.toContain("group-hover:opacity-100");
  });

  it("provides keyboard-operable account and mobile primary navigation", () => {
    const header = source("../components/layout/header.tsx");
    const disclosure = source("../components/layout/disclosure.tsx");

    // Search is a landmark, so it can be jumped to directly.
    expect(header).toMatch(/role="search"/);

    // Both menu triggers are real buttons — an element the keyboard can focus
    // and activate — not a div with a click handler. The translator's local name
    // is not part of the guarantee, so it is not part of the assertion.
    expect(header).toMatch(/<button[\s\S]{0,500}?aria-label=\{\w+\("accountMenu"\)\}/);
    expect(header).toMatch(/<button[\s\S]{0,500}?aria-label=\{\w+\("openMenu"\)\}/);

    // The mobile trigger opens a dialog and says so, and reports open state.
    const openMenuIndex = header.search(/aria-label=\{\w+\("openMenu"\)\}/);
    const mobileTrigger = header.slice(Math.max(0, openMenuIndex - 500), openMenuIndex);
    expect(mobileTrigger).toContain('aria-haspopup="dialog"');
    expect(mobileTrigger).toContain("aria-expanded={mobileOpen}");

    // The account menu gets its state from the shared disclosure hook, so the
    // guarantee lives there: every trigger it builds is a button that reports
    // expanded state, and advertises aria-controls only while the panel exists.
    expect(header).toContain("account.triggerProps");
    expect(disclosure).toContain('type: "button" as const');
    expect(disclosure).toContain('"aria-expanded": open');
    expect(disclosure).toContain('"aria-controls": open ? panelId : undefined');

    // Navigation regions are named, and the names come from the message tree
    // rather than being English literals in a bilingual storefront.
    expect(header).toMatch(/<nav[\s\S]{0,260}?aria-label=\{\w+\("primaryNav"\)\}/);
  });
});
