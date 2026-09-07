import { describe, expect, it } from "vitest";
import { B2B_MESSAGES } from "../messages";

/**
 * The guard on the buyer suite's Arabic.
 *
 * TypeScript already enforces that both dictionaries hold the same KEYS —
 * `ar` is typed `Record<B2BKey, string>`, so a missing one is a build error.
 * What it cannot see is a key whose Arabic value is an English sentence, which
 * is how this catalogue actually degrades: a track adds a feature, copies its
 * English strings into both dictionaries to stop the page throwing, and means
 * to come back. The page then renders half-translated in front of an Arabic
 * buyer, which is the exact defect messages.ts's own header argues against.
 *
 * This test is what makes "come back to it later" impossible to forget.
 */
const ARABIC = /[؀-ۿݐ-ݿ]/;

/**
 * Values that are correctly identical or ASCII in both languages.
 *
 * `register.titleAlt` is the load-bearing one and is NOT an oversight: the
 * registration page prints a second line in the OTHER language, so on the
 * Arabic page that key deliberately holds the English sentence. A name ending
 * in "Ar" would have invited exactly the "correction" this list prevents.
 */
const DELIBERATELY_NOT_ARABIC = new Set<string>(["register.titleAlt"]);

describe("b2b message catalogue — locale parity", () => {
  const en = B2B_MESSAGES.en as Record<string, string>;
  const ar = B2B_MESSAGES.ar as Record<string, string>;

  it("holds the same keys in both languages", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it("has no English left standing in the Arabic dictionary", () => {
    const untranslated = Object.keys(ar).filter((key) => {
      if (DELIBERATELY_NOT_ARABIC.has(key)) return false;
      const value = ar[key] ?? "";
      // Very short values are things like "PO" or a currency code, which are
      // the same in both languages and carry no sentence to translate.
      if (value.trim().length <= 2) return false;
      // A value that is nothing but an interpolation ("{count}") is language-
      // neutral by construction.
      if (/^[\s{}\w.]*$/.test(value) && /^\{[^}]+\}$/.test(value.trim())) return false;
      return !ARABIC.test(value);
    });

    expect(untranslated, `Arabic values with no Arabic in them:\n  ${untranslated.join("\n  ")}`).toEqual([]);
  });

  it("keeps the same interpolation placeholders in both languages", () => {
    // A dropped `{company}` is worse than an untranslated sentence: the Arabic
    // reader is shown a promise with its subject missing.
    //
    // ONE EXEMPTION, and it is a fact about Arabic rather than a fudge. The
    // singular and dual forms carry the number in the WORD — "بند واحد" is "one
    // line", "يومين" is "two days" — so an Arabic `.one` string correctly has no
    // `{count}` to interpolate, where English renders "{count} line" as "1 line".
    // The exemption is deliberately narrow: only `count`, and only on a `.one`
    // or `.two` key. Dropping any other placeholder, or dropping one anywhere
    // else, is still a failure.
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const lexicalCount = (key: string) => key.endsWith(".one") || key.endsWith(".two");

    const mismatched = Object.keys(en).filter((key) => {
      const inEn = placeholders(en[key] ?? "");
      const inAr = placeholders(ar[key] ?? "");
      if (JSON.stringify(inEn) === JSON.stringify(inAr)) return false;
      if (!lexicalCount(key)) return true;
      // Everything except `count` must still match exactly.
      return JSON.stringify(inEn.filter((n) => n !== "count")) !== JSON.stringify(inAr.filter((n) => n !== "count"));
    });

    expect(mismatched, `keys whose placeholders differ between locales:\n  ${mismatched.join("\n  ")}`).toEqual([]);
  });
});
