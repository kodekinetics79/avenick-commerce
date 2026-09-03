"use server";

import { revalidatePath } from "next/cache";
import { isValidIban, normaliseIban, updateSellerSettings } from "@avenick/database";
import { log } from "@avenick/observability";
import { z } from "zod";
import { requireSellerPermission } from "@/lib/auth";

export type SettingsActionState = {
  ok?: boolean;
  error?: string;
  /** Column names the service actually wrote, so the UI never claims a save that was a no-op. */
  changed?: string[];
};

/** Blank optional text is stored as NULL, not "" — the read side treats "" as absent anyway. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length > 0 ? value : null));

const ProfileSchema = z.object({
  businessNameEn: z.string().trim().min(2, "Business name is required").max(120),
  businessNameAr: optionalText(120),
  description: optionalText(2000),
  descriptionAr: optionalText(2000),
  city: z.string().trim().min(2, "City is required").max(80),
});

/**
 * The IBAN is normalised (spaces stripped, upper-cased) BEFORE the length
 * check: banks print IBANs in groups of four, and a 34-character IBAN with its
 * spaces is 42 characters — it must not be refused as "too long". Bounds are
 * generous on purpose (ISO 13616 allows 15–34); the checksum, not a length
 * table, decides validity. The refine runs the same check as the service so
 * the seller sees the error inline instead of after a failed transaction.
 */
const BankSchema = z.object({
  iban: z
    .string()
    .max(64, "IBAN is too long")
    .transform(normaliseIban)
    .pipe(
      z
        .string()
        .min(15, "IBAN is too short")
        .max(34, "IBAN is too long")
        .refine(isValidIban, "That IBAN did not pass the checksum — re-enter it exactly as printed by your bank."),
    ),
  bankName: z.string().trim().min(2, "Bank name is required").max(120),
  accountName: z.string().trim().min(2, "Account holder name is required").max(120),
});

function firstIssue(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  return fallback;
}

/** Text fields only: a File posted under a text name is treated as blank, not as "[object File]". */
function pick(formData: FormData, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === "string" ? value : "";
  }
  return out;
}

/**
 * requireSellerPermission signals a missing capability by throwing a plain
 * Error ("Seller permission required: …"). That one case is reported inline,
 * because the form must not describe a revoked permission as a network
 * failure. Everything else — redirect()/notFound() (which throw by design so
 * Next can act on them) and genuine failures such as a database error — is
 * rethrown untouched.
 */
async function requireSettingsActor(): Promise<{ sellerId: string; userId: string } | { error: string }> {
  try {
    const { seller, userId } = await requireSellerPermission("settings.manage");
    return { sellerId: seller.id, userId };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Seller permission required")) {
      return { error: "You no longer have permission to manage these settings." };
    }
    throw error;
  }
}

export async function updateSellerProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  // Session + permission are re-checked here, and the service re-resolves the
  // actor inside its transaction — a revoked member cannot ride a stale page.
  const actor = await requireSettingsActor();
  if ("error" in actor) return { error: actor.error };
  const { sellerId, userId } = actor;

  let profile: z.infer<typeof ProfileSchema>;
  try {
    profile = ProfileSchema.parse(pick(formData, ["businessNameEn", "businessNameAr", "description", "descriptionAr", "city"]));
  } catch (error) {
    return { error: firstIssue(error, "Check the business details and try again.") };
  }

  try {
    const { changed } = await updateSellerSettings({ sellerId, actorId: userId, profile });
    revalidatePath("/settings");
    return { ok: true, changed };
  } catch (error) {
    log.error("seller profile settings write failed", error, { scope: "settings.actions", sellerId });
    return { error: error instanceof Error ? error.message : "Couldn't save the business details — please retry." };
  }
}

export async function updateSellerBankAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const actor = await requireSettingsActor();
  if ("error" in actor) return { error: actor.error };
  const { sellerId, userId } = actor;

  let bank: z.infer<typeof BankSchema>;
  try {
    bank = BankSchema.parse(pick(formData, ["iban", "bankName", "accountName"]));
  } catch (error) {
    return { error: firstIssue(error, "Check the payout account details and try again.") };
  }

  try {
    const { changed } = await updateSellerSettings({ sellerId, actorId: userId, bank });
    revalidatePath("/settings");
    return { ok: true, changed };
  } catch (error) {
    // The IBAN must never reach the log store, even on the failure path. A
    // Prisma validation error prints the full `data` argument in its message,
    // so the error object itself is not logged — only its class and code —
    // and only a plain Error (thrown by our own service code, which never
    // echoes input) is shown to the seller verbatim.
    const name = error instanceof Error ? error.name : typeof error;
    const code = (error as { code?: unknown } | null)?.code;
    log.error("seller payout account write failed", {
      scope: "settings.actions",
      sellerId,
      errorName: name,
      ...(typeof code === "string" ? { errorCode: code } : {}),
    });
    const safeMessage = error instanceof Error && error.name === "Error" ? error.message : null;
    return { error: safeMessage ?? "Couldn't save the payout account — please retry." };
  }
}
