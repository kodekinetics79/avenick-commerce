import type { SupportedCurrency } from "@avenick/utils";

const COUNTRY_CURRENCY: Record<string, SupportedCurrency> = {
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  OM: "OMR",
  BH: "BHD",
};

/** Canonical commerce currency for a company jurisdiction until company-level override is introduced. */
export function companyCurrencyForCountry(country: string): SupportedCurrency {
  return COUNTRY_CURRENCY[country] ?? "USD";
}
