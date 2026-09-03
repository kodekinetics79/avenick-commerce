"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { cookieHeaderFromStore, fetchBackendJsonWithCookies } from "@/lib/backend";
import { z } from "zod";
import { LOCALE_COOKIE, toIdentityLocale } from "../auth/identity-copy";

/**
 * PRESENTATION ONLY — see the identical note in ../support/actions.ts. The
 * schema, the parse, the branches and the returned shape are untouched; only
 * the two sentences a person reads are chosen in their own language.
 *
 * The zod issue message is a machine-shaped English string ("String must contain
 * at least 3 character(s)"). The English build keeps showing it, because that is
 * exactly what the server enforced. The Arabic build cannot show it — an English
 * sentence inside an Arabic form is the tell — so it states the same failure and
 * names the same three fields, without inventing a different rule. The parse and
 * the branch are identical either way.
 */
const MESSAGES = {
  en: {
    // No review-time promise: the platform measures no returns SLA.
    submitted: "Return request submitted. Track its review status below.",
    failed: "Failed to submit return request.",
    invalid: "That request is not complete. Check the order, the items and the reason.",
  },
  ar: {
    submitted: "تم إرسال طلب الإرجاع. تابع حالة مراجعته أدناه.",
    failed: "تعذّر إرسال طلب الإرجاع.",
    invalid: "الطلب غير مكتمل. تحقّق من الطلب والمنتجات والسبب.",
  },
} as const;

export type ReturnActionState = { error?: string; ok?: boolean; message?: string };

const CreateReturnSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().positive() })).min(1),
});

export async function createReturnRequest(
  _prev: ReturnActionState,
  formData: FormData,
): Promise<ReturnActionState> {
  const store = await cookies();
  const locale = toIdentityLocale(store.get(LOCALE_COOKIE)?.value);
  const m = MESSAGES[locale];
  try {
    const cookieHeader = cookieHeaderFromStore(store);

    const selectedIds = formData.getAll("orderItemId").map(String);
    const parsed = CreateReturnSchema.safeParse({
      orderId: formData.get("orderId"),
      reason: formData.get("reason"),
      notes: formData.get("notes") || undefined,
      items: selectedIds.map((orderItemId) => ({
        orderItemId,
        quantity: Number(formData.get(`quantity:${orderItemId}`)),
      })),
    });
    if (!parsed.success) {
      return { error: locale === "ar" ? m.invalid : parsed.error.issues[0]?.message ?? m.invalid };
    }

    const result = await fetchBackendJsonWithCookies<{ message?: string }>(
      "/api/returns",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      },
      cookieHeader,
    );

    revalidatePath("/returns");
    return { ok: true, message: result.message ?? m.submitted };
  } catch (error) {
    return { error: error instanceof Error ? error.message : m.failed };
  }
}
