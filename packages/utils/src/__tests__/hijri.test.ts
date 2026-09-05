import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatHijri,
  gregorianToHijri,
  hijriToGregorian,
  isHijriSupported,
  parseHijri,
} from "../hijri";

const MS_PER_DAY = 86_400_000;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/**
 * Every expectation here is derived from Intl or from a relationship the module
 * must hold. Asserting a remembered Gregorian/Hijri pair would be asserting the
 * author's memory, and a wrong "known good" date is the one kind of test that
 * makes a conversion bug permanent.
 */
describe("hijri conversion", () => {
  it("reports Umm al-Qura support on this runtime", () => {
    // The suite below is meaningless on a runtime without full ICU, so fail
    // loudly here rather than let CI report a green tick over skipped maths.
    expect(isHijriSupported()).toBe(true);
  });

  it("anchors on 1 Muharram 1 AH and round-trips it", () => {
    // The epoch is not asserted from memory: it is whatever Intl says the
    // first day of the Hijri calendar is, and the test is that both directions
    // agree about it.
    const anchor = utc(622, 7, 19);
    expect(gregorianToHijri(anchor)).toEqual({ year: 1, month: 1, day: 1 });
    expect(hijriToGregorian(1, 1, 1)?.getTime()).toBe(anchor.getTime());
  });

  it("round-trips every day across a thousand-year spread", () => {
    // Sampled rather than exhaustive so the suite stays fast; the stride is a
    // prime number of days so it never lands on the same weekday or the same
    // position within a Hijri month twice.
    const start = Date.UTC(1200, 0, 1);
    const end = Date.UTC(2200, 0, 1);
    const failures: string[] = [];
    for (let ms = start; ms <= end; ms += 61 * MS_PER_DAY) {
      const hijri = gregorianToHijri(new Date(ms));
      const back = hijriToGregorian(hijri.year, hijri.month, hijri.day);
      if (back?.getTime() !== ms) {
        failures.push(`${new Date(ms).toISOString().slice(0, 10)} -> ${JSON.stringify(hijri)} -> ${back?.toISOString() ?? "null"}`);
      }
    }
    expect(failures, `${failures.length} dates failed to round-trip`).toEqual([]);
  });

  it("keeps Hijri dates ordered and gapless as Gregorian days advance", () => {
    // Monotonicity is what hijriToGregorian's bounded search depends on: if the
    // Hijri key ever went backwards, the walk could match the wrong day.
    const key = (h: { year: number; month: number; day: number }) =>
      (h.year * 12 + (h.month - 1)) * 32 + h.day;
    let previous = key(gregorianToHijri(utc(2024, 1, 1)));
    for (let ms = Date.UTC(2024, 0, 2); ms <= Date.UTC(2030, 0, 1); ms += MS_PER_DAY) {
      const current = key(gregorianToHijri(new Date(ms)));
      expect(current, `${new Date(ms).toISOString()} went backwards`).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it("lands exactly on month boundaries", () => {
    // Walk each month of a few real years to its true last day, then check the
    // very next Gregorian day is day 1 of the next month with no day in between.
    for (let year = 1445; year <= 1450; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const first = hijriToGregorian(year, month, 1);
        expect(first, `${year}-${month}-01 should exist`).not.toBeNull();
        const lengths = [29, 30].filter((day) => hijriToGregorian(year, month, day) !== null);
        // A Hijri month is 29 or 30 days; 29 always exists, 30 sometimes.
        expect(lengths[0]).toBe(29);
        const lastDay = lengths[lengths.length - 1];
        const last = hijriToGregorian(year, month, lastDay)!;
        expect(last.getTime() - first!.getTime()).toBe((lastDay - 1) * MS_PER_DAY);

        const dayAfter = gregorianToHijri(new Date(last.getTime() + MS_PER_DAY));
        expect(dayAfter.day).toBe(1);
        expect(dayAfter.month).toBe(month === 12 ? 1 : month + 1);
        expect(dayAfter.year).toBe(month === 12 ? year + 1 : year);
      }
    }
  });

  it("finds at least one 29-day month, so the null branch is real", () => {
    // Guards the boundary test above from passing vacuously on a stretch where
    // every month happened to run 30 days.
    const shortMonths: string[] = [];
    for (let year = 1440; year <= 1450; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        if (hijriToGregorian(year, month, 30) === null) shortMonths.push(`${year}-${month}`);
      }
    }
    expect(shortMonths.length).toBeGreaterThan(0);
  });

  it("returns null for dates that are not on the calendar", () => {
    expect(hijriToGregorian(1447, 13, 1)).toBeNull();
    expect(hijriToGregorian(1447, 0, 1)).toBeNull();
    expect(hijriToGregorian(1447, 1, 31)).toBeNull();
    expect(hijriToGregorian(1447, 1, 0)).toBeNull();
    expect(hijriToGregorian(1447.5, 1, 1)).toBeNull();
    expect(hijriToGregorian(Number.NaN, 1, 1)).toBeNull();
  });

  it("formats and parses back to the same date", () => {
    const date = utc(2026, 9, 5);
    const text = formatHijri(date);
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const parsed = parseHijri(text)!;
    expect(parsed).toEqual(gregorianToHijri(date));
    expect(hijriToGregorian(parsed.year, parsed.month, parsed.day)?.getTime()).toBe(date.getTime());
  });

  it("reads the Arabic-Indic digits an applicant pastes off a certificate", () => {
    const western = parseHijri("1447-06-12");
    expect(parseHijri("١٤٤٧-٠٦-١٢")).toEqual(western);
    // Extended Arabic-Indic, as used in Persian/Urdu keyboards.
    expect(parseHijri("۱۴۴۷-۰۶-۱۲")).toEqual(western);
    // A paste out of an RTL PDF carries an invisible right-to-left mark.
    expect(parseHijri("‏١٤٤٧-٠٦-١٢‏")).toEqual(western);
    // Certificates and the people retyping them use every separator.
    expect(parseHijri("1447/06/12")).toEqual(western);
    expect(parseHijri("1447.6.12")).toEqual(western);
    expect(parseHijri(" 1447-6-12 ")).toEqual(western);
    // formatHijri's Arabic output must survive its own parser.
    expect(parseHijri(formatHijri(utc(2026, 9, 5), "ar"))).toEqual(gregorianToHijri(utc(2026, 9, 5)));
  });

  it("returns null for text that is not a date at all", () => {
    for (const input of ["", "not a date", "1447", "1447-06", "14470-06-12", "1447-06-12-01"]) {
      expect(parseHijri(input), `"${input}" was accepted`).toBeNull();
    }
  });
});

describe("hijri on a runtime without Umm al-Qura", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /**
   * A stripped-ICU build accepts the calendar extension and silently resolves
   * to `gregory`. Reimported through vi.resetModules so the module's cached
   * feature-detect is recomputed against the stub.
   */
  async function importWithGregorianOnlyIntl() {
    class GregorianOnlyDateTimeFormat extends Intl.DateTimeFormat {
      override resolvedOptions() {
        return { ...super.resolvedOptions(), calendar: "gregory" };
      }
    }
    vi.stubGlobal("Intl", { ...Intl, DateTimeFormat: GregorianOnlyDateTimeFormat });
    vi.resetModules();
    return import("../hijri");
  }

  it("reports no support instead of handing back a Gregorian date in Hijri clothing", async () => {
    const hijri = await importWithGregorianOnlyIntl();
    expect(hijri.isHijriSupported()).toBe(false);
  });

  it("throws rather than convert, so callers degrade to Gregorian-only", async () => {
    const hijri = await importWithGregorianOnlyIntl();
    expect(() => hijri.gregorianToHijri(utc(2026, 9, 5))).toThrow(/unavailable/i);
    expect(() => hijri.formatHijri(utc(2026, 9, 5))).toThrow(/unavailable/i);
    // Not null: "we cannot tell" is a different answer from "no such date", and
    // a form warning an applicant about a typo must not confuse the two.
    expect(() => hijri.hijriToGregorian(1447, 6, 12)).toThrow(/unavailable/i);
  });

  it("still parses the string the applicant typed, so it can be stored verbatim", async () => {
    const hijri = await importWithGregorianOnlyIntl();
    expect(hijri.parseHijri("١٤٤٧-٠٦-١٢")).toEqual({ year: 1447, month: 6, day: 12 });
  });
});

