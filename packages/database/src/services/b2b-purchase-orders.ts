import { AuditAction, Prisma, type Currency, type UserRole } from "@prisma/client";
import { db } from "../index";
import { secureCreateOrder } from "./secure-checkout";
import { finalizeInternalOrderPayment } from "./payments";
import {
  approvalSnapshotsMatch,
  buildApprovalDecisionSnapshot,
  canonicalOrderRequest,
  commercialSnapshotFingerprint,
} from "./commerce-governance";
import { assertMinimumOrderQuantity, assertRequiredVariantSelection, lockUserCommerceRows } from "./checkout-invariants";

export interface PurchaseOrderLineInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

const money = (value: number) => Number(value.toFixed(2));

function selectPrice(
  prices: { id: string; type: string; currency: string; minQty: number; maxQty: number | null; price: Prisma.Decimal; vatRate: Prisma.Decimal; isActive: boolean }[],
  currency: Currency,
  quantity: number,
) {
  return prices
    .filter((price) =>
      price.isActive &&
      price.type === "B2B" &&
      price.currency === currency &&
      price.minQty <= quantity &&
      (price.maxQty == null || quantity <= price.maxQty),
    )
    .sort((a, b) => b.minQty - a.minQty)[0] ?? null;
}

async function pricePOLines(
  currency: Currency,
  requested: PurchaseOrderLineInput[],
  client: Pick<Prisma.TransactionClient, "product"> = db,
) {
  if (requested.length === 0) throw new Error("Purchase order must contain at least one product line");

  const normalized = new Map<string, PurchaseOrderLineInput>();
  for (const input of requested) {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 100000) {
      throw new Error("Purchase-order quantity must be a positive whole number within the checkout limit");
    }
    const key = `${input.productId}::${input.variantId ?? ""}`;
    const current = normalized.get(key);
    const quantity = (current?.quantity ?? 0) + input.quantity;
    if (quantity > 100000) throw new Error("Combined purchase-order quantity exceeds the checkout limit");
    normalized.set(key, { productId: input.productId, variantId: input.variantId, quantity });
  }

  const inputs = [...normalized.values()];
  const products = await client.product.findMany({
    where: { id: { in: [...new Set(inputs.map((item) => item.productId))] }, deletedAt: null },
    include: {
      prices: true,
      seller: { select: { id: true, status: true, deletedAt: true } },
      variants: {
        select: {
          id: true, isActive: true, sku: true, nameEn: true,
          prices: true,
        },
      },
    },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  let net = 0;
  let vat = 0;
  const lines = inputs.map((input) => {
    const product = productMap.get(input.productId);
    if (!product || product.status !== "ACTIVE" || !product.isB2BEnabled) {
      throw new Error(`Product ${input.productId} is not available for B2B purchasing`);
    }
    assertMinimumOrderQuantity(product.nameEn, input.quantity, product.moq);
    if (product.seller.status !== "ACTIVE" || product.seller.deletedAt) {
      throw new Error(`Seller for "${product.nameEn}" is unavailable`);
    }
    assertRequiredVariantSelection(product.nameEn, product.variants, input.variantId);
    const variant = input.variantId
      ? product.variants.find((row) => row.id === input.variantId)
      : undefined;
    if (input.variantId) {
      if (!variant?.isActive) throw new Error(`Selected variant is unavailable for "${product.nameEn}"`);
    }

    // A selected variant's commercial truth overrides the base SKU. Base prices
    // remain a deliberate fallback for variants without their own price tier.
    const variantPrice = variant ? selectPrice(variant.prices, currency, input.quantity) : null;
    const price = variantPrice ?? selectPrice(product.prices, currency, input.quantity);
    if (!price) throw new Error(`No active B2B ${currency} price for "${product.nameEn}"`);
    const unitPrice = Number(price.price);
    const lineSubtotal = money(unitPrice * input.quantity);
    const vatRate = Number(price.vatRate);
    const lineVat = money(lineSubtotal * vatRate / 100);
    net += lineSubtotal;
    vat += lineVat;

    return {
      productId: product.id,
      variantId: input.variantId,
      sellerId: product.sellerId,
      sku: variant?.sku ?? product.sku,
      nameEn: variant?.nameEn ?? product.nameEn,
      quantity: input.quantity,
      unitPrice,
      vatRate,
      lineSubtotal,
      priceSourceId: price.id,
      priceExplanation: {
        source: "LOCAL_CATALOG",
        channel: "B2B",
        currency,
        priceId: price.id,
        scope: variantPrice ? "VARIANT" : "PRODUCT",
        variantId: input.variantId ?? null,
        minQty: price.minQty,
        maxQty: price.maxQty,
      },
    };
  });

  return { lines, net: money(net), vat: money(vat), gross: money(net + vat) };
}

type PolicyClient = Pick<Prisma.TransactionClient, "approvalPolicy">;

async function governingPolicy(client: PolicyClient, companyId: string, currency: Currency, total: number) {
  return client.approvalPolicy.findFirst({
    where: { companyId, isActive: true, currency, thresholdAmount: { lte: total } },
    orderBy: { thresholdAmount: "desc" },
  });
}

function approvalEvidence(
  currency: Currency,
  total: number,
  lines: Array<{ productId: string; variantId?: string | null; quantity: number; unitPrice: Prisma.Decimal | number; vatRate: Prisma.Decimal | number; priceSourceId?: string | null }>,
  policy: Awaited<ReturnType<typeof governingPolicy>>,
  requesterSpendLimit?: number | null,
) {
  const commercialFingerprint = commercialSnapshotFingerprint(currency, total, lines.map((line) => ({
    ...line,
    unitPrice: Number(line.unitPrice),
    vatRate: Number(line.vatRate),
  })));
  const snapshot = buildApprovalDecisionSnapshot({
    commercialFingerprint,
    requesterSpendLimit,
    policy: policy ? {
      ...policy,
      thresholdAmount: Number(policy.thresholdAmount),
    } : null,
  });
  return { commercialFingerprint, snapshot };
}

async function invalidateApprovedPOs(
  tx: Prisma.TransactionClient,
  input: { companyId: string; currency: Currency; actorId: string; reason: string },
) {
  const approved = await tx.purchaseOrder.findMany({
    where: { companyId: input.companyId, currency: input.currency, status: "APPROVED" },
    select: { id: true, approvalVersion: true },
  });
  if (!approved.length) return;
  await tx.purchaseOrder.updateMany({
    where: { id: { in: approved.map((po) => po.id) }, status: "APPROVED" },
    data: {
      status: "PENDING_APPROVAL",
      approverId: null,
      approvedAt: null,
      approvalSnapshot: Prisma.DbNull,
      approvedCommercialFingerprint: null,
      rejectionReason: input.reason,
      approvalVersion: { increment: 1 },
    },
  });
  await tx.auditLog.createMany({
    data: approved.map((po) => ({
      actorId: input.actorId,
      entityType: "PurchaseOrder",
      entityId: po.id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: "APPROVED", approvalVersion: po.approvalVersion },
      after: { status: "PENDING_APPROVAL", reason: "POLICY_CHANGED", detail: input.reason },
    })),
  });
}

