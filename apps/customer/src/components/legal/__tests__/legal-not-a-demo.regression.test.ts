import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../../app/", import.meta.url));

/** Page source with comments removed, so a note explaining a removal cannot trip the check. */
function renderedText(page: string): string {
  return readFileSync(join(appDir, page, "page.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * The Terms of Service and the Privacy Policy told live buyers the site was a
 * demo.
 *
 * Terms §6: "This demo does not assign a jurisdiction by default. Contact the
 * legal desk before relying on these terms for a live transaction." Privacy §4:
 * "Availability of the demo does not itself represent legal or regulatory
 * certification", with "البيئة التجريبية" in both Arabic twins. Production is
 * not a demo, no page names a "legal desk", and a contract page that disowns
 * itself is worse than a short one.
 *
 * The replacement invents nothing: no jurisdiction is stated, because none is
 * recorded (lib/company.ts resolves the GCC trading entity to null on purpose).
 */
describe("the legal pages describe the live platform", () => {
  it.each(["terms", "privacy"])("/%s does not call the platform a demo, in either language", (page) => {
    const text = renderedText(page);
    expect(text).not.toMatch(/\bdemo\b/i);
    expect(text).not.toMatch(/تجريبي/);
  });

  it("does not send readers to a legal desk no page names", () => {
    const text = renderedText("terms");
    const governingLaw = text.slice(text.indexOf('id: "governing-law"'), text.indexOf('id: "questions"'));
    expect(governingLaw).not.toMatch(/legal desk|القسم القانوني/i);
    // It routes to the contact page, which lists the configured legal route.
    expect(governingLaw).toMatch(/contactLink\(false\)/);
    expect(governingLaw).toMatch(/contactLink\(true\)/);
  });
});
