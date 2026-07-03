import { db, Prisma, type AuditAction } from "../index";

export interface LogAuditInput {
  actorId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  sellerId?: string;
}

/** Write an audit entry. Use inside transactions via `tx ?? db`. */
export function logAudit(input: LogAuditInput, tx?: Prisma.TransactionClient) {
  const client = tx ?? db;
  return client.auditLog.create({
    data: {
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: input.before,
      after: input.after,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      sellerId: input.sellerId,
    },
  });
}

export interface AuditLogFilters {
  page: number;
  limit: number;
  entityType?: string;
  action?: AuditAction;
  actorId?: string;
  search?: string;
}

export async function getAuditLogs(filters: AuditLogFilters) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.search
      ? {
          OR: [
            { entityId: { contains: filters.search, mode: "insensitive" } },
            { entityType: { contains: filters.search, mode: "insensitive" } },
            { actor: { email: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return { logs, total };
}

/** Distinct entity types present in the log, for filter tabs. */
export async function getAuditEntityTypes() {
  const rows = await db.auditLog.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });
  return rows.map((r) => r.entityType);
}
