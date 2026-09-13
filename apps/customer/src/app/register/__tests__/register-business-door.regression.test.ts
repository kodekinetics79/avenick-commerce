import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../../../../messages/en.json";
import ar from "../../../../messages/ar.json";
import { identityCopy } from "@/app/auth/identity-copy";

// Comments stripped: the page explains, in prose, the endpoint and fields it no
// longer uses, and a note about a removal must not read as the removed code.
const source = readFileSync(join(fileURLToPath(new URL("..", import.meta.url)), "page.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/**
 * /register kept a second, divergent company registration form.
 *
 * Its "Business account" row opened a full company form posting to the same
 * /api/auth/register/business endpoint /b2b/register uses, and the two had
 * drifted: person-first against company-first, "Email" against "Work email",
 * two wordings of the password rule, no preferred language — and no route for
 * a colleague whose company is already registered, so they met a refusal with
 * nowhere to go. /b2b/register is the maintained form and has that route.
 *
 * The page also named itself three ways: tab "Create an account", eyebrow
 * "Create an account", h1 "Register". And its chooser closed on two parallel
 * hairlines — the last row's own rule and the shell footer's.
 */
describe("/register", () => {
  it("hands the business door to /b2b/register instead of keeping its own company form", () => {
    expect(source).toMatch(/<Link href="\/b2b\/register" className=\{CHOOSER_ROW\}>/);
    expect(source).not.toMatch(/\/api\/auth\/register\/business/);
    expect(source).toMatch(/fetch\("\/api\/auth\/register\/consumer"/);
    // The company fields are gone with the form.
    expect(source).not.toMatch(/crNumber|companyNameEn|INDUSTRY_VALUES|COMPANY_SIZE_VALUES/);
  });

  it("closes the chooser on one rule, not two", () => {
    expect(source).toMatch(/const CHOOSER_ROW =[\s\S]*?border-b border-hairline[^"]*last:border-b-0/);
  });

  it("titles the page the way its tab does, with an eyebrow that is not a second copy", () => {
    expect(identityCopy("en").register.title).toBe(en.auth.registerTitle);
    expect(identityCopy("ar").register.title).toBe(ar.auth.registerTitle);
    for (const locale of ["en", "ar"] as const) {
      const { eyebrow, title } = identityCopy(locale).register;
      expect(eyebrow).not.toBe(title);
    }
  });
});
