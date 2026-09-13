import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PolicyShell } from "../policy-shell";

const appDir = fileURLToPath(new URL("../../../app/", import.meta.url));

/**
 * Eight reading pages rendered in two different layouts.
 *
 * /about, /contact, /shipping, /returns-policy and /warranty used PolicyShell,
 * which drew every section as its own bordered, shadowed card and let the body
 * run the full column — 1032px at 15px on a 1440 screen, about 131 characters a
 * line. /terms, /privacy and /cookies each kept a hand-copied layout: one sheet
 * ruled into sections, at max-w-prose, about 82 characters, inside a different
 * container with a different left edge. The footer links all eight side by
 * side, so a reader moving between them watched the page change shape.
 *
 * The shell is now the single sheet, and the three legal pages use it.
 */
describe("policy pages share one ruled document", () => {
  const sections = ["one", "two", "three"].map((id) => ({
    id,
    titleEn: `Section ${id}`,
    titleAr: `القسم ${id}`,
    contentEn: createElement("p", null, `Body ${id}`),
    contentAr: createElement("p", null, `نص ${id}`),
  }));

  const html = renderToStaticMarkup(
    createElement(PolicyShell, {
      isAr: false,
      titleEn: "Terms",
      titleAr: "الشروط",
      descriptionEn: "d",
      descriptionAr: "د",
      eyebrowEn: "Legal",
      eyebrowAr: "قانوني",
      sections,
    }),
  );

  it("draws the sections on one surface, ruled apart, never a card each", () => {
    // One rung-2 sheet holds every section.
    expect(html.match(/data-rung="2"/g)).toHaveLength(1);
    const sectionTags = html.match(/<section[^>]*>/g) ?? [];
    expect(sectionTags).toHaveLength(3);
    // The first section opens the sheet; every later one is divided by a hairline.
    expect(sectionTags[0]).not.toContain("border-t");
    expect(sectionTags.slice(1).every((tag) => tag.includes("border-t border-hairline"))).toBe(true);
    // Anchors survive: the table of contents and outside links point at them.
    for (const { id } of sections) expect(html).toContain(`id="${id}"`);
  });

  it("holds every section's body to a reading measure", () => {
    // Counted per section rather than across the page: the page header sets its
    // own description measure, which is not what this protects.
    const bodies = html.split("<section").slice(1);
    expect(bodies).toHaveLength(3);
    for (const body of bodies) expect(body).toMatch(/class="[^"]*\bmax-w-prose\b/);
  });

  it.each(["terms", "privacy", "cookies"])("/%s renders through the shared shell", (page) => {
    const source = readFileSync(join(appDir, page, "page.tsx"), "utf8");
    expect(source).toMatch(/<PolicyShell\b/);
    // The hand-copied layout is what drifted; it must not come back.
    expect(source).not.toMatch(/<PageHeader\b|<aside\b|<details\b/);
  });
});
