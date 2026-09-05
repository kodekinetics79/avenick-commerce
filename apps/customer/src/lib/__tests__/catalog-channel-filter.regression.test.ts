import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

  it("no page requests a channel restriction it does not mean", () => {
    // The route itself is excluded: it is the READER of the parameter, and its
    // own comment necessarily quotes the query string it documents.
    const routePath = join(srcRoot, "app/api/products/route.ts");
    const offenders = sourceFiles(srcRoot)
      .filter((file) => file !== routePath)
      .filter((file) => /[?&]b2c=(true|false)/.test(readFileSync(file, "utf8")));
    expect(
      offenders.map((f) => f.replace(srcRoot + "/", "")),
      "this page sends a channel filter that is now honoured, and no product is B2C-enabled — it will render empty",
    ).toEqual([]);
  });
});
