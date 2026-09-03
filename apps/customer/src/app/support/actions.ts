"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { cookieHeaderFromStore, fetchBackendJsonWithCookies } from "@/lib/backend";
import { LOCALE_COOKIE, toIdentityLocale } from "../auth/identity-copy";

/**
 * PRESENTATION ONLY. Every branch, every guard, every request and every returned
 * SHAPE below is exactly what it was; the only change is that the four strings a
 * person reads are chosen in the language they are reading in. The store is
 * already being opened for the cookie header, so this costs no extra work.
 *
 * An English sentence appearing inside an Arabic form is the half-translated
 * tell this round exists to remove, and a server action is where it survives
 * longest because nobody re-reads it.
 */
const MESSAGES = {
  en: {
    needSubject: "Add a subject.",
    needDescription: "Describe your issue.",
    // No response-time promise: the platform measures no support SLA.
    submitted: "Ticket submitted. Track its status below.",
    failed: "Failed to submit ticket.",
  },
  ar: {
    needSubject: "أضف موضوعاً.",
    needDescription: "اشرح المشكلة.",
    submitted: "تم إرسال التذكرة. تابع حالتها أدناه.",
    failed: "تعذّر إرسال التذكرة.",
  },
} as const;

type State = { error?: string; ok?: boolean; message?: string };

export async function createTicket(_prev: State, formData: FormData): Promise<State> {
  const store = await cookies();
  const m = MESSAGES[toIdentityLocale(store.get(LOCALE_COOKIE)?.value)];
  try {
    const cookieHeader = cookieHeaderFromStore(store);

    const payload = {
      subject: String(formData.get("subject") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      category: String(formData.get("category") ?? "OTHER").trim() || "OTHER",
      orderRef: String(formData.get("orderRef") ?? "").trim() || null,
    };

    if (!payload.subject) return { error: m.needSubject };
    if (!payload.description) return { error: m.needDescription };

    const result = await fetchBackendJsonWithCookies<{ message?: string }>(
      "/api/support",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
      cookieHeader,
    );

    revalidatePath("/support");
    return { ok: true, message: result.message ?? m.submitted };
  } catch (error) {
    return { error: error instanceof Error ? error.message : m.failed };
  }
}