/**
 * Updates approval-relevant company membership facts under the same company
 * fence as PO approval and placement. A placement that already claimed
 * PLACING is the earlier operation; only still-APPROVED work is invalidated.
 */
export async function updateGovernedCompanyMember(input: {
  memberId: string;
  companyId: string;
  actorId: string;
  role: Extract<UserRole, "COMPANY_ADMIN" | "COMPANY_BUYER" | "COMPANY_APPROVER">;
  spendLimit: number | null;
  isActive?: boolean;
  /** Deterministic seam for PostgreSQL concurrency regressions. */
  afterGovernanceLock?: () => Promise<void>;
}) {
  if (input.spendLimit != null && (!Number.isFinite(input.spendLimit) || input.spendLimit < 0)) {
    throw new Error("Spend limit must be a non-negative number");
  }
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`company-approval:${input.companyId}`}))`);
    await input.afterGovernanceLock?.();
    const current = await tx.companyMember.findFirst({
      where: { id: input.memberId, companyId: input.companyId },
    });
    if (!current) throw new Error("Company member not found");
    await lockUserCommerceRows(tx, [current.userId]);

    const roleChanged = current.role !== input.role;
    const spendChanged = current.spendLimit == null
      ? input.spendLimit != null
      : input.spendLimit == null || Number(current.spendLimit) !== input.spendLimit;
    const activeChanged = input.isActive != null && current.isActive !== input.isActive;
    const governanceChanged = roleChanged || spendChanged || activeChanged;
    const affected = governanceChanged
      ? await tx.purchaseOrder.findMany({
          where: {
            companyId: input.companyId,
            status: "APPROVED",
            OR: [
              { requesterId: current.userId },
              ...(roleChanged || activeChanged ? [{ approverId: current.userId }] : []),
            ],
          },
          select: { id: true, approvalVersion: true },
        })
      : [];
    const inFlight = governanceChanged
      ? await tx.purchaseOrder.findMany({
          where: {
            companyId: input.companyId,
            status: { in: ["PLACING", "ORDERED"] },
            OR: [
              { requesterId: current.userId },
              ...(roleChanged || activeChanged ? [{ approverId: current.userId }] : []),
            ],
          },
          select: { id: true, status: true },
        })
      : [];

    const member = await tx.companyMember.update({
      where: { id: current.id }, data: {
        role: input.role, spendLimit: input.spendLimit,
        ...(input.isActive == null ? {} : { isActive: input.isActive }),
      },
    });
    await tx.user.update({ where: { id: current.userId }, data: { role: input.role } });
    const reason = "Company member approval authority or spend limit changed; reapproval required";
    if (affected.length) {
      await tx.purchaseOrder.updateMany({
        where: { id: { in: affected.map((po) => po.id) }, status: "APPROVED" },
        data: {
          status: "PENDING_APPROVAL", approverId: null, approvedAt: null,
          approvalSnapshot: Prisma.DbNull, approvedCommercialFingerprint: null,
          rejectionReason: reason, approvalVersion: { increment: 1 },
        },
      });
      await tx.auditLog.createMany({ data: affected.map((po) => ({
        actorId: input.actorId, entityType: "PurchaseOrder", entityId: po.id,
        action: AuditAction.STATUS_CHANGE,
        before: { status: "APPROVED", approvalVersion: po.approvalVersion },
        after: { status: "PENDING_APPROVAL", reason: "MEMBER_GOVERNANCE_CHANGED", detail: reason },
      })) });
    }
    await tx.auditLog.create({ data: {
      actorId: input.actorId, entityType: "CompanyMember", entityId: current.id, action: AuditAction.UPDATE,
      before: { companyId: input.companyId, role: current.role, spendLimit: current.spendLimit, isActive: current.isActive },
      after: {
        companyId: input.companyId, role: input.role, spendLimit: input.spendLimit, isActive: member.isActive,
        invalidatedPurchaseOrderIds: affected.map((po) => po.id),
        preservedPlacementClaims: inFlight,
      },
    } });
    return { member, invalidatedPurchaseOrderIds: affected.map((po) => po.id), preservedPlacementClaims: inFlight };
  });
}

export async function createGovernedApprovalPolicy(input: {
  companyId: string;
  actorId: string;
  name: string;
  thresholdAmount: number;
  currency: Currency;
  approverRole: UserRole;
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`company-approval:${input.companyId}`}))`);
    const policy = await tx.approvalPolicy.create({ data: {
      companyId: input.companyId,
      name: input.name,
      thresholdAmount: input.thresholdAmount,
      currency: input.currency,
      approverRole: input.approverRole,
    } });
    await invalidateApprovedPOs(tx, {
      companyId: input.companyId,
      currency: input.currency,
      actorId: input.actorId,
      reason: `Approval policy ${policy.name} was created; reapproval required`,
    });
    return policy;
  });
}

