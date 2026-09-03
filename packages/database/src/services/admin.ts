import {
  db,
  AuditAction,
  Prisma,
  type SellerStatus,
  type DocumentStatus,
  type ProductStatus,
  type UserRole,
  type UserStatus,
  type CompanyStatus,
} from "../index";
import { lockCompanyApprovalRows, lockProductCommercialRows, lockSellerCommercialRows, requireCurrentAdminActor } from "./checkout-invariants";
import { SUPERSEDED_REJECTION_REASON } from "./seller-documents";

// ─── REVIEW DECISIONS ─────────────────────────────────────────────────────────

/**
 * A review decision reached a row that is no longer awaiting one. The queue
 * the admin clicked from was stale: the seller withdrew the listing, another
 * admin decided first, or the platform suppressed it. The write did not
 * happen; `currentStatus` is what the row actually is, so the caller can say
 * so instead of claiming a decision that was never recorded.
 */
export class ProductNotPendingError extends Error {
  readonly productId: string;
  readonly currentStatus: ProductStatus;
  constructor(productId: string, currentStatus: ProductStatus) {
    super(`This product is ${currentStatus.toLowerCase().replace(/_/g, " ")}, not pending review; reload to see its current state`);
    this.name = "ProductNotPendingError";
    this.productId = productId;
    this.currentStatus = currentStatus;
  }
}

/** Document sibling of ProductNotPendingError: the row was already decided or replaced by a newer upload. */
export class DocumentNotPendingError extends Error {
  readonly documentId: string;
  readonly currentStatus: DocumentStatus;
  constructor(documentId: string, currentStatus: DocumentStatus) {
    super(`This document is ${currentStatus.toLowerCase().replace(/_/g, " ")}, not pending review; reload to see its current state`);
    this.name = "DocumentNotPendingError";
    this.documentId = documentId;
    this.currentStatus = currentStatus;
  }
}

/**
 * Seller sibling of ProductNotPendingError: the decision reached a row it does
 * not apply to. Without it the approve button on a stale queue page silently
 * reversed a recorded rejection, and a second click on reject wrote a second
 * revocation into the audit log.
 *
 * The two decisions do not share a predicate, because they are not symmetric.
 * Approval admits an application, so only a PENDING_REVIEW row can be
 * approved — it must never reinstate a seller the platform rejected or
 * suspended. Rejection is also the platform's revocation lever against a live
 * seller (the fulfilment and quote fences read SellerProfile.status), so it
 * applies from any status except REJECTED, where there is nothing left to do.
 */
export class SellerNotPendingError extends Error {
  readonly sellerId: string;
  readonly currentStatus: SellerStatus;
  constructor(sellerId: string, currentStatus: SellerStatus) {
    super(`This seller is ${currentStatus.toLowerCase().replace(/_/g, " ")}; reload to see its current state`);
    this.name = "SellerNotPendingError";
    this.sellerId = sellerId;
    this.currentStatus = currentStatus;
  }
}

/** The only outcomes a reviewer can record. PENDING_REVIEW and EXPIRED are set by upload and by the clock, never by a click. */
const DOCUMENT_REVIEW_DECISIONS: readonly DocumentStatus[] = ["APPROVED", "REJECTED"];

// ─── PLATFORM USERS ───────────────────────────────────────────────────────────

export interface AdminUserFilters {
  page: number;
  limit: number;
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}

export async function getAdminUsers(filters: AdminUserFilters) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { email: { contains: filters.search, mode: "insensitive" } },
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total, roleCounts] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        sellerProfile: { select: { id: true, businessNameEn: true } },
        companyMember: { select: { company: { select: { id: true, nameEn: true } } } },
      },
    }),
    db.user.count({ where }),
    db.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);

  return { users, total, roleCounts };
}

/**
 * Change a user's status (suspend/activate) with an audit trail.
 * Refuses to modify SUPER_ADMIN accounts unless the actor is a SUPER_ADMIN.
 */
