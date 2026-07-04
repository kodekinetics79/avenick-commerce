"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { cookieHeaderFromStore, fetchBackendJsonWithCookies } from "@/lib/backend";

type State = { error?: string; ok?: boolean; message?: string };

export async function createTicket(_prev: State, formData: FormData): Promise<State> {
  try {
    const store = await cookies();
    const cookieHeader = cookieHeaderFromStore(store);

    const payload = {
      subject: String(formData.get("subject") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      category: String(formData.get("category") ?? "OTHER").trim() || "OTHER",
      orderRef: String(formData.get("orderRef") ?? "").trim() || null,
    };

    if (!payload.subject) return { error: "Add a subject." };
    if (!payload.description) return { error: "Describe your issue." };

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
    return { ok: true, message: result.message ?? "Ticket submitted — we'll respond within 24 hours." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to submit ticket." };
  }
}
