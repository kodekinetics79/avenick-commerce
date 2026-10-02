import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../../../..");
const css = readFileSync(join(repoRoot, "apps/customer/src/app/globals.css"), "utf8");
const hero = readFileSync(
  join(repoRoot, "apps/customer/src/components/home/procurement-hero.tsx"),
  "utf8",
);
const searchDock = readFileSync(
  join(repoRoot, "apps/customer/src/components/home/home-search-dock.tsx"),
  "utf8",
);

describe("marketplace shell geometry", () => {
  it("uses the canonical shell gutter for hero and floating search geometry", () => {
    expect(css).not.toContain("var(--gutter)");
    expect(css.match(/var\(--shell-gutter\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the marketplace dynamic without making content depend on motion", () => {
    expect(hero).toContain('className="marketplace-hero-visual"');
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".marketplace-hero-visual");
    expect(css).toContain("animation-timeline: view()");
  });

  it("enhances the real search form with cancellable live suggestions", () => {
    expect(searchDock).toContain('action="/search"');
    expect(searchDock).toContain("useSearchSuggest");
    expect(searchDock).toContain('role="combobox"');
    expect(searchDock).toContain('role="listbox"');
    expect(searchDock).toContain("clearSearch");
    expect(searchDock).toContain("event.nativeEvent.isComposing");
  });
});