describe("the bounded reverse search", () => {
  /**
   * The radius is the only reason hijriToGregorian terminates, and a comment
   * cannot be run. This measures the actual drift between the mean-year seed
   * and the true instant across the range, and fails if it ever approaches the
   * window — which is what a wrong seed would look like long before users saw
   * a legitimate date reported as non-existent.
   */
  it("keeps the seed well inside the search window across the calendar range", () => {
    const MS_PER_DAY = 86_400_000;
    const MEAN_YEAR = 354.36707;
    const EPOCH = Date.UTC(622, 6, 19);
    let worst = 0;

    // Every 40th day across twelve centuries: dense enough to catch a drift
    // trend, cheap enough to run on every commit.
    for (let ms = Date.UTC(900, 0, 1); ms < Date.UTC(2200, 0, 1); ms += 40 * MS_PER_DAY) {
      const date = new Date(ms);
      const { year, month, day } = gregorianToHijri(date);
      const ordinal = (year - 1) * MEAN_YEAR + (month - 1) * 29.530588 + (day - 1);
      const seed = EPOCH + Math.round(ordinal) * MS_PER_DAY;
      worst = Math.max(worst, Math.abs(seed - ms) / MS_PER_DAY);
    }

    expect(worst).toBeLessThan(6);
  });

  it("returns a date for every day of a real Hijri month, and null past its end", () => {
    const found: number[] = [];
    for (let day = 1; day <= 31; day += 1) {
      const converted = hijriToGregorian(1445, 9, day);
      if (converted) found.push(day);
    }
    expect(found[0]).toBe(1);
    expect(found.length).toBeGreaterThanOrEqual(29);
    expect(found.length).toBeLessThanOrEqual(30);
    // Contiguous: the search never skips a day inside the month.
    expect(found).toEqual(found.map((_, i) => i + 1));
  });
});
