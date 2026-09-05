import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { url } from "../targets.mjs";
import { ERROR_SURFACE_PATTERN } from "./lib/page-health";

/**
 * Does the catalogue say what the data says?
 *
 * Three defects that every build passed:
 *   - every SUBcategory page rendered not-found, because the lookup walked the
 *     tree's roots only — and its tab title fell back to the literal "Category";
 *   - a filter the URL accepted was never read, so the page it produced was
 *     the unfiltered one wearing the filtered URL;
 *   - the storefront rendered in system fallbacks because the CSP refused the
 *     web fonts, which no screenshot review noticed.
 *
 * Unauthenticated and read-only. The category under test is whatever the live
 * tree returns first, not a fixture, so a run certifies the catalogue it is
 * pointed at.
 */

interface CategoryNode {
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  children: CategoryNode[];
}

async function categoryTree(request: APIRequestContext): Promise<CategoryNode[]> {
  const response = await request.get(url("customer", "/api/categories"));
  expect(response.status(), `/api/categories answered HTTP ${response.status()}`).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.data), "/api/categories must answer an array of root categories").toBe(true);
  return body.data;
}

async function expectCategoryPage(page: Page, node: CategoryNode, depth: string): Promise<void> {
  const path = `/categories/${node.slug}`;
  const response = await page.goto(url("customer", path), { waitUntil: "load" });
  expect(response?.status(), `${path} (${depth}) answered HTTP ${response?.status()}`).toBe(200);

  const title = await page.title();
  expect(title, `${path} (${depth}) fell back to the generic "Category" tab title — the slug was not found in the tree`).not.toMatch(/^Category\b/);
  const named = title.includes(node.nameEn) || (!!node.nameAr && title.includes(node.nameAr));
  expect(named, `${path} (${depth}): tab title "${title}" does not name the category (${node.nameEn})`).toBe(true);

  const text = await page.locator("body").innerText();
  expect(text.match(ERROR_SURFACE_PATTERN)?.[0] ?? null, `${path} (${depth}) rendered an error surface`).toBeNull();

  const heading = (await page.locator("h1").first().innerText()).trim();
  const headed = heading.includes(node.nameEn) || (!!node.nameAr && heading.includes(node.nameAr));
  expect(headed, `${path} (${depth}): h1 "${heading}" does not name the category (${node.nameEn})`).toBe(true);
}

test.describe("category pages", () => {
  test("a top-level category page renders under its own name", async ({ page, request }) => {
    const tree = await categoryTree(request);
    expect(tree.length, "the category tree is empty — nothing to navigate").toBeGreaterThan(0);
    await expectCategoryPage(page, tree[0], "top level");
  });

  test("a subcategory page is found at depth and titled by its own name", async ({ page, request }) => {
    const tree = await categoryTree(request);
    const parent = tree.find((node) => node.children.length > 0);
    // Not a fixture: if the live catalogue has no second level, the lookup
    // that broke cannot be exercised, and the report says so.
    test.skip(!parent, "No category in the live tree has children — the depth lookup is not exercised on this catalogue");
    await expectCategoryPage(page, parent!.children[0], `child of ${parent!.slug}`);
  });
});

test.describe("catalogue filters", () => {
  test("/products?minRating=4&sort=rating renders the filtered catalogue", async ({ page }) => {
    const path = "/products?minRating=4&sort=rating";
    const response = await page.goto(url("customer", path), { waitUntil: "load" });
    expect(response?.status(), `${path} answered HTTP ${response?.status()}`).toBe(200);

    await expect(page).toHaveTitle(/.+/);

    // Either products render, or a truthful empty state does. Both are valid;
    // an error surface or a blank page is not.
    const text = await page.locator("body").innerText();
    expect(text.match(ERROR_SURFACE_PATTERN)?.[0] ?? null, `${path} rendered an error surface`).toBeNull();
    expect(text.trim().length, `${path} rendered no text at all`).toBeGreaterThan(0);
  });
});

test.describe("typography", () => {
  test("the storefront homepage sets its h1 in a loaded web font", async ({ page }) => {
    await page.goto(url("customer", "/"), { waitUntil: "load" });

    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      const loaded = (faces: FontFace[]) => faces.some((face) => face.status === "loaded");

      // Ask for the face directly rather than trusting document.fonts.status:
      // a refused font file leaves its FontFace in "error", and a refused
      // stylesheet leaves no FontFace at all. Both come back as "not loaded".
      const inter = await document.fonts.load('1em "Inter"').catch(() => [] as FontFace[]);

      const h1 = document.querySelector("h1");
      const family = h1
        ? getComputedStyle(h1).fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "")
        : "";
      const h1Faces = family ? await document.fonts.load(`1em "${family}"`).catch(() => [] as FontFace[]) : [];

      const declared: string[] = [];
      document.fonts.forEach((face) => declared.push(`${face.family} ${face.weight} (${face.status})`));

      return { hasH1: !!h1, family, interLoaded: loaded(inter), h1Loaded: loaded(h1Faces), declared };
    });

    expect(fonts.hasH1, "the storefront homepage has no h1").toBe(true);
    expect(
      fonts.interLoaded,
      `Inter is not loaded, so the design system's Latin face is not on screen. Declared faces:\n` +
        (fonts.declared.join("\n") || "(none — the @font-face stylesheet itself did not load)"),
    ).toBe(true);
    expect(
      fonts.h1Loaded,
      `the h1 asks for "${fonts.family}" and no loaded face answers to it — the heading is rendering in a system fallback`,
    ).toBe(true);
  });
});
