"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";

type State = { error?: string; ok?: boolean; message?: string };

function ticketNumber() {
  const y = new Date().getFullYear();
  const t = Date.now().toString(36).slice(-4).toUpperCase();
  const r = Math.floor(100 + Math.random() * 900);
  return `TKT-${y}-${t}${r}`;
}

export async function createTicket(_prev: State, formData: FormData): Promise<State> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return { error: "Please sign in to open a ticket." };

  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "OTHER").trim() || "OTHER";
  const orderRef = String(formData.get("orderRef") ?? "").trim() || null;

  if (!subject) return { error: "Add a subject." };
  if (!description) return { error: "Describe your issue." };

  await db.supportTicket.create({
    data: { ticketNumber: ticketNumber(), userId, subject, description, category, orderRef },
  });
  revalidatePath("/support");
  return { ok: true, message: "Ticket submitted — we'll respond within 24 hours." };
}
