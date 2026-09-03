import { AuditAction, Prisma, type OrderStatus, type RFQStatus } from "@prisma/client";
import { db } from "../index";
import { requireCurrentSellerActor } from "./checkout-invariants";

// ─── SELLER-EDITABLE PROFILE ─────────────────────────────────────────────────
//
// A seller may change how they present themselves and where they are paid.
// Registration identity (crNumber, vatNumber, country, type) and platform
// decisions (tier, status, commissionRate) are deliberately NOT writable here:
// changing any of them re-opens verification, which is an admin decision.

/**
 * Shape of SellerProfile.bankDetails (Json). There is no BankAccount model;
 * the column is the only home for payout details, so the shape is pinned here
 * and every reader goes through parseSellerBankDetails.
 */
export interface SellerBankDetails {
  iban: string;
  bankName: string;
  accountName: string;
  /** ISO timestamp of the last change, so payouts can tell a stale account. */
  updatedAt: string;
}

/**
 * Tolerant read of the Json column. Older rows (or rows written by a future
 * shape) come back as null rather than a half-populated object — the UI then
 * says "not configured" instead of rendering an empty IBAN as configured.
 */
export function parseSellerBankDetails(value: unknown): SellerBankDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const iban = typeof row.iban === "string" ? row.iban : "";
  const bankName = typeof row.bankName === "string" ? row.bankName : "";
  const accountName = typeof row.accountName === "string" ? row.accountName : "";
  if (!iban || !bankName || !accountName) return null;
  return {
    iban,
    bankName,
    accountName,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  };
}

/** Canonical IBAN form: no spaces, upper-case. Applied before validation and storage. */
export function normaliseIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * ISO 13616 IBAN check: country code, two check digits, 11–30 alphanumerics,
 * and the mod-97 remainder must be 1. A payout to an IBAN that fails this is a
 * guaranteed bounce, so it is refused at input time rather than discovered at
 * settlement. Country-specific lengths are not enforced — the checksum already
 * catches transposition and truncation, and a length table would need
 * maintaining for every corridor the platform ever pays into.
 */
export function isValidIban(raw: string): boolean {
  const iban = normaliseIban(raw);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  // Letters become two digits (A=10 … Z=35); the number is reduced mod 97 in
  // chunks because it far exceeds Number's safe integer range.
  let remainder = 0;
  for (const char of rearranged) {
    const token = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of token) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** Everything but the last four characters is hidden — enough for the seller to recognise the account. */
export function maskIban(iban: string): string {
  const clean = normaliseIban(iban);
  if (clean.length <= 4) return "••••";
  return `${clean.slice(0, 2)}•• •••• •••• ${clean.slice(-4)}`;
}

export interface SellerProfileEdit {
  businessNameEn: string;
  businessNameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  city: string;
}

export interface SellerBankEdit {
  iban: string;
  bankName: string;
  accountName: string;
}

export interface UpdateSellerSettingsInput {
  sellerId: string;
  actorId: string;
  /** Omit to leave presentation fields untouched. */
  profile?: SellerProfileEdit;
  /** Omit to leave payout details untouched. Never partially applied. */
  bank?: SellerBankEdit;
}

const PROFILE_FIELDS: Array<keyof SellerProfileEdit> = [
  "businessNameEn",
  "businessNameAr",
  "description",
  "descriptionAr",
  "city",
];

/**
 * Apply a seller's own settings change with the same governance as every other
 * seller mutation: actor re-resolved inside the transaction, seller row fenced,
 * and an audit entry carrying only the fields that actually changed.
 *
 * Bank details are the one place the audit trail is deliberately blind: the
 * entry records that they changed, never what they were or became. Anyone who
 * can read AuditLog is not thereby entitled to read IBANs.
 */
export async function updateSellerSettings(input: UpdateSellerSettingsInput): Promise<{ changed: string[] }> {
  if (input.bank && !isValidIban(input.bank.iban)) {
    throw new Error("That IBAN did not pass the checksum — re-enter it exactly as printed by your bank.");
  }

  return db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, input.actorId, input.sellerId, "settings.manage");

    const current = await tx.sellerProfile.findUnique({
      where: { id: input.sellerId },
      select: {
        deletedAt: true,
        businessNameEn: true,
        businessNameAr: true,
        description: true,
        descriptionAr: true,
        city: true,
        bankDetails: true,
      },
    });
    if (!current || current.deletedAt) throw new Error("Seller not found");

    const data: Prisma.SellerProfileUpdateInput = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (input.profile) {
      for (const field of PROFILE_FIELDS) {
        const next = input.profile[field];
        const prev = current[field];
        if ((prev ?? null) === (next ?? null)) continue;
        // SellerProfileEdit keeps the NOT NULL columns typed `string`; the
        // per-field union here is wider than any single column's input type.
        Object.assign(data, { [field]: next });
        before[field] = prev ?? null;
        after[field] = next ?? null;
      }
    }

    if (input.bank) {
      const iban = normaliseIban(input.bank.iban);
      const existing = parseSellerBankDetails(current.bankDetails);
      const unchanged =
        existing !== null &&
        existing.iban === iban &&
        existing.bankName === input.bank.bankName &&
        existing.accountName === input.bank.accountName;
      if (!unchanged) {
        const next: SellerBankDetails = {
          iban,
          bankName: input.bank.bankName,
          accountName: input.bank.accountName,
          updatedAt: new Date().toISOString(),
        };
        data.bankDetails = next as unknown as Prisma.InputJsonObject;
        before.bankDetails = existing ? "configured" : "not configured";
        after.bankDetails = "changed";
      }
    }

    const changed = Object.keys(after);
    if (changed.length === 0) return { changed };

    await tx.sellerProfile.update({ where: { id: input.sellerId }, data });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: input.sellerId,
        entityType: "SellerProfile",
        entityId: input.sellerId,
        action: AuditAction.UPDATE,
        before: before as Prisma.InputJsonObject,
        after: after as Prisma.InputJsonObject,
      },
    });
    return { changed };
  });
}

