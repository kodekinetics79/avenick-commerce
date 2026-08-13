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
import { lockProductCommercialRows, lockSellerCommercialRows } from "./checkout-invariants";

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
}) {
  const target = await db.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, status: true, role: true },
  });
  if (!target) throw new Error("User not found");
  if (target.role === "SUPER_ADMIN" && opts.actorRole !== "SUPER_ADMIN") {
    throw new Error("Only a super admin can modify a super admin account");
  }
  if (opts.userId === opts.actorId) {
    throw new Error("You cannot change the status of your own account");
  }

  const [user] = await db.$transaction([
    db.user.update({ where: { id: opts.userId }, data: { status: opts.status } }),
    db.auditLog.create({
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
        before: { status: target.status },
        after: { status: opts.status, ...(opts.reason ? { reason: opts.reason } : {}) },
      },
    }),
  ]);
  return user;
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
}) {
  const target = await db.company.findUnique({
    where: { id: opts.companyId },
    select: { id: true, status: true },
  });
  if (!target) throw new Error("Company not found");

  const [company] = await db.$transaction([
    db.company.update({ where: { id: opts.companyId }, data: { status: opts.status } }),
    db.auditLog.create({
      data: {
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
        after: { status: opts.status, ...(opts.reason ? { reason: opts.reason } : {}) },
      },
    }),
  ]);
  return company;
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
    await lockSellerCommercialRows(tx, [sellerId]);
    const current = await tx.sellerProfile.findUnique({ where: { id: sellerId }, select: { status: true } });
    if (!current) throw new Error("Seller not found");
    const seller = await tx.sellerProfile.update({ where: { id: sellerId }, data: { status: "ACTIVE" } });
    await tx.auditLog.create({ data: { actorId, sellerId, entityType: "SellerProfile", entityId: sellerId, action: AuditAction.APPROVE, before: { status: current.status }, after: { status: "ACTIVE" } } });
    return seller;
  });
}

export async function rejectSeller(sellerId: string, actorId: string, reason: string) {
  return db.$transaction(async (tx) => {
    await lockSellerCommercialRows(tx, [sellerId]);
    const current = await tx.sellerProfile.findUnique({ where: { id: sellerId }, select: { status: true } });
    if (!current) throw new Error("Seller not found");
    const seller = await tx.sellerProfile.update({ where: { id: sellerId }, data: { status: "REJECTED" as SellerStatus } });
    await tx.auditLog.create({ data: { actorId, sellerId, entityType: "SellerProfile", entityId: sellerId, action: AuditAction.REJECT, before: { status: current.status }, after: { status: "REJECTED", reason } } });
    return seller;
  });
}

export async function reviewDocument(docId: string, status: DocumentStatus, actorId: string, reason?: string) {
  const current = await db.sellerDocument.findUnique({ where: { id: docId } });
  if (!current) throw new Error("Seller document not found");
  const [document] = await db.$transaction([
    db.sellerDocument.update({ where: { id: docId }, data: { status, reviewedAt: new Date(), reviewedBy: actorId, rejectionReason: reason } }),
    db.auditLog.create({ data: { actorId, sellerId: current.sellerId, entityType: "SellerDocument", entityId: docId, action: AuditAction.STATUS_CHANGE, before: { status: current.status }, after: { status, reason } } }),
  ]);
  return document;
}

export async function reviewProductCompliance(docId: string, status: DocumentStatus, actorId: string, reason?: string) {
  const current = await db.productComplianceDocument.findUnique({ where: { id: docId }, include: { product: { select: { sellerId: true } } } });
  if (!current) throw new Error("Product compliance document not found");
  const [document] = await db.$transaction([
    db.productComplianceDocument.update({ where: { id: docId }, data: { status, reviewedAt: new Date(), rejectionReason: reason } }),
    db.auditLog.create({ data: { actorId, sellerId: current.product.sellerId, entityType: "ProductComplianceDocument", entityId: docId, action: AuditAction.STATUS_CHANGE, before: { status: current.status }, after: { status, reason } } }),
  ]);
  return document;
}

export async function approveProduct(productId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    await lockProductCommercialRows(tx, [productId]);
    const current = await tx.product.findUnique({ where: { id: productId }, select: { status: true, sellerId: true } });
    if (!current) throw new Error("Product not found");
    const product = await tx.product.update({ where: { id: productId }, data: { status: "ACTIVE" as ProductStatus, publishedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId, sellerId: current.sellerId, entityType: "Product", entityId: productId, action: AuditAction.APPROVE, before: { status: current.status }, after: { status: "ACTIVE" } } });
    return product;
  });
}

export async function rejectProduct(productId: string, actorId: string, reason: string) {
  return db.$transaction(async (tx) => {
    await lockProductCommercialRows(tx, [productId]);
    const current = await tx.product.findUnique({ where: { id: productId }, select: { status: true, sellerId: true } });
    if (!current) throw new Error("Product not found");
    const product = await tx.product.update({ where: { id: productId }, data: { status: "REJECTED" as ProductStatus } });
    await tx.auditLog.create({ data: { actorId, sellerId: current.sellerId, entityType: "Product", entityId: productId, action: AuditAction.REJECT, before: { status: current.status }, after: { status: "REJECTED", reason } } });
    await tx.productIssue.create({ data: { productId, issueType: "REJECTED_BY_ADMIN", severity: "ERROR", message: reason } });
    return product;
  });
}