export async function setGovernedApprovalPolicyActive(input: {
  policyId: string;
  companyId: string;
  actorId: string;
  isActive: boolean;
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`company-approval:${input.companyId}`}))`);
    const policy = await tx.approvalPolicy.findFirst({ where: { id: input.policyId, companyId: input.companyId } });
    if (!policy) throw new Error("Approval policy not found");
    const updated = await tx.approvalPolicy.update({ where: { id: policy.id }, data: { isActive: input.isActive } });
    await invalidateApprovedPOs(tx, {
      companyId: input.companyId,
      currency: policy.currency,
      actorId: input.actorId,
      reason: `Approval policy ${policy.name} changed; reapproval required`,
    });
    return updated;
  });
}

export async function createGovernedPurchaseOrder(input: {
  companyId: string;
  requesterId: string;
  requesterSpendLimit?: number | null;
  currency: Currency;
  items: PurchaseOrderLineInput[];
  notes?: string;
  requiredDate?: Date;
}) {
  const company = await db.company.findUnique({ where: { id: input.companyId } });
  if (!company || company.deletedAt || company.status !== "ACTIVE") {
    throw new Error("An active company account is required to create a purchase order");
  }

  const priced = await pricePOLines(input.currency, input.items);
  const overRequesterLimit = input.requesterSpendLimit != null && priced.gross > input.requesterSpendLimit;

  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  const poNumber = `PO-${new Date().getFullYear()}-${stamp}${random}`;

  return db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`company-approval:${input.companyId}`}))`);
    // Resolve again under the company policy lock so creation cannot race a
    // policy mutation and accidentally auto-approve under stale rules.
    const lockedPolicy = await governingPolicy(tx, input.companyId, input.currency, priced.gross);
    const lockedNeedsApproval = Boolean(lockedPolicy || overRequesterLimit);
    const evidence = approvalEvidence(input.currency, priced.gross, priced.lines, lockedPolicy, input.requesterSpendLimit);
    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        poNumber,
        companyId: input.companyId,
        requesterId: input.requesterId,
        status: lockedNeedsApproval ? "PENDING_APPROVAL" : "APPROVED",
        currency: input.currency,
        total: priced.gross,
        requiredDate: input.requiredDate,
        notes: input.notes,
        ...(!lockedNeedsApproval ? {
          approvalSnapshot: evidence.snapshot,
          approvedCommercialFingerprint: evidence.commercialFingerprint,
          approvalVersion: 1,
          approvedAt: new Date(),
        } : {}),
        items: {
          create: priced.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            sellerId: line.sellerId,
            sku: line.sku,
            nameEn: line.nameEn,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            lineSubtotal: line.lineSubtotal,
            priceSourceId: line.priceSourceId,
            priceExplanation: line.priceExplanation,
          })),
        },
      },
      include: { items: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.requesterId,
        entityType: "PurchaseOrder",
        entityId: purchaseOrder.id,
        action: AuditAction.CREATE,
        after: {
          poNumber: purchaseOrder.poNumber,
          status: purchaseOrder.status,
          currency: purchaseOrder.currency,
          total: Number(purchaseOrder.total),
          lineCount: purchaseOrder.items.length,
          approvalReason: lockedPolicy
            ? `Policy ${lockedPolicy.name} threshold ${lockedPolicy.thresholdAmount} ${lockedPolicy.currency}`
            : overRequesterLimit
              ? `Requester spend limit ${input.requesterSpendLimit}`
              : "AUTO_APPROVED",
        },
      },
    });
    return purchaseOrder;
  });
}

