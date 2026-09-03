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

/**
 * Arabic amounts are formatted with WESTERN digits, on purpose.
 *
 * Each currency carries its own CLDR locale, and CLDR disagrees with itself
 * about numerals across the Gulf: ar-AE defaults to latn while ar-SA, ar-QA,
 * ar-KW, ar-BH and ar-OM default to arab. Left alone, an Arabic cart holding
 * an AED line and a SAR line prints
 *
 *     1,234.50  د.إ        and        ١٬٢٣٤٫٥٠ ر.س
 *
 * in the same column — two numeral systems, which no amount of tabular-figure
 * work can align, and which reads as a bug to any reader. Pinning the numbering
 * system makes every amount on a page agree.
 *
 * latn rather than arab because that is what Gulf commerce shows: the regional
 * marketplaces this product competes with render Arabic interfaces with Western
 * digits, and prices are the one place a reader cross-checks against an invoice.
 * The `-u-nu-` extension keeps the locale's own grouping and decimal separators,
 * so this changes the digits and nothing else.
 */
const ARABIC_NUMBERING = "-u-nu-latn";

/** Locale actually handed to Intl, with the numbering system pinned. */
function numberLocale(locale: "ar" | "en", currencyLocale: string): string {
  return locale === "ar" ? `${currencyLocale}${ARABIC_NUMBERING}` : "en-US";
}

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
      ? `${new Intl.NumberFormat(numberLocale("ar", "ar-AE"), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${currency}`
      : `${currency} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
  }
  const symbol = locale === "ar" ? config.symbolAr : config.symbol;

  const formatted = new Intl.NumberFormat(numberLocale(locale, config.locale), {
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
