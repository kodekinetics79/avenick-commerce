"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { db, AuditAction, requireCurrentAdminActor } from "@avenick/database";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export async function setTicketStatus(id: string, status: (typeof STATUSES)[number]) {
  const { userId } = await requireAdminSession();
  if (!STATUSES.includes(status)) return;

  await db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, userId);
    const target = await tx.supportTicket.findUnique({ where: { id }, select: { status: true } });
    if (!target || target.status === status) return;
    await tx.supportTicket.update({ where: { id }, data: { status } });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        entityType: "SupportTicket",
        entityId: id,
        action: AuditAction.STATUS_CHANGE,
        before: { status: target.status },
        after: { status },
      },
    });
  });
  revalidatePath("/support");
  revalidatePath(`/support/${id}`);
}