/**
 * Single-winner PO status transition. The advisory lock and conditional update
 * ensure concurrent approve/reject requests cannot both commit evidence.
 */
export async function transitionGovernedPurchaseOrder(input: {
  purchaseOrderId: string;
  companyId: string;
  actorId: string;
  action: "approve" | "reject" | "cancel";
  /** Deterministic seam after approval locks are held. */
  afterApprovalLocks?: () => Promise<void>;
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`company-approval:${input.companyId}`}))`);
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`purchase-order:${input.purchaseOrderId}`}))`);
    await input.afterApprovalLocks?.();
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, companyId: input.companyId },
      include: { items: true },
    });
    if (!po) throw new Error("Purchase order not found");

    const allowed = input.action === "cancel"
      ? ["DRAFT", "PENDING_APPROVAL", "APPROVED"]
      : ["PENDING_APPROVAL"];
    if (!allowed.includes(po.status)) throw new Error("Transition is not allowed");

    const policy = await governingPolicy(tx, po.companyId, po.currency, Number(po.total));
    const requesterMembership = await tx.companyMember.findUnique({
      where: { userId: po.requesterId },
      select: { companyId: true, isActive: true, spendLimit: true },
    });
    const requesterSpendLimit = requesterMembership?.isActive && requesterMembership.companyId === po.companyId
      ? requesterMembership.spendLimit == null ? null : Number(requesterMembership.spendLimit)
      : null;
    if (["approve", "reject"].includes(input.action)) {
      const actorMembership = await tx.companyMember.findFirst({
        where: { userId: input.actorId, companyId: input.companyId },
        include: { user: { select: { role: true, status: true, deletedAt: true } } },
      });
      if (!actorMembership?.isActive || actorMembership.user.status !== "ACTIVE" || actorMembership.user.deletedAt
        || actorMembership.role !== actorMembership.user.role) {
        throw new Error("An active current company approver membership is required");
      }
      const actorRole = actorMembership.role;
      const permitted = actorRole === "COMPANY_ADMIN" || (!policy
        ? actorRole === "COMPANY_APPROVER"
        : actorRole === policy.approverRole);
      if (!permitted) throw new Error(policy ? `Approval requires ${policy.approverRole}` : "Approver role required");
      if (input.action === "approve" && po.requesterId === input.actorId) {
        const alternativeApprovers = await tx.companyMember.count({
          where: {
            companyId: input.companyId, isActive: true, userId: { not: input.actorId },
            user: { status: "ACTIVE", deletedAt: null },
            role: policy
              ? { in: ["COMPANY_ADMIN", policy.approverRole] }
              : { in: ["COMPANY_ADMIN", "COMPANY_APPROVER"] },
          },
        });
        if (alternativeApprovers > 0 || actorRole !== "COMPANY_ADMIN") {
          throw new Error("Maker/checker control: you cannot approve your own purchase order");
        }
      }
    }

    const status = input.action === "approve" ? "APPROVED" : input.action === "reject" ? "REJECTED" : "CANCELLED";
    const evidence = approvalEvidence(po.currency, Number(po.total), po.items, policy, requesterSpendLimit);
    const claimed = await tx.purchaseOrder.updateMany({
      where: { id: po.id, status: po.status },
      data: {
        status,
        ...(input.action === "approve" ? {
          approverId: input.actorId,
          rejectionReason: null,
          approvalSnapshot: evidence.snapshot,
          approvedCommercialFingerprint: evidence.commercialFingerprint,
          approvedAt: new Date(),
          approvalVersion: { increment: 1 },
        } : {
          ...(input.action === "reject" ? { rejectionReason: "Rejected by approver" } : {}),
          approvalSnapshot: Prisma.DbNull,
          approvedCommercialFingerprint: null,
          approvedAt: null,
          approvalVersion: { increment: 1 },
        }),
      },
    });
    if (claimed.count !== 1) throw new Error("Purchase order changed concurrently; reload and retry");

    const updated = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    await tx.auditLog.create({ data: {
      actorId: input.actorId,
      entityType: "PurchaseOrder",
      entityId: po.id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: po.status, approvalVersion: po.approvalVersion },
      after: {
        status,
        approvalVersion: updated.approvalVersion,
        lineCount: po.items.length,
        approverId: input.action === "approve" ? input.actorId : undefined,
        approvalSnapshot: input.action === "approve" ? evidence.snapshot : undefined,
      },
    } });
    return updated;
  });
}

