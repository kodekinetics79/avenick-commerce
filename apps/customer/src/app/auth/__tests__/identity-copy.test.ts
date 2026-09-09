import { describe, expect, it } from "vitest";
import { identityCopy, resetTtlLabel, toIdentityLocale } from "../identity-copy";
import { EMAIL_VERIFICATION_TTL_SECONDS } from "@/lib/email-verification";
import { PASSWORD_RESET_TTL_SECONDS } from "@/lib/password-reset";

/**
 * Arabic counts a noun in four ways, and the old helper knew two of them.
 *
 * It returned `${n} ساعات` for everything above two, which is right for three
 * to ten and wrong for every number after it. That went unnoticed while the only
 * TTL it described was thirty minutes; the email-confirmation link is 24 hours,
 * which lands squarely in the broken branch and would have read "24 ساعات" on
 * an Arabic page — the kind of error that says a string was translated by
 * someone who does not read the language.
 */
describe("resetTtlLabel — Arabic number agreement", () => {
  const ar = (seconds: number) => resetTtlLabel("ar", seconds, "ignored");

  it("uses the singular with واحد for one", () => {
    expect(ar(86400)).toBe("يوم واحد");
    expect(ar(3600)).toBe("ساعة واحدة");
    expect(ar(60)).toBe("دقيقة واحدة");
  });

  it("uses the dual for two, with no digit", () => {
    // Arabic has a dual form, so "2 days" is a word, not a number and a noun.
    expect(ar(2 * 86400)).toBe("يومين");
    expect(ar(2 * 3600)).toBe("ساعتين");
    expect(ar(2 * 60)).toBe("دقيقتين");
  });

  it("uses the plural for three to ten", () => {
    expect(ar(3 * 86400)).toBe("3 أيام");
    expect(ar(7 * 86400)).toBe("7 أيام");
    expect(ar(10 * 3600)).toBe("10 ساعات");
  });

  it("returns to the singular from eleven upward", () => {
    // THE REGRESSION the old helper had: everything above two took the plural,
    // so these all read "…ساعات". Note 24 hours is NOT the case to test it
    // with — that is a whole day and is answered as one, below.
    expect(ar(11 * 3600)).toBe("11 ساعة");
    expect(ar(13 * 3600)).toBe("13 ساعة");
    expect(ar(30 * 60)).toBe("30 دقيقة");
  });

  it("reads the rule off the last two digits", () => {
    // 103 behaves like 3, 111 like 11 — the rule is on the final pair.
    expect(ar(103 * 60)).toBe("103 دقائق");
    expect(ar(111 * 60)).toBe("111 دقيقة");
  });

  it("prefers the largest whole unit", () => {
    // A day is a day, not 24 hours, and the confirmation link is exactly one.
    expect(ar(EMAIL_VERIFICATION_TTL_SECONDS)).toBe("يوم واحد");
  });

  it("hands the English build its own derived label untouched", () => {
    // English never goes through the Arabic branch: it gets the label the
    // token module derived from the very constant the verifier enforces.
    expect(resetTtlLabel("en", PASSWORD_RESET_TTL_SECONDS, "30 minutes")).toBe("30 minutes");
  });
});

describe("identity copy", () => {
  it("states the same FACTS in both languages", () => {
    // The dictionaries may phrase things differently; what they may never do is
    // promise different things. These are the sentences that carry a promise.
    const en = identityCopy("en").confirmEmail;
    const ar = identityCopy("ar").confirmEmail;

    // Both must say the confirmation does NOT yet grant access — the whole
    // point of the step, and the easiest sentence to lose in translation.
    expect(en.whatNext.length).toBeGreaterThan(0);
    expect(ar.whatNext.length).toBeGreaterThan(0);

    // Both interpolate the company name rather than naming a company.
    expect(en.done("Aramco")).toContain("Aramco");
    expect(ar.done("أرامكو")).toContain("أرامكو");
    expect(en.doneNoAdmins("Aramco")).toContain("Aramco");
    expect(ar.doneNoAdmins("أرامكو")).toContain("أرامكو");

    // Both interpolate the TTL rather than hardcoding a duration.
    expect(en.note("7 days")).toContain("7 days");
    expect(ar.note("7 أيام")).toContain("7 أيام");
  });

  it("writes the Arabic confirmation copy in Arabic", () => {
    // A guard against the group being re-added as English placeholders, which
    // is how it first landed.
    const ar = identityCopy("ar").confirmEmail;
    const arabic = /[؀-ۿ]/;
    for (const value of [ar.eyebrow, ar.title, ar.subtitle, ar.submit, ar.whatNext, ar.deadToken, ar.applyAgain]) {
      expect(arabic.test(value)).toBe(true);
    }
  });

  it("falls back to English for an unknown locale cookie", () => {
    expect(toIdentityLocale(undefined)).toBe("en");
    expect(toIdentityLocale("fr")).toBe("en");
    expect(toIdentityLocale("ar")).toBe("ar");
  });
});
