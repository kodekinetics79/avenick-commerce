import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "../json-ld";
import { breadcrumbList, siteIdentity } from "../structured-data";

const ORIGIN = "https://storefront.test";

/**
 * No page on the storefront carried structured data. These pin what the new
 * markup publishes, and the two ways it could go wrong: a catalogue string
 * closing the <script> it is inlined into, and a payload that claims more than
 * the page shows (LAW F — no product, price, offer or rating markup).
 */
describe("structured data", () => {
  it("names the site and its publisher with absolute URLs, and nothing else", () => {
    const [website, organization] = siteIdentity(ORIGIN, "Storefront", "/apple-icon/512");
    expect(website).toEqual({ "@type": "WebSite", name: "Storefront", url: `${ORIGIN}/` });
    expect(organization).toEqual({
      "@type": "Organization",
      name: "Storefront",
      url: `${ORIGIN}/`,
      logo: `${ORIGIN}/apple-icon/512`,
    });
    expect(website, "the retired sitelinks search box must not be advertised").not.toHaveProperty("potentialAction");
  });

  it("numbers a breadcrumb trail from 1, root first, as absolute URLs", () => {
    expect(
      breadcrumbList(ORIGIN, [
        { name: "All products", path: "/products" },
        { name: "Electrical", path: "/categories/electrical" },
        { name: "Cable glands", path: "/categories/cable-glands" },
      ]),
    ).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "All products", item: `${ORIGIN}/products` },
        { "@type": "ListItem", position: 2, name: "Electrical", item: `${ORIGIN}/categories/electrical` },
        { "@type": "ListItem", position: 3, name: "Cable glands", item: `${ORIGIN}/categories/cable-glands` },
      ],
    });
  });

  it("cannot be closed from inside by a catalogue string, and still parses back to the same data", () => {
    const hostile = "Glands</script><script>alert(1)</script>";
    const serialized = serializeJsonLd(breadcrumbList(ORIGIN, [{ name: hostile, path: "/categories/x" }]));
    expect(serialized).not.toContain("<");
    const parsed = JSON.parse(serialized);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed.itemListElement[0].name).toBe(hostile);
  });

  it("publishes no commerce claims", () => {
    const serialized = serializeJsonLd({ "@graph": siteIdentity(ORIGIN, "Storefront", "/apple-icon/512") });
    expect(serialized).not.toMatch(/"@type":"(Product|Offer|AggregateOffer|AggregateRating|Review)"/);
  });
});