// ─── PERFORMANCE SCORE ───────────────────────────────────────────────────────
//
// SellerProfile.accountHealth is a column nothing recomputes (schema default
// 100; the seed no longer writes it), and the sidebar used to hard-code 87. Neither is a
// measurement. The score below is derived on read from three signals the schema
// actually records:
//
//   fulfilment   50  paid order lines (order.paymentStatus PAID, line not
//                    cancelled) created in the trailing window that have reached
//                    SHIPPED or later, as a share of all such paid lines. Unpaid
//                    and admin-cancelled-before-payment lines are excluded: the
//                    only CANCELLED writer in the codebase is the admin cancel of
//                    an UNPAID/FAILED order, which says nothing about the seller.
//                    A paid line the seller has not shipped yet counts against
//                    the share — that is the seller's live backlog, and the
//                    tooltip shows the raw "x of y" so the reader can see it.
//   listing      25  ACTIVE products with no open ProductIssue, as a share of
//                    ACTIVE products.
//   compliance   25  the seller's CURRENT document per type (latest upload)
//                    that is APPROVED and not past its expiry date, as a share
//                    of document types on file. Superseded and replaced uploads
//                    stay in the table as REJECTED rows forever, so counting
//                    every row would punish a seller for re-uploading.
//
// There is deliberately no RFQ responsiveness component. RFQRequest.sellerId is
// written only by submitQuote — an RFQ is assigned to a seller by the act of
// quoting it — so "RFQs answered / RFQs asked" would be 100% for every seller
// by construction. A component that cannot be anything but perfect is not a
// signal; it is a fabricated 20 points. RFQs still count as activity: a seller
// who has quoted MIN_RFQS_FOR_SCORE of them in the window has enough history to
// be scored on the signals above.
//
// A component with an empty denominator is omitted and the remaining weights
// are renormalised, so a seller with no documents is not scored on documents.
// The whole score is null — "not enough data yet" — when the seller has fewer
// than MIN_ORDER_ITEMS paid order lines AND fewer than MIN_RFQS quoted RFQs in
// the window, or when no component has a denominator at all. A number on no
// data is a fabrication, and the UI must say so instead of showing one.

export const PERFORMANCE_WINDOW_DAYS = 90;
export const MIN_ORDER_ITEMS_FOR_SCORE = 5;
export const MIN_RFQS_FOR_SCORE = 3;

export const PERFORMANCE_COMPONENT_WEIGHTS = {
  fulfilment: 50,
  listing: 25,
  compliance: 25,
} as const;

export type PerformanceComponentKey = keyof typeof PERFORMANCE_COMPONENT_WEIGHTS;

export const PERFORMANCE_COMPONENT_LABELS: Record<PerformanceComponentKey, string> = {
  fulfilment: "Paid orders shipped",
  listing: "Listing health",
  compliance: "Compliance documents",
};

/** A share expressed as counts so the UI can show "12 of 15" rather than a bare percentage. */
export interface PerformanceRatio {
  good: number;
  total: number;
}

export interface SellerPerformanceSignals {
  /** Paid, non-cancelled seller order lines created in the window — a threshold input, not a ratio. */
  orderItemsInWindow: number;
  /** RFQs the seller quoted in the window (non-draft, non-cancelled) — a threshold input. */
  rfqsInWindow: number;
  fulfilment: PerformanceRatio;
  listing: PerformanceRatio;
  compliance: PerformanceRatio;
}

export interface PerformanceComponent {
  key: PerformanceComponentKey;
  label: string;
  weight: number;
  /** Share in 0..1, or null when the component had no data and was omitted. */
  share: number | null;
  good: number;
  total: number;
}

export interface SellerPerformanceScore {
  /** Integer 0..100. */
  score: number;
  components: PerformanceComponent[];
  windowDays: number;
}

