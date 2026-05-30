import { db, AuditAction, type SellerStatus, type DocumentStatus, type ProductStatus } from "../index";

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
  const [seller] = await db.$transaction([
    db.sellerProfile.update({ where: { id: sellerId }, data: { status: "ACTIVE" } }),
    db.auditLog.create({ data: { actorId, entityType: "SellerProfile", entityId: sellerId, action: AuditAction.APPROVE, after: { status: "ACTIVE" } } }),
  ]);
  return seller;
}

export async function rejectSeller(sellerId: string, actorId: string, reason: string) {
  const [seller] = await db.$transaction([
    db.sellerProfile.update({ where: { id: sellerId }, data: { status: "REJECTED" as SellerStatus } }),
    db.auditLog.create({ data: { actorId, entityType: "SellerProfile", entityId: sellerId, action: AuditAction.REJECT, after: { status: "REJECTED", reason } } }),
  ]);
  return seller;
}

export async function reviewDocument(docId: string, status: DocumentStatus, actorId: string, reason?: string) {
  return db.sellerDocument.update({
    where: { id: docId },
    data: { status, reviewedAt: new Date(), reviewedBy: actorId, rejectionReason: reason },
  });
}

export async function reviewProductCompliance(docId: string, status: DocumentStatus, actorId: string, reason?: string) {
  return db.productComplianceDocument.update({
    where: { id: docId },
    data: { status, reviewedAt: new Date(), rejectionReason: reason },
  });
}

export async function approveProduct(productId: string, actorId: string) {
  const [product] = await db.$transaction([
    db.product.update({ where: { id: productId }, data: { status: "ACTIVE" as ProductStatus, publishedAt: new Date() } }),
    db.auditLog.create({ data: { actorId, entityType: "Product", entityId: productId, action: AuditAction.APPROVE } }),
  ]);
  return product;
}

export async function rejectProduct(productId: string, actorId: string, reason: string) {
  const [product] = await db.$transaction([
    db.product.update({ where: { id: productId }, data: { status: "REJECTED" as ProductStatus } }),
    db.auditLog.create({ data: { actorId, entityType: "Product", entityId: productId, action: AuditAction.REJECT, after: { reason } } }),
    db.productIssue.create({ data: { productId, issueType: "REJECTED_BY_ADMIN", severity: "ERROR", message: reason } }),
  ]);
  return product;
}
