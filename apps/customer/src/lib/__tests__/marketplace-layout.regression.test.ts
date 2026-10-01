import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../../../..");
const css = readFileSync(join(repoRoot, "apps/customer/src/app/globals.css"), "utf8");

describe("marketplace shell geometry", () => {
  it("uses the canonical shell gutter for hero and floating search geometry", () => {
    expect(css).not.toContain("var(--gutter)");
    expect(css.match(/var\(--shell-gutter\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
