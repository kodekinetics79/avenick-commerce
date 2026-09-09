/**
 * Every Unicode block an Arabic-script name can legitimately draw from.
 *
 * The narrow \u0600-\u06FF range on its own is not enough. Arabic Supplement
 * and Arabic Extended-A carry letters used across the wider region, and the
 * Presentation Forms blocks are what a name copied out of a PDF or an older
 * Windows document arrives as — visually identical Arabic that a
 * \u0600-\u06FF-only test reports as "not Arabic". Getting that wrong would
 * mean telling a registrant their own correctly written Arabic name is not
 * Arabic, which is a worse error than saying nothing at all.
 */
// Presentation Forms-B stops at U+FEFC, NOT U+FEFF. The last three code points
// of that block are U+FEFD, U+FEFE (unassigned) and U+FEFF — the byte-order
// mark, which is not an Arabic letter and travels invisibly on anything pasted
// out of Excel or a CSV export. With the range ending at FEFF, "Zack Khan" with
// a trailing BOM tested as Arabic script, so the warning this file exists to
// raise — the reference implementation's own screenshot shows Latin text sitting
// in "Company Name (Arabic)" — was silently suppressed for exactly the paste
// most likely to carry it.
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/;

/** Latin letters — the script that ends up in an Arabic field by mistake. */
const LATIN_LETTER = /[A-Za-z]/;

/** True when the value contains at least one character of Arabic script. */
export function containsArabicScript(value: string): boolean {
  return ARABIC_SCRIPT.test(value ?? "");
}

/**
 * True when the value has Latin letters and no Arabic script at all — the
 * signature of "Zack Khan" typed into the field labelled Customer Name
 * (Arabic), which is what the reference implementation's own screenshot shows.
 *
 * This is a signal for a VISIBLE, NON-BLOCKING warning and nothing more. It
 * must never become a gate. A registered Arabic trade name routinely carries
 * Latin characters, digits and punctuation — "شركة ABC للتجارة" is a real
 * registered name — and a business whose certificate genuinely reads in Latin
 * script has no Arabic form to give us. Blocking either is refusing a
 * legitimate business over a spelling preference. Nudge, never stop.
 *
 * A value with no letters at all — empty, or digits and punctuation only — is
 * not reported, because there is nothing there yet to warn about.
 */
export function looksLikeLatinOnly(value: string): boolean {
  const text = value ?? "";
  return LATIN_LETTER.test(text) && !ARABIC_SCRIPT.test(text);
}

/**
 * @deprecated Use `containsArabicScript`, which also covers the supplement and
 * presentation-form blocks this one missed. Kept as a delegating alias so the
 * two can never disagree about what counts as Arabic.
 */
export function isArabic(text: string): boolean {
  return containsArabicScript(text);
}

/** Returns the correct text-direction for a given locale */
export function getDir(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Picks the correct value based on locale */
export function localize<T>(locale: string, ar: T, en: T): T {
  return locale === "ar" ? ar : en;
}

/** Formats a name for Arabic locale (family name first) */
export function formatNameAr(firstName: string, lastName: string): string {
  return `${lastName} ${firstName}`;
}

/**
 * Maps country codes to Arabic names
 */
export const COUNTRY_NAMES_AR: Record<string, string> = {
  AE: "الإمارات العربية المتحدة",
  SA: "المملكة العربية السعودية",
  QA: "قطر",
  KW: "الكويت",
  BH: "البحرين",
  OM: "عُمان",
};

export const COUNTRY_NAMES_EN: Record<string, string> = {
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
};

export function getCountryName(code: string, locale: "ar" | "en" = "en"): string {
  return locale === "ar"
    ? (COUNTRY_NAMES_AR[code] ?? code)
    : (COUNTRY_NAMES_EN[code] ?? code);
}

/** Wraps a number in Arabic-Indic numerals */
export function toArabicNumerals(num: number): string {
  return num.toLocaleString("ar-EG");
}
