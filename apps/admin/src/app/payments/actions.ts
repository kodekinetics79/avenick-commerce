"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { confirmBankTransferPayment } from "@avenick/database";
import { getTranslations } from "next-intl/server";
import { requireAdminSession } from "@/lib/auth";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/**
 * Only a path back into this console's own payments listing is honoured; the
 * form supplies it so the operator's filters survive the round trip, but it is
 * still request input and must not become an open redirect.
 */
function safeReturnTo(raw: string): string {
  return raw.startsWith("/payments") && !raw.startsWith("//") ? raw : "/payments";
}

function withOutcome(returnTo: string, params: Record<string, string | undefined>): string {
  const [path, query = ""] = returnTo.split("?", 2);
  const qs = new URLSearchParams(query);
  for (const key of ["confirmed", "outcome", "sharedRef", "confirmError", "payment"]) qs.delete(key);
  for (const [key, val] of Object.entries(params)) if (val) qs.set(key, val);
  const encoded = qs.toString();
  return encoded ? `${path}?${encoded}` : path;
}

/**
 * Records a bank credit against one BANK_TRANSFER payment attempt.
 *
 * Two authority checks stand behind this control. `requireAdminSession` gates
 * the request itself, and `requireCurrentAdminActor` runs inside
 * `confirmBankTransferPayment`'s own transaction — under the user-commerce
 * advisory fence, in the same transaction that moves the money — so an admin
 * suspended or deleted between the session read and the write cannot settle a
 * payment. Repeating that check here in a separate, earlier transaction would
 * be strictly weaker, so it is delegated rather than duplicated.
 *
 * Every other rule (order confirmability, currency, reconciliation against the
 * order total, replay safety, evidence, commission accrual) belongs to the
 * service and is deliberately not restated here — a second copy of a money
 * rule is a second thing that can drift.
 *
 * The outcome — including a refusal — is carried back to the listing in the
 * URL. A thrown error would reach the operator as the generic "Something went
 * wrong" boundary (Next.js masks server-action error messages in production),
 * which on a money path is indistinguishable from "already confirmed", from
 * "currency mismatch" and from "over-collection". The reason must be visible.
 */
export async function confirmBankTransfer(paymentId: string, formData: FormData) {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.paymentActions");
  const returnTo = safeReturnTo(value(formData, "returnTo"));
  const refuse: (message: string) => never = (message) =>
    redirect(withOutcome(returnTo, { confirmError: message, payment: paymentId || undefined }));

  if (!paymentId) refuse(t("paymentRequired"));

  const bankReference = value(formData, "bankReference");
  const amount = value(formData, "amount");
  const valueDate = value(formData, "valueDate");
  if (!bankReference) refuse(t("bankReferenceRequired"));
  if (!amount) refuse(t("amountRequired"));
  if (!valueDate) refuse(t("valueDateRequired"));

  let result: Awaited<ReturnType<typeof confirmBankTransferPayment>>;
  try {
    result = await confirmBankTransferPayment({
      paymentId,
      actorId: userId,
      bankReference,
      amount,
      valueDate,
    });
  } catch (error) {
    // Only the service's own refusals (plain Errors with a message written for
    // the operator) are surfaced. Driver and engine failures are subclasses and
    // remain unexpected: they go to the error boundary as before.
    if (error instanceof Error && error.constructor === Error && error.message) refuse(error.message);
    throw error;
  }

  revalidatePath("/payments");
  revalidatePath("/orders");
  revalidatePath(`/orders/${result.orderId}`);
  revalidatePath("/finance");

  redirect(
    withOutcome(returnTo, {
      confirmed: result.orderNumber,
      outcome: result.replay ? "REPLAY" : result.orderPaymentStatus,
      sharedRef:
        result.sharedReferenceOrders.length > 0
          ? result.sharedReferenceOrders.map((row) => row.orderNumber).join(",")
          : undefined,
    }),
  );
}
