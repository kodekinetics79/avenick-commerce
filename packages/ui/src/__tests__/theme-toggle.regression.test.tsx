import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "../theme-toggle";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);
const button = (html: string) => /<button[^>]*>/.exec(html)![0];

/**
 * The storefront header drew the theme toggle as the one bordered, plated,
 * shadowed chip in a row of flat icon controls: 38×38 with a 1px border, a
 * white plate and shadow-elev-2, beside a wishlist, a cart and an account
 * control with none of the three. Raised means actionable (LAW A), so the
 * least important control in the row read as its primary one. In the phone
 * sheet it was 38px beside 44px locale segments, and its accessible names were
 * English literals inside the primitive on an Arabic storefront.
 */
describe("ThemeToggle", () => {
  it("keeps the raised chip by default, so seller and admin render exactly as before", () => {
    const html = markup(<ThemeToggle />);
    expect(button(html)).toMatch(/border border-border bg-surface-2/);
    expect(button(html)).toMatch(/shadow-elev-2/);
    expect(button(html)).toMatch(/height:var\(--control-h-md\)/);
    expect(button(html)).toMatch(/aria-label="Switch to dark mode"/);
  });

  it("draws a flat icon control when asked, with no border, plate or shadow", () => {
    const html = button(markup(<ThemeToggle variant="ghost" />));
    expect(html).not.toMatch(/\bborder\b|bg-surface-2|shadow-/);
    expect(html).toMatch(/hover:bg-ink-1\/\[0\.06\]/);
  });

  it("offers a 44px touch target for a sheet", () => {
    expect(button(markup(<ThemeToggle size="lg" />))).toMatch(/height:2\.75rem;width:2\.75rem/);
  });

  it("names itself in the language the caller passes", () => {
    const html = markup(<ThemeToggle labels={{ toDark: "التبديل إلى الوضع الداكن", toLight: "التبديل إلى الوضع الفاتح" }} />);
    expect(button(html)).toContain('aria-label="التبديل إلى الوضع الداكن"');
    expect(html).not.toContain("Switch to");
  });
});
