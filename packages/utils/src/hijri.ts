/**
 * Umm al-Qura (Hijri) conversion for commercial registration expiry dates.
 *
 * A GCC commercial registration certificate states its expiry in the Hijri
 * calendar. The obvious modelling — store the Hijri expiry and the Gregorian
 * expiry as two columns — is the mistake this module exists to avoid: they are
 * two sources of truth, they drift the instant any code path writes one without
 * the other, and once they disagree there is nothing left to adjudicate which
 * one the ministry actually issued. Avenick stores ONE canonical Gregorian
 * instant plus the verbatim string the applicant typed, and derives the Hijri
 * rendering from the instant every time it is displayed. This module is that
 * derivation, in both directions.
 *
 * Everything here works in UTC. A registration expiry is a calendar day, not a
 * moment: evaluating it in the host timezone would put a Riyadh certificate on
 * a different Hijri day for a reviewer sitting west of UTC, and the reviewer
 * and the applicant would be looking at different dates on the same record.
 */

/** A Hijri calendar date. `year` is AH; years at or before the Hijra are <= 0. */
export type HijriDate = { year: number; month: number; day: number };

const MS_PER_DAY = 86_400_000;

/**
 * 1 Muharram 1 AH. Verified against Intl itself rather than taken from memory:
 * `gregorianToHijri(new Date(HIJRI_EPOCH_UTC_MS))` returns 1/1/1 AH.
 */
const HIJRI_EPOCH_UTC_MS = Date.UTC(622, 6, 19);

/**
 * The arithmetic mean Hijri year and month. These are only used to seed the
 * search below; the authoritative answer always comes back out of Intl.
 */
const MEAN_HIJRI_YEAR_DAYS = 354.367;
const MEAN_HIJRI_MONTH_DAYS = 29.530588;

/**
 * How far either side of the seed estimate hijriToGregorian is allowed to walk.
 *
 * Intl converts Gregorian to Hijri and never the reverse, so the reverse is a
 * bounded search: seed from the mean Hijri year, then walk outwards comparing
 * gregorianToHijri output until it matches. The bound is what makes that
 * terminate, and it must be larger than the worst drift between the seed and
 * the truth.
 *
 * The number is not asserted here in prose, because a comment cannot be run.
 * `hijri.test.ts` measures the real seed error across a spread of the Umm
 * al-Qura range and asserts it stays well inside this radius — so if a future
 * edit to the seed arithmetic widens the drift, a test fails rather than a
 * conversion silently returning null for a date that exists.
 *
 * At this radius the scan is at most 2 * 8 + 1 = 17 Intl lookups and cannot run
 * unbounded whatever the input.
 */
const SEARCH_RADIUS_DAYS = 8;

let hijriSupport: boolean | null = null;
let hijriFormatter: Intl.DateTimeFormat | null = null;

/**
 * Build the one formatter this module uses. `numberingSystem: "latn"` is not
 * cosmetic: several Arabic locales resolve to Arabic-Indic digits by default
 * and `Number("١٤٤٨")` is NaN, so leaving it to CLDR would turn every parsed
 * year into NaN on an Arabic-locale runtime.
 */
function buildFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    timeZone: "UTC",
    era: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    numberingSystem: "latn",
  });
}

/**
 * True when the runtime can actually do Umm al-Qura arithmetic.
 *
 * A runtime built without full ICU silently accepts the `-u-ca-islamic-umalqura`
 * extension and then resolves to `gregory`, so asking for a Hijri date returns
 * a Gregorian one wearing a Hijri label — a wrong date presented as a right
 * one, which on an expiry check is worse than no date at all. Callers must
 * gate on this and degrade to Gregorian-only display rather than convert.
 * The answer cannot change within a process, so it is computed once.
 */
export function isHijriSupported(): boolean {
  if (hijriSupport === null) {
    try {
      hijriSupport = buildFormatter().resolvedOptions().calendar === "islamic-umalqura";
    } catch {
      // Older engines throw on an unknown calendar extension instead of falling back.
      hijriSupport = false;
    }
  }
  return hijriSupport;
}

function requireFormatter(): Intl.DateTimeFormat {
  if (!isHijriSupported()) {
    // Deliberately loud. The alternative — returning a plausible-looking date —
    // is how a certificate that expired last month gets shown as valid.
    throw new Error("Umm al-Qura calendar is unavailable on this runtime; check isHijriSupported() first");
  }
  hijriFormatter ??= buildFormatter();
  return hijriFormatter;
}

/**
 * Convert a Gregorian instant to its Umm al-Qura date, evaluated in UTC.
 *
 * Throws when the runtime lacks the calendar — see requireFormatter.
 */
export function gregorianToHijri(date: Date): HijriDate {
  if (Number.isNaN(date.getTime())) {
    throw new Error("gregorianToHijri received an invalid Date");
  }
  const parts = requireFormatter().formatToParts(date);
  let year = Number.NaN;
  let month = Number.NaN;
  let day = Number.NaN;
  let era = "AH";
  for (const part of parts) {
    if (part.type === "year") year = Number(part.value);
    else if (part.type === "month") month = Number(part.value);
    else if (part.type === "day") day = Number(part.value);
    else if (part.type === "era") era = part.value;
  }
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error("Umm al-Qura formatter returned an unreadable date");
  }
  // Before the Hijra ICU counts years upward again under a BH era. Folding that
  // to 1 - year (so 1 BH becomes 0, 2 BH becomes -1) keeps the year strictly
  // increasing with time, which is the property the search below relies on.
  return { year: era === "AH" ? year : 1 - year, month, day };
}

