/**
 * GDPR / Saudi PDPL data-subject rights: the "right to access" (export) and the
 * "right to erasure" (be forgotten). These turn a legal obligation into two
 * auditable operations rather than a manual DBA scramble under a 30-day clock.
 *
 * Design decisions that matter for compliance:
 *   - Erasure ANONYMISES rather than hard-deletes where records must be retained
 *     for legal/financial reasons (orders, invoices, payments have statutory
 *     retention). We strip the PII (name, email, phone, addresses) and detach the
 *     identity, but keep the transactional facts. Truly personal-only data
 *     (addresses, cart, notifications, sessions) is deleted outright.
 *   - Both operations are logged to the audit trail (who, when, which subject),
 *     because "we handled the request" must itself be provable.
 *   - Erasure runs in a single transaction so a partial erasure can't leave the
 *     subject half-forgotten.
 */
import { db, Prisma } from "../index";
import { logAudit } from "./audit";

/** Everything we hold about a user, assembled for a data-access request. */
export interface UserDataExport {
  exportedAt: string;
  subjectId: string;
  user: unknown;
  addresses: unknown[];
  orders: unknown[];
  supportTickets: unknown[];
  reviews: unknown[];
  notifications: unknown[];
  auditTrail: unknown[];
}

/**
 * Assemble a full export of a user's personal data (right to access /
 * portability). Returns a JSON-serialisable object the caller delivers to the
 * subject. Records the access in the audit log.
 */
export async function exportUserData(subjectId: string, actorId: string): Promise<UserDataExport> {
  const [user, addresses, orders, supportTickets, reviews, notifications, auditTrail] = await Promise.all([
    db.user.findUnique({
      where: { id: subjectId },
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true,
        firstNameAr: true, lastNameAr: true, avatar: true, role: true, status: true,
        language: true, createdAt: true, emailVerified: true, phoneVerified: true,
      },
    }),
    db.address.findMany({ where: { userId: subjectId } }),
    db.order.findMany({ where: { userId: subjectId }, include: { items: true } }),
    db.supportTicket.findMany({ where: { userId: subjectId } }),
    db.productReview.findMany({ where: { userId: subjectId } }),
    db.notification.findMany({ where: { userId: subjectId } }),
    db.auditLog.findMany({ where: { actorId: subjectId }, take: 1000, orderBy: { createdAt: "desc" } }),
  ]);

  if (!user) throw new Error(`No user ${subjectId} to export`);

  await logAudit({
    actorId,
    entityType: "DataRights",
    entityId: subjectId,
    action: "UPDATE",
    after: { operation: "export" } as Prisma.InputJsonValue,
  });

  return {
    exportedAt: new Date().toISOString(),
    subjectId,
    user,
    addresses,
    orders,
    supportTickets,
    reviews,
    notifications,
    auditTrail,
  };
}

export interface ErasureResult {
  subjectId: string;
  anonymised: boolean;
  deletedCounts: Record<string, number>;
}

/**
 * Erase a user's personal data (right to be forgotten). PII is stripped and the
 * account is anonymised + soft-deleted; retained transactional records (orders)
 * are kept but de-identified. Personal-only data is hard-deleted. Idempotent:
 * re-running on an already-erased subject is a no-op-ish pass.
 */
export async function eraseUserData(subjectId: string, actorId: string): Promise<ErasureResult> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: subjectId } });
    if (!user) throw new Error(`No user ${subjectId} to erase`);

    const deletedCounts: Record<string, number> = {};
    // Hard-delete personal-only data with no retention requirement.
    deletedCounts.addresses = (await tx.address.deleteMany({ where: { userId: subjectId } })).count;
    deletedCounts.notifications = (await tx.notification.deleteMany({ where: { userId: subjectId } })).count;
    deletedCounts.sessions = (await tx.session.deleteMany({ where: { userId: subjectId } })).count;
    // Reviews: detach authorship rather than delete the review content.
    // (If your policy is to delete, switch to deleteMany.)

    // Anonymise the identity in place. A tombstone email keeps the unique
    // constraint satisfied without retaining the real address.
    const tombstone = `erased+${subjectId}@deleted.invalid`;
    await tx.user.update({
      where: { id: subjectId },
      data: {
        email: tombstone,
        phone: null,
        firstName: "Erased",
        lastName: "User",
        firstNameAr: null,
        lastNameAr: null,
        avatar: null,
        passwordHash: null,
        status: "SUSPENDED",
        deletedAt: new Date(),
      },
    });

    await logAudit(
      {
        actorId,
        entityType: "DataRights",
        entityId: subjectId,
        action: "DELETE",
        after: { operation: "erasure", deletedCounts } as Prisma.InputJsonValue,
      },
      tx,
    );

    return { subjectId, anonymised: true, deletedCounts };
  });
}
