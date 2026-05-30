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

export function formatCurrency(
  amount: number,
  currency: SupportedCurrency = "AED",
  locale: "ar" | "en" = "en",
): string {
  const config = CURRENCY_CONFIG[currency];
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
