import { describe, expect, it } from "vitest";

import { containsArabicScript, isArabic, looksLikeLatinOnly } from "../arabic";

/**
 * These two predicates exist to drive a warning, never a gate.
 *
 * The reference implementation's own screenshot shows "Zack Khan" sitting in
 * the field labelled Customer Name (Arabic). The fix is to notice and say so —
 * not to reject the value, because a registered Arabic trade name legitimately
 * contains Latin characters, digits and punctuation, and some businesses have
 * no Arabic form of their name at all.
 */
describe("containsArabicScript", () => {
  const ARABIC: Array<[string, string]> = [
    ["plain Arabic", "شركة الخليج"],
    ["Arabic with Latin inside, a real registered shape", "شركة ABC للتجارة"],
    ["Arabic with Arabic-Indic digits", "مؤسسة ٢٠٢٤"],
    ["Arabic Supplement, used outside the Gulf", "ݐݑ"],
    ["Arabic Extended-A", "ࢠࢡ"],
    ["Presentation Forms-A, how an old Windows document pastes", "ﭐﭑ"],
    ["Presentation Forms-B, how many PDFs paste", "ﻰﺍ"],
  ];

  it.each(ARABIC)("finds Arabic in %s", (_label, value) => {
    expect(containsArabicScript(value)).toBe(true);
  });

  const NOT_ARABIC: Array<[string, string]> = [
    ["an empty value", ""],
    ["a Latin name", "Zack Khan"],
    ["digits only", "1010123456"],
    ["punctuation only", "--- ..."],
    ["Hebrew, a different RTL script", "שלום"],
  ];

  it.each(NOT_ARABIC)("finds no Arabic in %s", (_label, value) => {
    expect(containsArabicScript(value)).toBe(false);
  });

  it("keeps the deprecated alias agreeing with it", () => {
    // isArabic used to test only ؀-ۿ, so a name pasted from a PDF as
    // presentation forms came back "not Arabic". It now delegates, which is the
    // only way the two can be guaranteed to give one answer.
    for (const [, value] of [...ARABIC, ...NOT_ARABIC]) {
      expect(isArabic(value)).toBe(containsArabicScript(value));
    }
  });
});

describe("looksLikeLatinOnly", () => {
  it("flags the defect it was written for", () => {
    expect(looksLikeLatinOnly("Zack Khan")).toBe(true);
  });

  it.each([
    ["a name that is already Arabic", "زاك خان"],
    ["a mixed name, which is a legitimate registered form", "شركة ABC للتجارة"],
    ["an empty field, which has nothing to warn about yet", ""],
    ["digits alone", "123456"],
    ["punctuation alone", "-- .. --"],
    ["whitespace alone", "   "],
  ])("does not flag %s", (_label, value) => {
    expect(looksLikeLatinOnly(value)).toBe(false);
  });

  it("stays a warning signal and never claims a value is wrong", () => {
    // Both predicates are pure booleans with no error, no throw and no
    // sanitised return value, so there is nothing here a caller could mistake
    // for permission to block a submission.
    expect(typeof looksLikeLatinOnly("Zack Khan")).toBe("boolean");
    expect(typeof containsArabicScript("زاك")).toBe("boolean");
  });
});

describe("invisible characters that travel with a paste", () => {
  /**
   * Arabic Presentation Forms-B is U+FE70–U+FEFF, and the range was written
   * that way — but its last member is U+FEFF, the byte-order mark, which is not
   * a letter and rides invisibly on anything pasted out of Excel or a CSV
   * export. With the range ending at FEFF, a Latin company name carrying a BOM
   * tested as Arabic and the warning was suppressed for exactly the paste most
   * likely to carry it. The block's real letters stop at U+FEFC.
   */
  it("does not mistake a byte-order mark for Arabic script", () => {
    expect(containsArabicScript("Zack Khan\uFEFF")).toBe(false);
    expect(looksLikeLatinOnly("Zack Khan\uFEFF")).toBe(true);
  });

  it("still recognises a real Presentation Forms-B letter", () => {
    // U+FEFC is the ligature LAM WITH ALEF — the last assigned letter in the block.
    expect(containsArabicScript("\uFEFC")).toBe(true);
  });

  it("recognises ordinary Arabic", () => {
    expect(containsArabicScript("شركة الاختبار")).toBe(true);
    expect(looksLikeLatinOnly("شركة الاختبار")).toBe(false);
  });
});
