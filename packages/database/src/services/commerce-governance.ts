import type { Currency, UserRole } from "@prisma/client";

type CanonicalOrderInput = {
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  shippingAddress: Record<string, string>;
  paymentMethod: string;
  currency: string;
  type: string;
  couponCode?: string;
  notes?: string;
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

export function canonicalOrderRequest(input: CanonicalOrderInput): string {
  const lines = new Map<string, { productId: string; variantId: string | null; quantity: number }>();
  for (const item of input.items) {
    const key = `${item.productId}::${item.variantId ?? ""}`;
    const current = lines.get(key);
    lines.set(key, {
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: (current?.quantity ?? 0) + item.quantity,
    });
  }
  return JSON.stringify(stable({
    type: input.type,
    currency: input.currency,
    paymentMethod: input.paymentMethod,
    items: [...lines.values()].sort((a, b) => `${a.productId}::${a.variantId ?? ""}`.localeCompare(`${b.productId}::${b.variantId ?? ""}`)),
    shippingAddress: input.shippingAddress,
    couponCode: input.couponCode?.trim().toUpperCase() || null,
    notes: input.notes?.trim() || null,
  }));
}

export function assertMatchingIdempotencyFingerprint(stored: string | null | undefined, requested: string): void {
  if (!stored || stored !== requested) {
    throw new Error("Idempotency-Key was already used for a different request");
  }
}

export type CommercialSnapshotLine = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  priceSourceId?: string | null;
};

export function commercialSnapshotFingerprint(currency: Currency | string, total: number, lines: CommercialSnapshotLine[]): string {
  return JSON.stringify(stable({
    currency,
    total: Number(total.toFixed(2)),
    lines: lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId ?? null,
      quantity: line.quantity,
      unitPrice: Number(line.unitPrice.toFixed(4)),
      vatRate: Number(line.vatRate.toFixed(2)),
      priceSourceId: line.priceSourceId ?? null,
    })).sort((a, b) => `${a.productId}::${a.variantId ?? ""}`.localeCompare(`${b.productId}::${b.variantId ?? ""}`)),
  }));
}

type PolicySnapshotInput = {
  id: string;
  name: string;
  thresholdAmount: number;
  currency: Currency | string;
  approverRole: UserRole | string;
  updatedAt: Date;
};

export function buildApprovalDecisionSnapshot(input: {
  commercialFingerprint: string;
  policy: PolicySnapshotInput | null;
  requesterSpendLimit?: number | null;
}) {
  return Object.freeze({
    commercialFingerprint: input.commercialFingerprint,
    requesterSpendLimit: input.requesterSpendLimit ?? null,
    policy: input.policy ? {
      id: input.policy.id,
      name: input.policy.name,
      thresholdAmount: Number(input.policy.thresholdAmount),
      currency: input.policy.currency,
      approverRole: input.policy.approverRole,
      version: input.policy.updatedAt.toISOString(),
    } : null,
  });
}

export function approvalSnapshotsMatch(left: unknown, right: unknown): boolean {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}
