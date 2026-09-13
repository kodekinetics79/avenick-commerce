import { beforeEach, describe, expect, it, vi } from "vitest";

const origin = vi.hoisted(() => ({ value: "https://storefront.test" as string | null }));
vi.mock("@avenick/utils/portal-config", () => ({ selfOrigin: () => origin.value }));

import robots from "./robots";
import { SITEMAP_STATIC_PATHS } from "@/components/seo/sitemap-entries";

const asList = (value: string | string[] | undefined) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/** Robots Exclusion Protocol precedence: the longest matching rule wins, and allow wins a tie. */
function crawlable(path: string, allow: string[], disallow: string[]): boolean {
  const longest = (rules: string[]) => Math.max(-1, ...rules.filter((rule) => path.startsWith(rule)).map((rule) => rule.length));
  return longest(allow) >= longest(disallow);
}

/**
 * /robots.txt answered 404. The rules that replace it are prefix matches, which
 * is exactly how they go wrong quietly: "/returns" would hide /returns-policy,
 * "/b2b" would hide the registration door, and disallowing /search would stop a
 * crawler from ever reading the noindex on its results.
 */
describe("robots.txt", () => {
  beforeEach(() => {
    origin.value = "https://storefront.test";
  });

  const rules = () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0]! : result.rules;
    return { allow: asList(rule.allow), disallow: asList(rule.disallow), sitemap: result.sitemap };
  };

  it("hides no URL the sitemap publishes, nor the catalogue's product and category pages", () => {
    const { allow, disallow } = rules();
    for (const path of [...SITEMAP_STATIC_PATHS, "/products/some-product", "/categories/some-category"]) {
      expect(crawlable(path, allow, disallow), `${path} is disallowed`).toBe(true);
    }
  });

  it("keeps crawlers off the private and per-visitor surfaces", () => {
    const { allow, disallow } = rules();
    for (const path of [
      "/account/orders",
      "/orders/1",
      "/checkout",
      "/cart",
      "/wishlist",
      "/login",
      "/b2b/team",
      "/api/orders",
      "/api/signals/view",
      "/api/cart/completions",
    ]) {
      expect(crawlable(path, allow, disallow), `${path} is crawlable`).toBe(false);
    }
  });

  /**
   * The product page is a client component: everything a buyer reads on it
   * arrives from /api/products/<slug> after the HTML. The first robots.txt
   * disallowed all of /api/, and a crawler renders with its fetches subject to
   * robots.txt, so every product URL on the sitemap rendered as an empty shell.
   */
  it("lets a crawler's render fetch the catalogue reads public pages make from the browser", () => {
    const { allow, disallow } = rules();
    for (const path of [
      "/api/products/m20-gland",
      "/api/products/m20-gland?currency=AED",
      "/api/products/m20-gland/recommendations",
      "/api/categories",
      "/api/brands",
    ]) {
      expect(crawlable(path, allow, disallow), `${path} is disallowed`).toBe(true);
    }
  });

  it("leaves /search crawlable, so the noindex on its results can be read", () => {
    const { allow, disallow } = rules();
    expect(crawlable("/search?q=gland", allow, disallow)).toBe(true);
  });

  it("names the sitemap by absolute URL, and only when the deployment's address is known", () => {
    expect(rules().sitemap).toBe("https://storefront.test/sitemap.xml");
    origin.value = null;
    expect(rules().sitemap).toBeUndefined();
  });
});
