import type { z } from "zod";

import type { RfqCardSchema, RfqDetailSchema, RfqItemSchema } from "@avenick/contracts";
import type { Prisma } from "@avenick/database";

import { toMoney, toTimestamp } from "../_lib/dto";

type RfqCard = z.infer<typeof RfqCardSchema>;
type RfqDetail = z.infer<typeof RfqDetailSchema>;
type RfqItem = z.infer<typeof RfqItemSchema>;

/**
 * The stored RFQ, as the contract's two DTOs.
 *
 * The projection is thin on purpose — the buyer services already do the
 * scoping, the ordering and the message windowing — so what is left here is
 * Decimals to numbers, Dates to instants, and one deliberate omission.
 *
 * THE OMISSION: no per-line total. `submitQuote` computes the aggregate as
 * `Σ unitQuoted × quantity` and stores it rounded once in `totalQuoted`.
 * Rounding each line separately here and letting the app add them up can differ
 * from the stored figure by cents, which is two numbers on one screen that do
 * not agree. The aggregate is authoritative; a line carries the unit price and
 * the quantity the supplier actually quoted.
 */

interface RfqItemRow {
  id: string;
  productId: string | null;
  nameEn: string;
  quantity: number;
  unitQuoted: Prisma.Decimal | null;
  notes: string | null;
}

interface RfqSellerRow {
  businessNameEn: string;
  tier: string;
}

interface RfqRow {
  id: string;
  rfqNumber: string;
  status: RfqCard["status"];
  currency: RfqCard["currency"];
  totalQuoted: Prisma.Decimal | null;
  quoteVersion: number;
  requiredBy: Date | null;
  createdAt: Date;
  items: RfqItemRow[];
  seller: RfqSellerRow | null;
}

function toRfqItem(item: RfqItemRow): RfqItem {
  return {
    id: item.id,
    productId: item.productId,
    nameEn: item.nameEn,
    quantity: item.quantity,
    // Null until the supplier has priced this line. The app reads the RFQ's
    // STATUS to decide whether a quote exists, never the presence of a price.
    unitQuoted: item.unitQuoted == null ? null : toMoney(item.unitQuoted),
    notes: item.notes,
  };
}

type SellerTier = "STANDARD" | "VERIFIED" | "GOLD" | "PLATINUM";

function toRfqSeller(seller: RfqSellerRow | null): RfqCard["seller"] {
  // `getRFQsForBuyer` / `getRFQForBuyer` select `businessNameEn` and `tier` and
  // no id, so the app can name the supplier but cannot deep-link to them. That
  // is the service's `select`, not a decision made here — flagged in the report.
  //
  // Null is the NORMAL state of a freshly submitted RFQ: `submitQuote` is the
  // only writer of `sellerId`, so nobody is attached until somebody quotes.
  return seller
    ? { businessNameEn: seller.businessNameEn, tier: seller.tier as SellerTier }
    : null;
}

function common(rfq: RfqRow, messageCount: number) {
  return {
    id: rfq.id,
    rfqNumber: rfq.rfqNumber,
    status: rfq.status,
    currency: rfq.currency,
    itemCount: rfq.items.length,
    totalQuoted: rfq.totalQuoted == null ? null : toMoney(rfq.totalQuoted),
    // Not decoration: `decideRFQ` takes this back as `expectedQuoteVersion` and
    // refuses a decision made against a quote the supplier has since revised.
    quoteVersion: rfq.quoteVersion,
    seller: toRfqSeller(rfq.seller),
    requiredBy: rfq.requiredBy ? toTimestamp(rfq.requiredBy) : null,
    createdAt: toTimestamp(rfq.createdAt),
    messageCount,
  };
}

export type RfqCardRow = RfqRow & { _count: { messages: number } };

export function toRfqCard(rfq: RfqCardRow): RfqCard {
  return common(rfq, rfq._count.messages);
}

export type RfqDetailRow = RfqRow & {
  notes: string | null;
  expiresAt: Date | null;
  updatedAt: Date;
  messageTotal: number;
};

export function toRfqDetail(rfq: RfqDetailRow): RfqDetail {
  return {
    ...common(rfq, rfq.messageTotal),
    items: rfq.items.map(toRfqItem),
    notes: rfq.notes,
    /**
     * `RFQRequest.expiresAt` is a real column that NOTHING WRITES. Null is its
     * truthful value everywhere; it is carried because the column exists, and
     * the contract says plainly that an app must not print "expires in N days"
     * from it.
     */
    expiresAt: rfq.expiresAt ? toTimestamp(rfq.expiresAt) : null,
    updatedAt: toTimestamp(rfq.updatedAt),
  };
}