export async function setUserStatus(opts: {
  userId: string;
  status: UserStatus;
  actorId: string;
  actorRole: UserRole;
  reason?: string;
  /** Deterministic seam after company and user commerce locks are held. */
  afterGovernanceLocks?: () => Promise<void>;
}) {
  const target = await db.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, status: true, role: true, companyMember: { select: { companyId: true } } },
  });
  if (!target) throw new Error("User not found");
  return db.$transaction(async (tx) => {
    await lockCompanyApprovalRows(tx, target.companyMember ? [target.companyMember.companyId] : []);
    const actor = await requireCurrentAdminActor(tx, opts.actorId, undefined, [opts.userId]);
    await opts.afterGovernanceLocks?.();
    const current = await tx.user.findUnique({ where: { id: opts.userId }, select: { status: true, role: true } });
    if (!current) throw new Error("User not found");
    if (current.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw new Error("Only a super admin can modify a super admin account");
    if (opts.userId === opts.actorId) throw new Error("You cannot change the status of your own account");
    const affected = target.companyMember && current.status !== opts.status
      ? await tx.purchaseOrder.findMany({
          where: {
            companyId: target.companyMember.companyId,
            status: "APPROVED",
            OR: [{ requesterId: opts.userId }, { approverId: opts.userId }],
          },
          select: { id: true, approvalVersion: true },
        })
      : [];
    const user = await tx.user.update({ where: { id: opts.userId }, data: { status: opts.status } });
    if (affected.length) {
      await tx.purchaseOrder.updateMany({
        where: { id: { in: affected.map(({ id }) => id) }, status: "APPROVED" },
        data: {
          status: "PENDING_APPROVAL", approverId: null, approvedAt: null,
          approvalSnapshot: Prisma.DbNull, approvedCommercialFingerprint: null,
          rejectionReason: "User account status changed; reapproval required", approvalVersion: { increment: 1 },
        },
      });
      await tx.auditLog.createMany({ data: affected.map((po) => ({
        actorId: opts.actorId, entityType: "PurchaseOrder", entityId: po.id,
        action: AuditAction.STATUS_CHANGE,
        before: { status: "APPROVED", approvalVersion: po.approvalVersion },
        after: { status: "PENDING_APPROVAL", reason: "USER_STATUS_CHANGED" },
      })) });
    }
    await tx.auditLog.create({
      data: {
        actorId: opts.actorId,
        entityType: "User",
        entityId: opts.userId,
        action:
          opts.status === "SUSPENDED"
            ? AuditAction.SUSPEND
            : opts.status === "ACTIVE"
              ? AuditAction.ACTIVATE
              : AuditAction.STATUS_CHANGE,
        before: { status: current.status },
        after: { status: opts.status, invalidatedPurchaseOrderIds: affected.map(({ id }) => id), ...(opts.reason ? { reason: opts.reason } : {}) },
      },
    });
    return user;
  });
}

// ─── PLATFORM COMPANIES ───────────────────────────────────────────────────────

export interface AdminCompanyFilters {
  page: number;
  limit: number;
  status?: CompanyStatus;
  search?: string;
}

export async function getAdminCompanies(filters: AdminCompanyFilters) {
  const where: Prisma.CompanyWhereInput = {
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { nameEn: { contains: filters.search, mode: "insensitive" } },
            { nameAr: { contains: filters.search, mode: "insensitive" } },
            { crNumber: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [companies, total, statusCounts] = await Promise.all([
    db.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        _count: { select: { members: true, orders: true, purchaseOrders: true, rfqRequests: true } },
      },
    }),
    db.company.count({ where }),
    db.company.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);

  return { companies, total, statusCounts };
}

/** Change a company's status (activate/suspend/verify) with an audit trail. */
export async function setCompanyStatus(opts: {
  companyId: string;
  status: CompanyStatus;
  actorId: string;
  reason?: string;
  /** Deterministic seam for PostgreSQL concurrency regressions. */
  afterCompanyLock?: () => Promise<void>;
}) {
  return db.$transaction(async (tx) => {
    await lockCompanyApprovalRows(tx, [opts.companyId]);
    await requireCurrentAdminActor(tx, opts.actorId);
    await opts.afterCompanyLock?.();
    const target = await tx.company.findUnique({
      where: { id: opts.companyId }, select: { id: true, status: true },
    });
    if (!target) throw new Error("Company not found");
    const affected = opts.status !== "ACTIVE" && target.status !== opts.status
      ? await tx.purchaseOrder.findMany({
          where: { companyId: opts.companyId, status: "APPROVED" },
          select: { id: true, approvalVersion: true },
        })
      : [];
    const company = await tx.company.update({ where: { id: opts.companyId }, data: { status: opts.status } });
    if (affected.length) {
      await tx.purchaseOrder.updateMany({
        where: { id: { in: affected.map(({ id }) => id) }, status: "APPROVED" },
        data: {
          status: "PENDING_APPROVAL", approverId: null, approvedAt: null,
          approvalSnapshot: Prisma.DbNull, approvedCommercialFingerprint: null,
          rejectionReason: "Company status changed; reapproval required", approvalVersion: { increment: 1 },
        },
      });
      await tx.auditLog.createMany({ data: affected.map((po) => ({
        actorId: opts.actorId, entityType: "PurchaseOrder", entityId: po.id,
        action: AuditAction.STATUS_CHANGE,
        before: { status: "APPROVED", approvalVersion: po.approvalVersion },
        after: { status: "PENDING_APPROVAL", reason: "COMPANY_STATUS_CHANGED" },
      })) });
    }
    await tx.auditLog.create({ data: {
        actorId: opts.actorId,
        entityType: "Company",
        entityId: opts.companyId,
        action:
          opts.status === "SUSPENDED"
            ? AuditAction.SUSPEND
            : opts.status === "ACTIVE"
              ? AuditAction.ACTIVATE
              : AuditAction.STATUS_CHANGE,
        before: { status: target.status },
        after: { status: opts.status, invalidatedPurchaseOrderIds: affected.map(({ id }) => id), ...(opts.reason ? { reason: opts.reason } : {}) },
      },
    });
    return company;
  });
}