function clampShare(ratio: PerformanceRatio): number | null {
  if (!Number.isFinite(ratio.total) || ratio.total <= 0) return null;
  const good = Number.isFinite(ratio.good) ? ratio.good : 0;
  return Math.min(1, Math.max(0, good / ratio.total));
}

/**
 * Pure scoring step, separated from the queries so it can be unit-tested with
 * fabricated inputs. Returns null when the inputs cannot honestly support a
 * number — see the rationale above.
 */
export function scoreFromSignals(signals: SellerPerformanceSignals): SellerPerformanceScore | null {
  const enoughOrders = signals.orderItemsInWindow >= MIN_ORDER_ITEMS_FOR_SCORE;
  const enoughRfqs = signals.rfqsInWindow >= MIN_RFQS_FOR_SCORE;
  if (!enoughOrders && !enoughRfqs) return null;

  const components: PerformanceComponent[] = (Object.keys(PERFORMANCE_COMPONENT_WEIGHTS) as PerformanceComponentKey[]).map((key) => {
    const ratio = signals[key];
    return {
      key,
      label: PERFORMANCE_COMPONENT_LABELS[key],
      weight: PERFORMANCE_COMPONENT_WEIGHTS[key],
      share: clampShare(ratio),
      good: ratio.good,
      total: ratio.total,
    };
  });

  const available = components.filter((component) => component.share !== null);
  const totalWeight = available.reduce((sum, component) => sum + component.weight, 0);
  if (totalWeight === 0) return null;

  const weighted = available.reduce((sum, component) => sum + component.weight * (component.share as number), 0);
  const score = Math.round((weighted / totalWeight) * 100);
  return {
    score: Math.min(100, Math.max(0, score)),
    components,
    windowDays: PERFORMANCE_WINDOW_DAYS,
  };
}

/**
 * A line has left the seller's hands once it is SHIPPED or anything that can
 * only follow shipping. RETURN_REQUESTED/RETURNED are post-delivery states:
 * a return is a separate signal, not a fulfilment failure.
 */
const SHIPPED_OR_LATER: OrderStatus[] = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURN_REQUESTED", "RETURNED"];
const RFQ_NOT_ASKED: RFQStatus[] = ["DRAFT", "CANCELLED"];

/**
 * Gather the raw signals. Order lines carry their own status once the seller
 * starts fulfilling them, but admin-driven order moves are written to the
 * parent order only, so both levels are consulted for "shipped".
 */
export async function loadSellerPerformanceSignals(sellerId: string, now = new Date()): Promise<SellerPerformanceSignals> {
  const since = new Date(now.getTime() - PERFORMANCE_WINDOW_DAYS * 86_400_000);
  const inWindow = { sellerId, createdAt: { gte: since } };
  // Only what a buyer actually paid for can be held against the seller.
  const paidLine: Prisma.OrderItemWhereInput = {
    ...inWindow,
    status: { not: "CANCELLED" },
    order: { paymentStatus: "PAID", status: { not: "CANCELLED" } },
  };

  const [paidLines, shippedLines, rfqsInWindow, activeProducts, healthyProducts, currentDocuments] = await Promise.all([
    db.orderItem.count({ where: paidLine }),
    db.orderItem.count({
      where: {
        AND: [
          paidLine,
          { OR: [{ status: { in: SHIPPED_OR_LATER } }, { order: { status: { in: SHIPPED_OR_LATER } } }] },
        ],
      },
    }),
    db.rFQRequest.count({ where: { ...inWindow, status: { notIn: RFQ_NOT_ASKED } } }),
    db.product.count({ where: { sellerId, status: "ACTIVE", deletedAt: null } }),
    db.product.count({ where: { sellerId, status: "ACTIVE", deletedAt: null, issues: { none: { resolvedAt: null } } } }),
    // Newest upload per document type is the seller's current document; the
    // rows it replaced are history, not compliance state.
    db.sellerDocument.findMany({
      where: { sellerId },
      distinct: ["type"],
      orderBy: { uploadedAt: "desc" },
      select: { status: true, expiryDate: true },
    }),
  ]);

  const approvedCurrent = currentDocuments.filter(
    (document) => document.status === "APPROVED" && (document.expiryDate === null || document.expiryDate.getTime() > now.getTime()),
  ).length;

  return {
    orderItemsInWindow: paidLines,
    rfqsInWindow,
    fulfilment: { good: shippedLines, total: paidLines },
    listing: { good: healthyProducts, total: activeProducts },
    compliance: { good: approvedCurrent, total: currentDocuments.length },
  };
}

/** The real seller performance score, or null when there is not enough data to state one. */
export async function computeSellerPerformanceScore(sellerId: string): Promise<SellerPerformanceScore | null> {
  return scoreFromSignals(await loadSellerPerformanceSignals(sellerId));
}
