import type { CartItem } from "@/stores/cart";

export function canonicalRequisitionCartLines(
  requestedCount: number,
  response: { currency?: string; lines?: Array<Omit<CartItem, "id">> },
) {
  if (!response.currency || !Array.isArray(response.lines) || response.lines.length !== requestedCount) {
    throw new Error("Requisition pricing response was incomplete");
  }
  for (const line of response.lines) {
    if (!line.productId || !line.slug || !line.sellerId || line.currency !== response.currency
      || !Number.isInteger(line.qty) || line.qty < (line.moq ?? 1)
      || !Number.isFinite(line.unitPrice) || line.vatRate == null || !Number.isFinite(line.vatRate)) {
      throw new Error("Requisition pricing response was incomplete");
    }
  }
  return response.lines;
}