/** Strictly increasing with calendar order, so it can be compared as one number. */
function hijriOrdinalKey(h: HijriDate): number {
  return (h.year * 12 + (h.month - 1)) * 32 + h.day;
}

/**
 * Convert an Umm al-Qura date to the Gregorian instant at UTC midnight of that
 * day, or null when no such Hijri date exists (30 Safar in a 29-day Safar,
 * month 13, day 31, and so on).
 *
 * Intl only converts Gregorian -> Hijri, so the reverse is a search: seed with
 * the arithmetic mean year, then walk outward comparing gregorianToHijri output
 * until it matches. See SEARCH_RADIUS_DAYS for why the walk terminates.
 *
 * Throws when the runtime lacks the calendar. Null means "that date is not on
 * the calendar", which is a different fact from "we cannot tell", and a caller
 * warning an applicant about a typo must not confuse the two.
 */
export function hijriToGregorian(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  // A Hijri month never has 31 days and a Hijri year never has 13 months, so
  // these are rejected before spending any Intl lookups on them.
  if (month < 1 || month > 12 || day < 1 || day > 30) return null;
  // Keeps a nonsense year (a mistyped 14470) from seeding a Date beyond the
  // ±8.64e15 ms range, where every comparison would be NaN.
  if (year < -5000 || year > 20000) return null;

  requireFormatter();
  const target = hijriOrdinalKey({ year, month, day });
  const seedDays =
    (year - 1) * MEAN_HIJRI_YEAR_DAYS + (month - 1) * MEAN_HIJRI_MONTH_DAYS + (day - 1);
  const seedMs = HIJRI_EPOCH_UTC_MS + Math.round(seedDays) * MS_PER_DAY;

  for (let offset = -SEARCH_RADIUS_DAYS; offset <= SEARCH_RADIUS_DAYS; offset += 1) {
    const candidate = new Date(seedMs + offset * MS_PER_DAY);
    if (Number.isNaN(candidate.getTime())) continue;
    if (hijriOrdinalKey(gregorianToHijri(candidate)) === target) return candidate;
  }
  return null;
}

const ARABIC_INDIC_ZERO = 0x0660; // ٠-٩
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0; // ۰-۹

/**
 * Fold Arabic-Indic and Extended Arabic-Indic digits to ASCII.
 *
 * An applicant copying the expiry off the certificate PDF pastes ١٤٤٧/٠٦/١٢,
 * often with an embedded RTL mark, and `Number("١٤٤٧")` is NaN. Rejecting that
 * paste would be rejecting a real business over its keyboard layout.
 */
function normaliseDigits(input: string): string {
  let out = "";
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String(code - EXTENDED_ARABIC_INDIC_ZERO);
    } else {
      out += char;
    }
  }
  // Bidi control characters travel invisibly with pasted Arabic text.
  return out.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "").trim();
}

/**
 * Parse 'YYYY-MM-DD' as a Hijri date, returning null when the string is not a
 * date at all. This is pure string work and deliberately does NOT touch Intl:
 * on a runtime without the calendar we still want to read what the applicant
 * typed so it can be stored verbatim.
 *
 * `/` and `.` are accepted alongside `-`, and single-digit months and days are
 * accepted, because certificates and the people retyping them use all of them
 * and refusing a legitimate business over a separator is the worse failure.
 * Whether the parsed date exists on the calendar is hijriToGregorian's answer,
 * not this function's.
 */
export function parseHijri(input: string): HijriDate | null {
  if (typeof input !== "string") return null;
  const match = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(normaliseDigits(input));
  if (!match) return null;
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

/**
 * Render a Gregorian instant as a Hijri 'YYYY-MM-DD' string.
 *
 * The shape is fixed across locales so that formatHijri and parseHijri are
 * exact inverses; `locale` only chooses the digits, and only 'ar' differs.
 * The product is English-only by the owner's decision, so 'ar' exists for the
 * case where a Hijri date is shown back beside Arabic certificate text rather
 * than as a translation surface.
 *
 * Throws when the runtime lacks the calendar — a caller that has not checked
 * isHijriSupported() should not silently render a Gregorian date as Hijri.
 */
export function formatHijri(date: Date, locale: "ar" | "en" = "en"): string {
  const { year, month, day } = gregorianToHijri(date);
  // padStart on a negative year would yield "0-23"; pre-Hijra years are absurd
  // for a registration certificate but must not render as a corrupt string.
  const sign = year < 0 ? "-" : "";
  const ascii = `${sign}${String(Math.abs(year)).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (locale !== "ar") return ascii;
  return ascii.replace(/[0-9]/g, (digit) =>
    String.fromCodePoint(ARABIC_INDIC_ZERO + Number(digit)),
  );
}
