import { describe, expect, it, vi } from "vitest";
import type { CategoryNode } from "@/lib/category-tree";
import { buildSitemap, SITEMAP_STATIC_PATHS } from "../sitemap-entries";

const node = (slug: string, children: CategoryNode[] = []): CategoryNode => ({
  id: slug,
  slug,
  nameEn: slug,
  nameAr: slug,
  iconName: null,
  parentId: null,
  children,
});

const ORIGIN = "https://storefront.test";

/**
 * /sitemap.xml answered 404: nothing in the app produced one. These pin what the
 * new one publishes and, as much as that, what it does when it cannot read: a
 * sitemap that 500s tells a crawler the site is broken.
 */
describe("the storefront sitemap", () => {
  it("lists the fixed public pages, every public category at any depth, and every public product", async () => {
    const updatedAt = new Date("2026-09-01T00:00:00Z");
    const entries = await buildSitemap(ORIGIN, {
      categories: async () => [node("electrical", [node("cable-glands", [node("brass-glands")])])],
      products: async () => [{ slug: "m20-gland", updatedAt }],
    });

    const urls = entries.map((entry) => entry.url);
    for (const path of SITEMAP_STATIC_PATHS) expect(urls).toContain(new URL(path, ORIGIN).href);
    expect(urls).toContain(`${ORIGIN}/categories/electrical`);
    expect(urls, "a third-level category must not be dropped").toContain(`${ORIGIN}/categories/brass-glands`);
    expect(entries.find((entry) => entry.url === `${ORIGIN}/products/m20-gland`)?.lastModified).toBe(updatedAt);
  });

  it("publishes only absolute canonical paths: no query strings, no search, no private pages", async () => {
    const entries = await buildSitemap(ORIGIN, { categories: async () => [], products: async () => [] });
    for (const { url } of entries) {
      const parsed = new URL(url);
      expect(parsed.origin).toBe(ORIGIN);
      expect(parsed.search, url).toBe("");
      expect(parsed.pathname, url).not.toMatch(/^\/(search|cart|wishlist|login|register|account|orders|checkout|auth)\b/);
    }
  });

  it("still lists the fixed pages when the database cannot be reached, and says which read failed", async () => {
    const onError = vi.fn();
    const entries = await buildSitemap(ORIGIN, {
      categories: async () => { throw new Error("connection refused"); },
      products: async () => { throw new Error("connection refused"); },
      onError,
    });
    expect(entries.map((entry) => entry.url)).toEqual(SITEMAP_STATIC_PATHS.map((path) => new URL(path, ORIGIN).href));
    expect(onError.mock.calls.map(([source]) => source).sort()).toEqual(["categories", "products"]);
  });

  it("keeps the products when only the category read fails", async () => {
    const entries = await buildSitemap(ORIGIN, {
      categories: async () => { throw new Error("timeout"); },
      products: async () => [{ slug: "m20-gland", updatedAt: new Date() }],
    });
    expect(entries.map((entry) => entry.url)).toContain(`${ORIGIN}/products/m20-gland`);
  });

  it("lists nothing when the deployment's own address is unknown, rather than inventing one", async () => {
    const products = vi.fn(async () => []);
    expect(await buildSitemap(null, { categories: async () => [], products })).toEqual([]);
    expect(products).not.toHaveBeenCalled();
  });
});
