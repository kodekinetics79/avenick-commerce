"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { z } from "zod";

export type ReturnActionState = { error?: string; ok?: boolean; message?: string };

function returnNumber() {
  const y = new Date().getFullYear();
  const t = Date.now().toString(36).slice(-5).toUpperCase();
  return `RET-${y}-${t}`;
}

const CreateReturnSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
  notes: z.string().trim().max(1000).optional(),
});

export async function createReturnRequest(
  _prev: ReturnActionState,
  formData: FormData,
): Promise<ReturnActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Sign in to request a return." };

  const parsed = CreateReturnSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

  // Object-level scope: the order must belong to this user and be delivered.
  const order = await db.order.findFirst({
    where: { id: parsed.data.orderId, userId },
    include: { items: { select: { sellerId: true } }, returnRequests: { select: { id: true, status: true } } },
  });
  if (!order) return { error: "Order not found." };
  if (order.status !== "DELIVERED") return { error: "Only delivered orders can be returned." };
  if (order.returnRequests.some((r) => !["REJECTED"].includes(r.status))) {
    return { error: "A return request is already open for this order." };
  }

  const sellerId = order.items[0]?.sellerId;
  if (!sellerId) return { error: "This order has no returnable items." };

  const reason = parsed.data.notes
    ? `${parsed.data.reason} — ${parsed.data.notes}`
    : parsed.data.reason;

  await db.returnRequest.create({
    data: {
      returnNumber: returnNumber(),
      orderId: order.id,
      sellerId,
      reason,
      status: "REQUESTED",
    },
  });

  revalidatePath("/returns");
  return { ok: true, message: "Return request submitted — our team will review it within 1–2 business days." };
}
