"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
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

/**
 * The refusal messages below are read by the operator, so they are translated.
 * A zod schema is built where the message is needed rather than at module
 * scope, because a translator only exists inside a request.
 */
type Msg = (key: string, values?: Record<string, string | number>) => string;

const orderId = (t: Msg) => z.string().trim().regex(RECORD_ID, t("invalidOrderRef"));
const orderStatus = z.nativeEnum(OrderStatus);

const advanceTarget = (t: Msg) =>
  z.custom<AdminAdvanceTarget>(
    (value) => typeof value === "string" && (ADMIN_ADVANCE_TARGETS as string[]).includes(value),
    t("unsupportedTransition"),
  );

const advanceInput = (t: Msg) =>
  z.object({
    orderId: orderId(t),
    to: advanceTarget(t),
    /** Status the operator saw; the service refuses if the row has moved. */
    expectedFrom: orderStatus,
    message: z
      .string()
      .trim()
      .max(500, t("customerMessageTooLong", { max: 500 }))
      .optional()
      .transform((value) => (value ? value : undefined)),
  });

const cancelInput = (t: Msg) =>
  z.object({
    orderId: orderId(t),
    expectedFrom: orderStatus,
    reason: z.string().trim().min(3, t("reasonRequired")).max(500, t("reasonTooLong", { max: 500 })),
  });

const noteInput = (t: Msg) =>
  z.object({
    orderId: orderId(t),
    note: z.string().trim().min(1, t("noteRequired")).max(2000, t("noteTooLong", { max: 2000 })),
  });

function firstIssue(error: z.ZodError, t: Msg): ActionResult {
  const issue = error.issues[0];
  return { ok: false, error: issue?.message ?? t("invalidInput"), field: issue?.path[0]?.toString() };
}

function revalidateOrderSurfaces(id: string) {
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
}

export async function advanceOrderAction(input: { orderId: string; to: string; expectedFrom: string; message?: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.orderActions");
  const ts = await getTranslations("adminCommerce.orders.status");
  const parsed = advanceInput(t).safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error, t);
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
    return { ok: false, error: describeAdminFailure(error, t("advanceFailed")) };
  }
  revalidateOrderSurfaces(data.orderId);
  return { ok: true, message: t("advanced", { status: ts(status) }) };
}

export async function cancelOrderAction(input: { orderId: string; expectedFrom: string; reason: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.orderActions");
  const parsed = cancelInput(t).safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error, t);
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
    return { ok: false, error: describeAdminFailure(error, t("cancelFailed")) };
  }
  revalidateOrderSurfaces(data.orderId);
  return {
    ok: true,
    // The released count is passed as a string as well as a number: the number
    // selects the plural form, the string keeps the digits Western in Arabic.
    message:
      released > 0
        ? t("cancelledWithRelease", { count: released, value: String(released) })
        : t("cancelled"),
  };
}

export async function addOrderNoteAction(input: { orderId: string; note: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.orderActions");
  const parsed = noteInput(t).safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error, t);
  const { data } = parsed;
  try {
    await addOrderInternalNote({ orderId: data.orderId, actorId: userId, note: data.note });
  } catch (error) {
    log.error("admin order note failed", error, { scope: "orders.note", orderId: data.orderId });
    return { ok: false, error: describeAdminFailure(error, t("noteFailed")) };
  }
  revalidateOrderSurfaces(data.orderId);
  return { ok: true, message: t("noteSaved") };
}
