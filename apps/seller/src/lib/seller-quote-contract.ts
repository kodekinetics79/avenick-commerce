import { RECORD_ID } from "@avenick/utils";
import { z } from "zod";

const boundedMoney = z.number().finite().nonnegative().max(999_999_999_999.99);
const positiveUnitPrice = z.number().finite().positive().max(999_999_999_999.9999);
const vatRate = z.number().finite().min(0).max(100);

export const SellerQuotePayloadSchema = z.object({
  rfqId: z.string().regex(RECORD_ID),
  submissionKey: z.string().trim().min(1).max(200),
  items: z.array(z.object({
    rfqItemId: z.string().regex(RECORD_ID),
    productId: z.string().regex(RECORD_ID),
    variantId: z.string().regex(RECORD_ID).optional(),
    unitPrice: positiveUnitPrice,
    vatRate,
  })).min(1).max(50),
  freightAmount: boundedMoney,
  freightVatRate: vatRate,
  validUntil: z.string().datetime(),
  leadTimeDays: z.number().int().min(0).max(3650),
  paymentTermsDays: z.number().int().min(0).max(3650),
  notes: z.string().trim().max(2000).optional(),
});

export type SellerQuotePayload = z.infer<typeof SellerQuotePayloadSchema>;

export function estimateSellerQuote(input: {
  lines: Array<{ quantity: number; unitPrice: number; vatRate: number }>;
  freightAmount: number;
  freightVatRate: number;
}) {
  const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const vatAmount = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * line.vatRate / 100, 0);
  const freightVatAmount = input.freightAmount * input.freightVatRate / 100;
  return {
    subtotal,
    vatAmount,
    freightVatAmount,
    total: subtotal + vatAmount + input.freightAmount + freightVatAmount,
  };
}