/**
 * Converts an approved line-based PO through the same hardened checkout service
 * used by direct orders. Header-only legacy POs are deliberately refused.
 */
export async function placeGovernedPurchaseOrder(input: {
  purchaseOrderId: string;
  companyId: string;
  actorId: string;
  /** Deterministic post-claim seam used only by PostgreSQL race regressions. */
  afterPlacementClaim?: () => Promise<void>;
  /** Deterministic seam after both approval locks are held. */
  afterPlacementLocks?: () => Promise<void>;
  /** Deterministic transactional fault seam used only by PostgreSQL regression tests. */
  faultAfterOrderedTransition?: () => void;
}) {
  const claim = await db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`company-approval:${input.companyId}`}))`);
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`purchase-order:${input.purchaseOrderId}`}))`);
    await input.afterPlacementLocks?.();
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, companyId: input.companyId },
      include: { items: true, company: true },
    });
    if (!po) throw new Error("Purchase order not found");
    const existing = await tx.order.findFirst({ where: { purchaseOrderId: po.id }, orderBy: { createdAt: "asc" } });
    if (existing) {
      return { kind: "existing" as const, order: existing };
    }
    if (po.status !== "APPROVED" && po.status !== "PLACING" && po.status !== "ORDERED") {
      throw new Error("Only an approved purchase order can be placed");
    }
    if (po.items.length === 0) {
      throw new Error("Legacy header-only purchase orders cannot be placed; recreate the PO with product lines");
    }

    const current = await pricePOLines(
      po.currency,
      po.items.map((line) => ({ productId: line.productId, variantId: line.variantId ?? undefined, quantity: line.quantity })),
      tx,
    );
    const currentByKey = new Map(current.lines.map((line) => [`${line.productId}::${line.variantId ?? ""}`, line]));
    const changed = po.items.find((approved) => {
      const now = currentByKey.get(`${approved.productId}::${approved.variantId ?? ""}`);
      return !now || now.priceSourceId !== approved.priceSourceId ||
        Math.abs(now.unitPrice - Number(approved.unitPrice)) > 0.0001 ||
        Math.abs(now.vatRate - Number(approved.vatRate)) > 0.0001;
    });
    const currentPolicy = await tx.approvalPolicy.findFirst({
      where: { companyId: po.companyId, isActive: true, currency: po.currency, thresholdAmount: { lte: current.gross } },
      orderBy: { thresholdAmount: "desc" },
    });
    const membership = await tx.companyMember.findUnique({
      where: { userId: po.requesterId }, select: { companyId: true, isActive: true, spendLimit: true },
    });
    const spendLimit = membership?.isActive && membership.companyId === po.companyId
      ? membership.spendLimit == null ? null : Number(membership.spendLimit) : null;
    const evidence = approvalEvidence(po.currency, current.gross, current.lines, currentPolicy, spendLimit);
    const evidenceChanged = Boolean(changed) || po.approvedCommercialFingerprint !== evidence.commercialFingerprint ||
      !approvalSnapshotsMatch(po.approvalSnapshot, evidence.snapshot);
    if (evidenceChanged) {
      const detail = changed ? `Commercial terms changed for ${changed.sku}` : "Approval policy or approved total changed";
      await tx.purchaseOrder.update({ where: { id: po.id }, data: {
        status: "PENDING_APPROVAL", approverId: null, approvedAt: null,
        approvalSnapshot: Prisma.DbNull, approvedCommercialFingerprint: null,
        rejectionReason: `${detail}; reapproval required before placement`, approvalVersion: { increment: 1 },
      } });
      await tx.auditLog.create({ data: {
        actorId: input.actorId, entityType: "PurchaseOrder", entityId: po.id, action: AuditAction.STATUS_CHANGE,
        before: { status: po.status, total: Number(po.total), approvalVersion: po.approvalVersion },
        after: { status: "PENDING_APPROVAL", reason: "APPROVAL_EVIDENCE_CHANGED", detail, currentTotal: current.gross },
      } });
      return { kind: "invalidated" as const, detail };
    }
    if (po.status === "APPROVED") {
      // PLACING is a durable, retryable claim. A process death here no longer
      // lies that the PO was ordered; the next request safely resumes through
      // the deterministic po:<id> checkout key.
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "PLACING" } });
    }
    return { kind: "claimed" as const, po, newlyClaimed: po.status === "APPROVED" };
  });

  if (claim.kind === "existing") {
    await finalizeInternalOrderPayment({ orderId: claim.order.id, method: "BANK_TRANSFER", actorId: input.actorId });
    await finalizePlacedPurchaseOrder({ ...input, order: claim.order, recovered: true });
    return claim.order;
  }
  if (claim.kind === "invalidated") {
    throw new Error(`${claim.detail}; the purchase order has been returned for approval`);
  }
  const { po } = claim;
  await input.afterPlacementClaim?.();

  const orderRequest = {
    userId: po.requesterId,
    type: "B2B" as const,
    currency: po.currency,
    items: po.items.map((line) => ({
      productId: line.productId,
      variantId: line.variantId ?? undefined,
      quantity: line.quantity,
    })),
    shippingAddress: {
      label: po.company.nameEn,
      line1: po.company.nameEn,
      city: po.company.city,
      country: po.company.country,
    },
    paymentMethod: "BANK_TRANSFER" as const,
    notes: po.notes ?? undefined,
    purchaseOrderId: po.id,
    idempotencyKey: `po:${po.id}`,
    governedCommercial: {
      total: Number(po.total),
      lines: po.items.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        sellerId: line.sellerId,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice),
        vatRate: Number(line.vatRate),
        sourcePriceId: line.priceSourceId,
        sku: line.sku,
        nameEn: line.nameEn,
      })),
    },
  };
  let order;
  try {
    order = await secureCreateOrder({ ...orderRequest, requestFingerprint: canonicalOrderRequest(orderRequest) });
  } catch (error) {
    if (claim.newlyClaimed) await db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`company-approval:${po.companyId}`}))`);
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`purchase-order:${po.id}`}))`);
      const linked = await tx.order.count({ where: { purchaseOrderId: po.id } });
      if (!linked) {
        let stillApproved = false;
        try {
          const fresh = await pricePOLines(po.currency, po.items.map((line) => ({
            productId: line.productId, variantId: line.variantId ?? undefined, quantity: line.quantity,
          })), tx);
          const policy = await governingPolicy(tx, po.companyId, po.currency, fresh.gross);
          const membership = await tx.companyMember.findUnique({
            where: { userId: po.requesterId }, select: { companyId: true, isActive: true, spendLimit: true },
          });
          const spendLimit = membership?.isActive && membership.companyId === po.companyId
            ? membership.spendLimit == null ? null : Number(membership.spendLimit) : null;
          const evidence = approvalEvidence(po.currency, fresh.gross, fresh.lines, policy, spendLimit);
          stillApproved = po.approvedCommercialFingerprint === evidence.commercialFingerprint &&
            approvalSnapshotsMatch(po.approvalSnapshot, evidence.snapshot);
        } catch {
          // Missing/disabled commercial facts are approval invalidation, not a
          // reason to leave an unrecoverable ORDERED claim behind.
        }
        await tx.purchaseOrder.updateMany({ where: { id: po.id, status: "PLACING" }, data: stillApproved
          ? { status: "APPROVED" }
          : {
              status: "PENDING_APPROVAL", approverId: null, approvedAt: null,
              approvalSnapshot: Prisma.DbNull, approvedCommercialFingerprint: null,
              rejectionReason: "Approval evidence changed during failed placement; reapproval required",
              approvalVersion: { increment: 1 },
            },
        });
      }
    });
    throw error;
  }

  await finalizeInternalOrderPayment({ orderId: order.id, method: "BANK_TRANSFER", actorId: input.actorId });

  await finalizePlacedPurchaseOrder({ ...input, order, recovered: false });

  return order;
}

