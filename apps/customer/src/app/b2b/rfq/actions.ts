"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RECORD_ID } from "@avenick/utils";
import { fetchB2BJson, type B2BActionState } from "@/lib/b2b";
import { actionT } from "@/components/b2b/action-i18n";
import { z } from "zod";

const RFQItemSchema = z.object({
  nameEn: z.string().trim().min(2).max(300),
  quantity: z.number().int().positive().max(1_000_000),
  notes: z.string().trim().max(500).optional(),
  productId: z.string().trim().min(1).max(128).optional(),
});

const CreateRFQSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  requiredBy: z.string().min(1),
  responseDueAt: z.string().min(1),
  awardByAt: z.string().min(1),
  creationKey: z.string().trim().min(1).max(200),
  sellerIds: z.array(z.string().trim().min(1).max(128)).min(1).max(20),
  items: z.array(RFQItemSchema).min(1).max(50),
});

export async function submitRFQ(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  const t = actionT();
  let payload: z.infer<typeof CreateRFQSchema>;
  try {
    payload = CreateRFQSchema.parse(JSON.parse(String(formData.get("payload") ?? "{}")));
  } catch (e) {
    // Zod's own issue message names the offending field and is more actionable
    // than anything written here; the translated line is the fallback for a
    // malformed payload that has no field to name.
    const message = e instanceof z.ZodError ? e.issues[0]?.message : undefined;
    return { error: message ?? t("act.rfq.invalid") };
  }

  const requiredBy = new Date(payload.requiredBy);
  const responseDueAt = new Date(payload.responseDueAt);
  const awardByAt = new Date(payload.awardByAt);
  if ([requiredBy, responseDueAt, awardByAt].some((date) => Number.isNaN(date.getTime()))) {
    return { error: t("act.rfq.dateInvalid") };
  }
  if (responseDueAt >= awardByAt || awardByAt >= requiredBy) {
    return { error: t("newRfq.error.deadlines") };
  }

  let rfq: { id: string };
  try {
    rfq = await fetchB2BJson<{ id: string }>("/api/b2b/rfqs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notes: payload.notes,
        requiredBy: requiredBy.toISOString(),
        responseDueAt: responseDueAt.toISOString(),
        awardByAt: awardByAt.toISOString(),
        creationKey: payload.creationKey,
        sellerIds: payload.sellerIds,
        items: payload.items,
      }),
    });
  } catch (error) {
    return { error: error instanceof Error && error.message ? error.message : t("act.rfq.failed") };
  }

  revalidatePath("/b2b/quotes");
  redirect(`/b2b/rfq/${encodeURIComponent(rfq.id)}`);
}

/**
 * Recording a decision on a supplier quote is a commercial act, so a malformed
 * id must not resolve to "nothing visibly happened".
 *
 * Every caller binds an id the server itself read from the database, so a value
 * that is not a record id means a forged submission — there is no legitimate
 * request to keep available here. Fail loudly into the app error boundary
 * rather than returning quietly, which would be indistinguishable from a
 * recorded decision.
 */
function assertRecordId(id: string) {
  if (!RECORD_ID.test(id)) {
    throw new Error("That RFQ could not be identified. Reopen it from the quotes list and retry.");
  }
}

export async function acceptRFQQuote(id: string, expectedQuoteVersion: number) {
  assertRecordId(id);
  // Encoding is the containment; the shape check above is the guard. Keep
  // both — encodeURIComponent holds even if the id shape is ever widened.
  // Do not swallow a failed commercial decision: the nearest error boundary
  // must tell the buyer that acceptance was not recorded.
  await fetchB2BJson(`/api/b2b/rfqs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "ACCEPTED", expectedQuoteVersion }),
  });
  revalidatePath(`/b2b/rfq/${id}`);
  revalidatePath("/b2b/quotes");
}

export async function rejectRFQQuote(id: string, expectedQuoteVersion: number) {
  assertRecordId(id);
  await fetchB2BJson(`/api/b2b/rfqs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "REJECTED", expectedQuoteVersion }),
  });
  revalidatePath(`/b2b/rfq/${id}`);
  revalidatePath("/b2b/quotes");
}

type AwardResponse = {
  purchaseOrder: { id: string; poNumber: string; status: string };
};

/** Award one immutable supplier quote and return to its Deal Ledger receipt. */
export async function awardSupplierQuote(id: string, quoteId: string, expectedFingerprint: string) {
  assertRecordId(id);
  assertRecordId(quoteId);
  if (!/^[a-f0-9]{64}$/i.test(expectedFingerprint)) {
    redirect(`/b2b/rfq/${encodeURIComponent(id)}?awardError=stale`);
  }

  let errorCode = "";
  try {
    const awarded = await fetchB2BJson<AwardResponse>(`/api/b2b/rfqs/${encodeURIComponent(id)}/award`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quoteId, expectedFingerprint }),
    });
    if (!RECORD_ID.test(awarded.purchaseOrder.id)) throw new Error("Invalid purchase order response");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    errorCode = /expired|deadline/i.test(message)
      ? "expired"
      : /fingerprint|changed|stale|another supplier/i.test(message)
        ? "stale"
        : /only a company admin|authority|required/i.test(message)
          ? "forbidden"
          : "failed";
  }

  revalidatePath(`/b2b/rfq/${id}`);
  revalidatePath("/b2b/quotes");
  revalidatePath("/b2b/purchase-orders");
  redirect(`/b2b/rfq/${encodeURIComponent(id)}?${errorCode ? `awardError=${errorCode}` : "award=done"}`);
}
