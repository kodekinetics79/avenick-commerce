import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { identityCopy } from "@/app/auth/identity-copy";

const appDir = fileURLToPath(new URL("../../../app/", import.meta.url));
const read = (rel: string) => readFileSync(join(appDir, rel), "utf8");

/**
 * The storefront has three password fields — sign-in, /register and
 * /b2b/register — and none had a show-password control. The component test
 * beside this file holds the control's behaviour; this holds that every one of
 * the three forms actually renders it, with its name from the shared copy.
 */
describe("every storefront password field carries the show-password toggle", () => {
  it.each([
    ["login/login-form.tsx", /<PasswordInput\b[\s\S]*?autoComplete="current-password"/],
    ["register/page.tsx", /<PasswordInput\b[\s\S]*?autoComplete="new-password"/],
    ["b2b/register/page.tsx", /<ValidatedPasswordField\b[^>]*autoComplete="new-password"/],
  ])("%s", (file, field) => {
    const source = read(file);
    expect(source).toMatch(field);
    // The locale argument may itself be a call — identityCopy(toIdentityLocale(locale)).
    expect(source).toMatch(/revealLabel=\{identityCopy\(.*?\)\.passwordReveal\.label\}/);
    // No bare password input left beside it.
    expect(source).not.toMatch(/type="password"/);
  });

  it("names the toggle in both languages", () => {
    expect(identityCopy("en").passwordReveal.label).toBe("Show password");
    expect(identityCopy("ar").passwordReveal.label).toMatch(/[؀-ۿ]/);
  });
});