export async function getAdminDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const [
    gmvToday,
    gmvMonth,
    gmvYear,
    activeSellers,
    pendingSellerReviews,
    pendingCompliance,
    ordersToday,
    activeCompanies,
    openRFQs,
    recentOrders,
  ] = await Promise.all([
    db.order.aggregate({ where: { paymentStatus: "PAID", createdAt: { gte: today } }, _sum: { total: true } }),
    db.order.aggregate({ where: { paymentStatus: "PAID", createdAt: { gte: monthStart } }, _sum: { total: true } }),
    db.order.aggregate({ where: { paymentStatus: "PAID", createdAt: { gte: yearStart } }, _sum: { total: true } }),
    db.sellerProfile.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } }),
    db.sellerDocument.count({ where: { status: "PENDING_REVIEW" } }),
    db.order.count({ where: { createdAt: { gte: today } } }),
    db.company.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.rFQRequest.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    db.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true, status: true, total: true, currency: true, type: true, createdAt: true },
    }),
  ]);

  const orderStatusCounts = await db.order.groupBy({ by: ["status"], _count: { _all: true } });

  return {
    gmvToday: gmvToday._sum.total ?? 0,
    gmvMonth: gmvMonth._sum.total ?? 0,
    gmvYear: gmvYear._sum.total ?? 0,
    activeSellers,
    pendingSellerReviews,
    pendingCompliance,
    ordersToday,
    activeCompanies,
    openRFQs,
    recentOrders,
    orderStatusCounts,
  };
}

export async function approveSeller(sellerId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, actorId);
    await lockSellerCommercialRows(tx, [sellerId]);
    const current = await tx.sellerProfile.findUnique({ where: { id: sellerId }, select: { status: true } });
    if (!current) throw new Error("Seller not found");
    // Only a pending application can be approved. The predicate is the rule:
    // a seller another admin has since rejected, or who was never in the queue,
    // is left exactly as it is and nothing is audited.
    const decided = await tx.sellerProfile.updateMany({ where: { id: sellerId, status: "PENDING_REVIEW" }, data: { status: "ACTIVE" } });
    if (decided.count !== 1) throw new SellerNotPendingError(sellerId, current.status);
    const seller = await tx.sellerProfile.findUniqueOrThrow({ where: { id: sellerId } });
    await tx.auditLog.create({ data: { actorId, sellerId, entityType: "SellerProfile", entityId: sellerId, action: AuditAction.APPROVE, before: { status: "PENDING_REVIEW" }, after: { status: "ACTIVE" } } });
    return seller;
  });
}