async function finalizePlacedPurchaseOrder(input: {
  purchaseOrderId: string;
  companyId: string;
  actorId: string;
  order: { id: string; orderNumber: string; total: Prisma.Decimal };
  recovered: boolean;
  faultAfterOrderedTransition?: () => void;
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`company-approval:${input.companyId}`}))`);
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`purchase-order:${input.purchaseOrderId}`}))`);
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, companyId: input.companyId },
      select: { id: true, status: true, total: true },
    });
    if (!po) throw new Error("Purchase order not found while finalizing placement");
    const linked = await tx.order.count({ where: { id: input.order.id, purchaseOrderId: po.id } });
    if (linked !== 1) throw new Error("Placed order is not linked to the governed purchase order");
    if (!["PLACING", "ORDERED"].includes(po.status)) {
      throw new Error(`Cannot finalize placement from ${po.status.toLowerCase()} status`);
    }

    const existingAudit = await tx.auditLog.findFirst({
      where: {
        entityType: "PurchaseOrder",
        entityId: po.id,
        action: AuditAction.STATUS_CHANGE,
        after: { path: ["status"], equals: "ORDERED" },
      },
      select: { id: true },
    });
    if (po.status === "PLACING") {
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "ORDERED" } });
      input.faultAfterOrderedTransition?.();
    }
    if (!existingAudit) {
      await tx.auditLog.create({ data: {
        actorId: input.actorId,
        entityType: "PurchaseOrder",
        entityId: po.id,
        action: AuditAction.STATUS_CHANGE,
        before: { status: po.status },
        after: {
          status: "ORDERED",
          orderId: input.order.id,
          orderNumber: input.order.orderNumber,
          approvedTotal: Number(po.total),
          placedTotal: Number(input.order.total),
          recovered: input.recovered,
        },
      } });
    }
  });
}
