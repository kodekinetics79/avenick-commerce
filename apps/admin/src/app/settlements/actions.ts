"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateSellerPayouts, setPayoutStatus } from "@avenick/database";
import { getTranslations } from "next-intl/server";
import { requireAdminSession } from "@/lib/auth";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Keeps the redirect URL inside what proxies accept when many sellers refuse at once. */
const REFUSAL_TEXT_LIMIT = 1500;

/**
 * `<input type="date">` submits a bare calendar day with no zone. The window is
 * interpreted in UTC so the same run over the same dates selects the same
 * accrual regardless of where the admin is sitting, and the end date is
 * inclusive to its last millisecond.
 */
function parseDay(raw: string, edge: "start" | "end", t: (key: string, values?: Record<string, string>) => string): Date {
  if (!DAY.test(raw)) throw new Error(t("periodRequired"));
  const date = new Date(`${raw}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z`);
  if (Number.isNaN(date.getTime())) throw new Error(t("invalidDate", { value: raw }));
  return date;
}

/**
 * Create the PENDING payouts for a settlement period. The service re-proves
 * admin authority inside every per-seller transaction (requireCurrentAdminActor)
 * and is idempotent, so a resubmitted form cannot pay a seller twice.
 */
export async function generatePayoutsForPeriod(formData: FormData) {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.settlementActions");
  const periodFrom = parseDay(value(formData, "periodFrom"), "start", t);
  const periodTo = parseDay(value(formData, "periodTo"), "end", t);
  const sellerId = value(formData, "sellerId") || undefined;

  const result = await generateSellerPayouts({ periodFrom, periodTo, sellerId, actorId: userId });

  revalidatePath("/settlements");
  // The outcome is carried back in the URL rather than held in memory: the run
  // is the only place these counts exist, and a plain reload must not reprint
  // them as though a second run had happened. Refusals name the seller and the
  // reason — a bare count would send the admin hunting through the ledger.
  const refusals = result.failures.map((f) => `${f.sellerName}: ${f.reason}`).join(" | ");
  redirect(
    `/settlements?${new URLSearchParams({
      ran: "1",
      generated: String(result.payouts.length),
      sellers: String(result.sellersConsidered),
      claimed: String(result.sellersAlreadyClaimed),
      unpayable: String(result.sellersNothingPayable),
      heldSellers: String(result.sellersHeld),
      heldAccruals: String(result.heldAccrualCount),
      failed: String(result.failures.length),
      ...(refusals ? { refusals: refusals.slice(0, REFUSAL_TEXT_LIMIT) } : {}),
    }).toString()}`,
  );
}

/**
 * Both payout transitions delegate to finance.setPayoutStatus, which owns the
 * legal-transition table, the seller/payout advisory fences, the audit entry and
 * the commission settlement that follows a payment. Nothing here reimplements it.
 */
export async function startPayoutProcessing(payoutId: string) {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.settlementActions");
  if (!payoutId) throw new Error(t("payoutRequired"));
  await setPayoutStatus({ payoutId, status: "PROCESSING", actorId: userId });
  revalidatePath("/settlements");
}

export async function markPayoutPaid(payoutId: string, formData: FormData) {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.settlementActions");
  if (!payoutId) throw new Error(t("payoutRequired"));
  const reference = value(formData, "reference");
  // setPayoutStatus rejects a paid payout without a reference; refuse here too
  // so the admin sees why instead of an error page after the round trip.
  if (!reference) throw new Error(t("referenceRequired"));
  await setPayoutStatus({ payoutId, status: "PAID", actorId: userId, reference });
  revalidatePath("/settlements");
}
