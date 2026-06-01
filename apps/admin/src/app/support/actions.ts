"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { db } from "@avenick/database";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export async function setTicketStatus(id: string, status: (typeof STATUSES)[number]) {
  await requireAdminSession();
  if (!STATUSES.includes(status)) return;
  await db.supportTicket.update({ where: { id }, data: { status } });
  revalidatePath("/support");
}