export async function rejectSeller(sellerId: string, actorId: string, reason: string) {
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, actorId);
    await lockSellerCommercialRows(tx, [sellerId]);
    const current = await tx.sellerProfile.findUnique({ where: { id: sellerId }, select: { status: true } });
    if (!current) throw new Error("Seller not found");
    // Not the approval predicate: this is the revocation path too, so it must
    // still reach a seller who is ACTIVE or SUSPENDED. What it refuses is a
    // second rejection of an already-rejected row — a stale queue page clicked
    // twice would otherwise write a second revocation into the audit log as if
    // a reviewer had decided again.
    const decided = await tx.sellerProfile.updateMany({ where: { id: sellerId, status: { not: "REJECTED" } }, data: { status: "REJECTED" as SellerStatus } });
    if (decided.count !== 1) throw new SellerNotPendingError(sellerId, current.status);
    const seller = await tx.sellerProfile.findUniqueOrThrow({ where: { id: sellerId } });
    // `before` is the status the predicate proved was still in play, not the
    // one read before the lock; only the former is what this decision changed.
    await tx.auditLog.create({ data: { actorId, sellerId, entityType: "SellerProfile", entityId: sellerId, action: AuditAction.REJECT, before: { status: current.status }, after: { status: "REJECTED", reason } } });
    return seller;
  });
}

/**
 * Record a reviewer's decision on a seller compliance document.
 *
 * Only a PENDING_REVIEW row can be decided, and the status predicate on the
 * write is what enforces it: a row the seller has since replaced (closed as
 * superseded by recordSellerDocument) or another admin has since decided is
 * left exactly as it is and reported as DocumentNotPendingError. The seller
 * lock is taken so this decision and the seller's own upload path serialize
 * on the same fence instead of interleaving.
 *
 * On APPROVED the older APPROVED rows of the same type are closed in the same
 * transaction as REJECTED with SUPERSEDED_REJECTION_REASON — the seller UI
 * reads that pair as "replaced", not as a refusal — so there is exactly one
 * approved document per type: a renewal that is approved retires the evidence
 * it renews rather than sitting beside it.
 */
export async function reviewDocument(docId: string, status: DocumentStatus, actorId: string, reason?: string) {
  if (!DOCUMENT_REVIEW_DECISIONS.includes(status)) throw new Error("A document review records APPROVED or REJECTED");
  // The seller sees rejectionReason as the thing to fix; a bare REJECTED row
  // would be indistinguishable from a supersession with its reason blanked.
  // The route validates this too, but the write is what must refuse it.
  const rejectionReason = status === "REJECTED" ? (reason?.trim() ?? "") : null;
  if (status === "REJECTED" && !rejectionReason) throw new Error("A rejection needs a reason the seller can act on");
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, actorId);
    const current = await tx.sellerDocument.findUnique({ where: { id: docId } });
    if (!current) throw new Error("Seller document not found");
    await lockSellerCommercialRows(tx, [current.sellerId]);

    const decidedAt = new Date();
    const decided = await tx.sellerDocument.updateMany({
      where: { id: docId, status: "PENDING_REVIEW" },
      data: { status, reviewedAt: decidedAt, reviewedBy: actorId, rejectionReason },
    });
    if (decided.count !== 1) {
      // The row read a moment ago is no longer pending, or (with the seller
      // lock now held) was decided between the read and the write. Either way
      // nothing was written; re-read so the error names the real status.
      const now = await tx.sellerDocument.findUnique({ where: { id: docId }, select: { status: true } });
      throw new DocumentNotPendingError(docId, now?.status ?? current.status);
    }
    // `before` is the status the predicate just proved, not the one read
    // before the seller lock was held; the two can differ and only the
    // former is what this decision actually changed.
    await tx.auditLog.create({ data: { actorId, sellerId: current.sellerId, entityType: "SellerDocument", entityId: docId, action: AuditAction.STATUS_CHANGE, before: { status: "PENDING_REVIEW" }, after: { status, reason: rejectionReason } } });

    if (status === "APPROVED") {
      const previouslyApproved = await tx.sellerDocument.findMany({
        where: { sellerId: current.sellerId, type: current.type, status: "APPROVED", NOT: { id: docId } },
        select: { id: true },
      });
      for (const row of previouslyApproved) {
        // Each retirement carries its own status predicate and only a row that
        // actually changed is audited — the log never claims a supersession
        // that did not happen. reviewedAt/reviewedBy stay as they were: the
        // original approval is still a fact, this row just stopped being current.
        const { count } = await tx.sellerDocument.updateMany({
          where: { id: row.id, status: "APPROVED" },
          data: { status: "REJECTED", rejectionReason: SUPERSEDED_REJECTION_REASON },
        });
        if (count !== 1) continue;
        await tx.auditLog.create({
          data: {
            actorId,
            sellerId: current.sellerId,
            entityType: "SellerDocument",
            entityId: row.id,
            action: AuditAction.STATUS_CHANGE,
            before: { status: "APPROVED" },
            after: { status: "REJECTED", reason: SUPERSEDED_REJECTION_REASON, supersededBy: docId },
          },
        });
      }
    }

    return tx.sellerDocument.findUniqueOrThrow({ where: { id: docId } });
  });
}

