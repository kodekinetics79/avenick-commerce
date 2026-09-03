"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import {
  ADMIN_ADVANCE_TARGETS,
  OrderStatus,
  type AdminAdvanceTarget,
  addOrderInternalNote,
  adminAdvanceOrder,
  adminCancelOrder,
  describeAdminFailure,
} from "@avenick/database";
import { log } from "@avenick/observability";
import { RECORD_ID } from "@avenick/utils";
import type { ActionResult } from "@/app/approvals/actions";

const orderId = z.string().trim().regex(RECORD_ID, "Invalid order reference");
const orderStatus = z.nativeEnum(OrderStatus);
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep the ${label} under ${max} characters`)
    .optional()
    .transform((value) => (value ? value : undefined));

const advanceTarget = z.custom<AdminAdvanceTarget>(
  (value) => typeof value === "string" && (ADMIN_ADVANCE_TARGETS as string[]).includes(value),
  "Unsupported order transition",
);

const advanceInput = z.object({
  orderId,
  to: advanceTarget,
  /** Status the operator saw; the service refuses if the row has moved. */
  expectedFrom: orderStatus,
  message: optionalText(500, "customer message"),
});

const cancelInput = z.object({
  orderId,
  expectedFrom: orderStatus,
  reason: z.string().trim().min(3, "Give the customer a reason").max(500, "Keep the reason under 500 characters"),
});

const noteInput = z.object({
  orderId,
  note: z.string().trim().min(1, "Write the note first").max(2000, "Keep the note under 2000 characters"),
});

function firstIssue(error: z.ZodError): ActionResult {
  const issue = error.issues[0];
  return { ok: false, error: issue?.message ?? "Invalid input", field: issue?.path[0]?.toString() };
}

function revalidateOrderSurfaces(id: string) {
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
}

export async function advanceOrderAction(input: { orderId: string; to: string; expectedFrom: string; message?: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const parsed = advanceInput.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { data } = parsed;
  let status: string;
  try {
    ({ status } = await adminAdvanceOrder({
      orderId: data.orderId,
      to: data.to,
      actorId: userId,
      expectedFrom: data.expectedFrom,
      message: data.message,
    }));
  } catch (error) {
    log.error("admin advance order failed", error, { scope: "orders.advance", orderId: data.orderId, to: data.to });
    return { ok: false, error: describeAdminFailure(error, "Could not update the order; reload and retry") };
  }
  revalidateOrderSurfaces(data.orderId);
  return { ok: true, message: `Order is now ${status.toLowerCase().replace(/_/g, " ")}` };
}

export async function cancelOrderAction(input: { orderId: string; expectedFrom: string; reason: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const parsed = cancelInput.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { data } = parsed;
  let released: number;
  try {
    ({ releasedUnits: released } = await adminCancelOrder({
      orderId: data.orderId,
      actorId: userId,
      reason: data.reason,
      expectedFrom: data.expectedFrom,
    }));
  } catch (error) {
    log.error("admin cancel order failed", error, { scope: "orders.cancel", orderId: data.orderId });
    return { ok: false, error: describeAdminFailure(error, "Could not cancel the order; reload and retry") };
  }
  revalidateOrderSurfaces(data.orderId);
  return { ok: true, message: released > 0 ? `Order cancelled; ${released} reserved unit${released === 1 ? "" : "s"} released` : "Order cancelled" };
}

export async function addOrderNoteAction(input: { orderId: string; note: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const parsed = noteInput.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { data } = parsed;
  try {
    await addOrderInternalNote({ orderId: data.orderId, actorId: userId, note: data.note });
  } catch (error) {
    log.error("admin order note failed", error, { scope: "orders.note", orderId: data.orderId });
    return { ok: false, error: describeAdminFailure(error, "Could not save the note; reload and retry") };
  }
  revalidateOrderSurfaces(data.orderId);
  return { ok: true, message: "Note saved" };
}
