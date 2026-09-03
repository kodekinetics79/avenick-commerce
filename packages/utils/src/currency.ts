export type SupportedCurrency = "AED" | "SAR" | "QAR" | "KWD" | "BHD" | "OMR" | "USD";

interface CurrencyConfig {
  symbol: string;
  symbolAr: string;
  locale: string;
  decimals: number;
}

const CURRENCY_CONFIG: Record<SupportedCurrency, CurrencyConfig> = {
  AED: { symbol: "AED", symbolAr: "د.إ", locale: "ar-AE", decimals: 2 },
  SAR: { symbol: "SAR", symbolAr: "ر.س", locale: "ar-SA", decimals: 2 },
  QAR: { symbol: "QAR", symbolAr: "ر.ق", locale: "ar-QA", decimals: 2 },
  KWD: { symbol: "KWD", symbolAr: "د.ك", locale: "ar-KW", decimals: 3 },
  BHD: { symbol: "BHD", symbolAr: "د.ب", locale: "ar-BH", decimals: 3 },
  OMR: { symbol: "OMR", symbolAr: "ر.ع", locale: "ar-OM", decimals: 3 },
  USD: { symbol: "USD", symbolAr: "دولار", locale: "en-US", decimals: 2 },
};

/** VAT rates by country code */
export const VAT_RATES: Record<string, number> = {
  AE: 5,
  SA: 15,
  QA: 0,
  KW: 0,
  BH: 10,
  OM: 5,
};

/**
 * Is this code one this platform can format? Callers holding a string from
 * outside the type system — a persisted cart line, a query parameter, a row
 * written before a currency was retired — use this before narrowing.
 */
export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return Object.prototype.hasOwnProperty.call(CURRENCY_CONFIG, code);
}

export function formatCurrency(
  amount: number,
  currency: SupportedCurrency = "AED",
  locale: "ar" | "en" = "en",
): string {
  const config = CURRENCY_CONFIG[currency];
  // A code with no config reaches here from persisted state a `as Currency`
  // cast waved through — a wishlist saved before a currency was retired, a
  // stale localStorage line. Reading `config.symbol` off undefined would take
  // the whole page down over one row, so the amount is shown with its raw code
  // instead: unstyled, but true, and never a different currency's symbol.
  if (!config) {
    return locale === "ar"
      ? `${new Intl.NumberFormat("ar-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${currency}`
      : `${currency} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
  }
  const symbol = locale === "ar" ? config.symbolAr : config.symbol;

  const formatted = new Intl.NumberFormat(locale === "ar" ? config.locale : "en-US", {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(amount);

  return locale === "ar" ? `${formatted} ${symbol}` : `${symbol} ${formatted}`;
}

export function calculateVat(amount: number, countryCode: string): number {
  const rate = VAT_RATES[countryCode] ?? 5;
  return parseFloat(((amount * rate) / 100).toFixed(2));
}

export function calculateOrderTotal(
  subtotal: number,
  countryCode: string,
  shippingAmount = 0,
  discountAmount = 0,
): { subtotal: number; vatAmount: number; shippingAmount: number; discountAmount: number; total: number } {
  const vatAmount = calculateVat(subtotal, countryCode);
  const total = parseFloat((subtotal + vatAmount + shippingAmount - discountAmount).toFixed(2));
  return { subtotal, vatAmount, shippingAmount, discountAmount, total };
}