/**
 * Record a reviewer's decision on a product compliance document.
 *
 * Same rule as reviewDocument: only a PENDING_REVIEW row can be decided, and
 * the status predicate on the write is what enforces it. A row another admin
 * has since decided is left exactly as it is and reported as
 * DocumentNotPendingError — nothing is written and nothing is audited, so the
 * log never records a decision that did not land. No advisory lock is taken:
 * unlike seller documents there is no seller-side upload path to serialize
 * against, and the predicate alone is what makes the decision atomic.
 */
export async function reviewProductCompliance(docId: string, status: DocumentStatus, actorId: string, reason?: string) {
  if (!DOCUMENT_REVIEW_DECISIONS.includes(status)) throw new Error("A document review records APPROVED or REJECTED");
  // As for seller documents: a REJECTED row with no reason gives the seller
  // nothing to fix, and an APPROVED row must not carry one.
  const rejectionReason = status === "REJECTED" ? (reason?.trim() ?? "") : null;
  if (status === "REJECTED" && !rejectionReason) throw new Error("A rejection needs a reason the seller can act on");
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, actorId);
    const current = await tx.productComplianceDocument.findUnique({ where: { id: docId }, include: { product: { select: { sellerId: true } } } });
    if (!current) throw new Error("Product compliance document not found");

    const decided = await tx.productComplianceDocument.updateMany({
      where: { id: docId, status: "PENDING_REVIEW" },
      data: { status, reviewedAt: new Date(), rejectionReason },
    });
    if (decided.count !== 1) {
      // The row read a moment ago is no longer pending, or was decided
      // between the read and the write. Either way nothing was written;
      // re-read so the error names the real status.
      const now = await tx.productComplianceDocument.findUnique({ where: { id: docId }, select: { status: true } });
      throw new DocumentNotPendingError(docId, now?.status ?? current.status);
    }
    // `before` is the status the predicate just proved, not the one read
    // before the write; only the former is what this decision actually changed.
    await tx.auditLog.create({ data: { actorId, sellerId: current.product.sellerId, entityType: "ProductComplianceDocument", entityId: docId, action: AuditAction.STATUS_CHANGE, before: { status: "PENDING_REVIEW" }, after: { status, reason: rejectionReason } } });
    return tx.productComplianceDocument.findUniqueOrThrow({ where: { id: docId } });
  });
}

/**
 * A review decision applies to a listing that is still in the queue. The
 * status predicate on the write is the rule: a product the seller withdrew
 * to DRAFT, another admin already decided, or the platform suppressed is not
 * flipped by a stale queue page — the write affects no row, nothing is
 * audited, and ProductNotPendingError names the status that was found.
 */
async function decidePendingProduct(
  tx: Prisma.TransactionClient,
  productId: string,
  data: { status: ProductStatus; publishedAt?: Date },
) {
  await lockProductCommercialRows(tx, [productId]);
  const current = await tx.product.findFirst({ where: { id: productId, deletedAt: null }, select: { status: true, sellerId: true } });
  if (!current) throw new Error("Product not found");
  const decided = await tx.product.updateMany({ where: { id: productId, deletedAt: null, status: "PENDING_REVIEW" }, data });
  if (decided.count !== 1) throw new ProductNotPendingError(productId, current.status);
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  return { current, product };
}

export async function approveProduct(productId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, actorId);
    const { current, product } = await decidePendingProduct(tx, productId, { status: "ACTIVE", publishedAt: new Date() });
    await tx.auditLog.create({ data: { actorId, sellerId: current.sellerId, entityType: "Product", entityId: productId, action: AuditAction.APPROVE, before: { status: current.status }, after: { status: "ACTIVE" } } });
    return product;
  });
}

export async function rejectProduct(productId: string, actorId: string, reason: string) {
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, actorId);
    const { current, product } = await decidePendingProduct(tx, productId, { status: "REJECTED" });
    await tx.auditLog.create({ data: { actorId, sellerId: current.sellerId, entityType: "Product", entityId: productId, action: AuditAction.REJECT, before: { status: current.status }, after: { status: "REJECTED", reason } } });
    await tx.productIssue.create({ data: { productId, issueType: "REJECTED_BY_ADMIN", severity: "ERROR", message: reason } });
    return product;
  });
}
