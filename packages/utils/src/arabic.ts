/** Returns true if the string contains Arabic characters */
export function isArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
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
