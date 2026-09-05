import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { catalogApiQuery, parseCatalogFilters } from "@/components/products/catalog-filters";

const appRoot = fileURLToPath(new URL("../../../", import.meta.url));
const srcRoot = join(appRoot, "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "__tests__" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/**
 * A filter must do what it says.
 *
 * /api/products parsed `b2b` and never `b2c`, so every caller that sent
 * `?b2c=true` was handed the ENTIRE catalogue while its own code read as though
 * the restriction were in force. It survived review repeatedly for exactly that
 * reason: the call site looks correct, and the defect is the absence of six
 * lines in a different file.
 *
 * Two halves, and both are needed. The route must read the parameter, and no
 * page may send a channel restriction it does not mean — not one product in
 * this catalogue has isB2CEnabled set, so a page that genuinely asks for B2C
 * renders empty, which is the honest answer and not the one those pages want.
 */
describe("catalogue channel filter", () => {
  it("the products route actually reads the b2c parameter", () => {
    const route = readFileSync(join(srcRoot, "app/api/products/route.ts"), "utf8");
    expect(route, "route does not read b2c — the filter is a silent no-op").toContain(
      'searchParams.get("b2c")',
    );
    // Reading it is not enough; it has to reach the query.
    expect(route).toMatch(/\bb2c,|\bb2c:\s/);
  });

  /**
   * The behavioural half, and the one that would have caught this.
   *
   * The source scan below looks for the URL spelling — `?b2c=true`. The main
   * catalogue page did not spell it that way: catalogApiQuery built the same
   * parameter structurally, as `{ b2c: "true" }` inside URLSearchParams, and
   * the scan never saw it. The whole /products grid rendered "No products match
   * these filters" against a catalogue of 383 published products, because the
   * page asked for the one thing none of them are.
   *
   * A guard that matches how a string is SPELLED misses the same defect
   * expressed as data. So the function is asked directly.
   */
  it("the public catalogue query carries no channel restriction", () => {
    const params = catalogApiQuery(parseCatalogFilters({}), { page: 1, limit: 24, b2b: false });
    expect(params.get("b2c"), "the public catalogue asked for B2C-only products").toBeNull();
    expect(params.get("b2b")).toBeNull();
  });

  it("a B2B request still asks for the B2B channel", () => {
    const params = catalogApiQuery(parseCatalogFilters({}), { page: 1, limit: 24, b2b: true });
    expect(params.get("b2b")).toBe("true");
    expect(params.get("b2c")).toBeNull();
  });

  it("filters survive alongside the channel decision", () => {
    const params = catalogApiQuery(parseCatalogFilters({ inStock: "1", minRating: "4" }), {
      page: 2, limit: 24, b2b: false, currency: "AED", search: "cable",
    });
    expect(params.get("b2c")).toBeNull();
    expect(params.get("inStock")).toBe("true");
    expect(params.get("minRating")).toBe("4");
    expect(params.get("currency")).toBe("AED");
    expect(params.get("search")).toBe("cable");
    expect(params.get("page")).toBe("2");
  });

  it("no page requests a channel restriction it does not mean", () => {
    // The route itself is excluded: it is the READER of the parameter, and its
    // own comment necessarily quotes the query string it documents.
    const routePath = join(srcRoot, "app/api/products/route.ts");
    const offenders = sourceFiles(srcRoot)
      .filter((file) => file !== routePath)
      // Both spellings: the URL form, and the object-property form that built
      // the same parameter and slipped past this scan for a whole release.
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return /[?&]b2c=(true|false)/.test(source) || /\bb2c\s*:\s*(["'`](true|false)["'`]|true\b)/.test(source);
      });
    expect(
      offenders.map((f) => f.replace(srcRoot + "/", "")),
      "this page sends a channel filter that is now honoured, and no product is B2C-enabled — it will render empty",
    ).toEqual([]);
  });
});
