import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => readFileSync(join(appDir, rel), "utf8");

/**
 * Three storefront screens rendered with no h1, and the 404 with no site chrome.
 *
 * EmptyState set its lead in a <p>, and the three screens whose whole content
 * is one plate — the 404, the route error boundary and the empty cart — had no
 * other heading, so each was announced as an untitled page. The 404 also never
 * mounted <MainLayout>: its own comment removed a search box as a duplicate of
 * "the one the header already renders on this very page", on a page that
 * rendered no header, no footer and no way to keep shopping but one button.
 *
 * The empty cart was worse in a quieter way: the pre-hydration skeleton painted
 * the "Your cart" header, and the empty branch removed it a frame later.
 *
 * These are source checks because all three are Next route files — an async
 * server component reading next-intl, and a client page bound to persisted
 * stores — which a unit render cannot mount honestly. What they hold is the
 * structural decision, which is exactly what regressed.
 */
describe("screens whose content is a single plate still carry a title", () => {
  it("renders the 404 inside the site chrome, with the plate's lead as the h1", () => {
    const source = read("not-found.tsx");
    expect(source).toMatch(/import \{ MainLayout \} from "@\/components\/layout\/main-layout"/);
    expect(source).toMatch(/<MainLayout>/);
    expect(source).toMatch(/headingLevel="h1"/);
    // The header carries the mark; a second one stacked above the plate is gone.
    expect(source).not.toMatch(/<BrandMark/);
  });

  it("gives the route error boundary an h1", () => {
    expect(read("error.tsx")).toMatch(/headingLevel="h1"/);
  });

  it("keeps the cart's page header when the cart turns out to be empty", () => {
    const source = read("cart/page.tsx");
    const emptyBranch = source.slice(source.indexOf("if (items.length === 0)"));
    const beforePopulated = emptyBranch.slice(0, emptyBranch.indexOf("const lineCount"));
    expect(beforePopulated).toMatch(/<PageHeader eyebrow=\{c\("cart\.eyebrow", "Cart"\)\} title=\{pageTitle\}/);
    expect(beforePopulated.indexOf("<PageHeader")).toBeLessThan(beforePopulated.indexOf("<EmptyState"));
    // Same container as the skeleton and the populated branch, so the header
    // does not move when hydration decides which branch is true.
    expect(beforePopulated).toMatch(/mx-auto max-w-6xl px-4 py-block/);
  });
});
