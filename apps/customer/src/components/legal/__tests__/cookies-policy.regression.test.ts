import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const repoRoot = join(appRoot, "../../");
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");

/** Source with comments removed, so a note about the old wording cannot trip the check. */
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * The cookies policy said "no browsing statistics are collected" — and every
 * product page had been counting a view since the beacon shipped three days
 * after that sentence was last edited.
 *
 * It also left the Discovery panel's localStorage trail out of its storage
 * list, warned about "B2C shopping checkout flows" no buyer can reach, and said
 * partners "may place cookies" under a CSP that admits no third-party script or
 * frame. The rewrite states what the code does. These checks tie each sentence
 * to the code it describes, so the next change to the beacon, the table or the
 * CSP fails here instead of quietly making the policy false again.
 */
describe("the cookies policy matches what the storefront stores", () => {
  const policy = read(appRoot, "src/app/cookies/page.tsx");
  const text = withoutComments(policy);

  it("no longer denies the product view count, or the checkout and partners that do not exist", () => {
    expect(text).not.toMatch(/no browsing statistics|B2C shopping checkout|may place cookies/i);
    expect(text).not.toMatch(/لا نجمع أي إحصاءات تصفح|سلة تسوق B2C|وقد يضع هؤلاء الشركاء/);
    expect(text).toMatch(/One thing is counted: when a product page opens/);
  });

  it("describes a count that stores nothing identifying — because the table has nowhere to put it", () => {
    const schema = read(repoRoot, "packages/database/prisma/schema.prisma");
    const model = schema.slice(schema.indexOf("model ProductViewSignal {"));
    const body = model.slice(0, model.indexOf("\n}"));
    const columns = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("///") && !line.startsWith("@@") && !line.startsWith("model"))
      .map((line) => line.split(/\s+/)[0]);
    expect(columns.sort()).toEqual(["bucketDate", "createdAt", "id", "product", "productId", "updatedAt", "views"]);
  });

  it("quotes the two short-lived windows the view route actually uses", () => {
    const route = read(appRoot, "src/app/api/signals/view/route.ts");
    // "used for up to a minute"
    expect(route).toMatch(/name: "signal-view", limit: 120, windowMs: 60_000/);
    expect(text).toMatch(/for up to a minute/);
    // "lapses within 24 hours", and never written to Postgres
    expect(route).toMatch(/name: "signal-view-dedup", limit: 1, windowMs: 24 \* 60 \* 60_000/);
    expect(text).toMatch(/lapses within 24 hours/);
    expect(text).toMatch(/خلال 24 ساعة/);
  });

  it("reads the Discovery trail's limits and ages from the panel's own constants", () => {
    expect(policy).toMatch(/from "@\/components\/discovery\/interest-signals"/);
    expect(policy).toMatch(/from "@\/components\/discovery\/history-storage"/);
    for (const constant of ["VIEW_LIMIT", "CATEGORY_VISIT_LIMIT", "SEARCH_LIMIT", "SIGNAL_TTL_MS", "DISMISSAL_TTL_MS"]) {
      expect(text).toContain(constant);
    }
  });

  it("says no third-party script or frame loads, which the shared CSP enforces", () => {
    const csp = read(repoRoot, "packages/config/security-headers.mjs");
    // script-src is assembled from an array, so the array is what is checked —
    // and it must be found, or this assertion would pass on an empty string.
    const scriptSrc = csp.match(/const scriptSrc = \[([^\]]*)\]/)?.[1];
    expect(scriptSrc, "security-headers.mjs no longer declares `const scriptSrc = [...]`").toBeDefined();
    expect(scriptSrc).not.toMatch(/https?:|\*/);
    expect(csp).toMatch(/`script-src \$\{scriptSrc\.join\(" "\)\}`/);
    // Nothing else is pushed onto it except the development-only eval.
    expect(csp.match(/scriptSrc\.push\(([^)]*)\)/g) ?? []).toEqual([`scriptSrc.push("'unsafe-eval'")`]);
    expect(csp).toMatch(/"frame-src 'none'"/);
    expect(text).toMatch(/loads no third-party scripts and embeds no third-party frames/);
  });
});
