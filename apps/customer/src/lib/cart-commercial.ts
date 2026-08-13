export type CommercialCartLine = {
  unitPrice: number;
  qty: number;
  currency: string;
  vatRate?: number;
};

const money = (value: number) => Number(value.toFixed(2));

/** Display summary only when every line carries one coherent commercial currency and VAT fact. */
export function summarizeCartCommercial(lines: CommercialCartLine[]) {
  const currencies = [...new Set(lines.map((line) => line.currency).filter(Boolean))];
  const missingCommercialFact = lines.some((line) =>
    !Number.isFinite(line.unitPrice) || !Number.isInteger(line.qty) || line.qty <= 0
    || line.vatRate == null || !Number.isFinite(line.vatRate) || line.vatRate < 0,
  );
  if (lines.length === 0 || currencies.length !== 1 || missingCommercialFact) {
    return { valid: false as const, reason: currencies.length > 1 ? "MIXED_CURRENCY" as const : "INCOMPLETE_COMMERCIAL_FACTS" as const };
  }
  const subtotal = money(lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0));
  const vatAmount = money(lines.reduce((sum, line) => sum + line.unitPrice * line.qty * (line.vatRate! / 100), 0));
  return { valid: true as const, currency: currencies[0]!, subtotal, vatAmount, total: money(subtotal + vatAmount) };
}
