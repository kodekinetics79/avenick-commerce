"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  createSellerAccount,
  hashSellerPassword,
  isSellerRegistrationConflictError,
} from "@avenick/database";
import { CreateSellerByAdminSchema } from "@avenick/types";
import { log } from "@avenick/observability";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { headers } from "next/headers";
import { requireAdminSession } from "@/lib/auth";

/**
 * Opening a seller account from the platform side.
 *
 * The service does the authority work — it re-resolves and locks the admin
 * inside the transaction, and refuses an ACTIVE opening for anyone below
 * SUPER_ADMIN — so this layer validates the form, throttles it, and turns each
 * refusal into a sentence with the field it belongs to. Thrown server-action
 * errors are masked in production, so refusals travel back as values.
 */
export type CreateSellerState =
  | { ok: true; sellerId: string; status: string; email: string }
  | { ok: false; error: string; field?: string };

export async function createSellerAction(raw: unknown): Promise<CreateSellerState> {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminReview");

  // Each call creates a login and a commercial account, so it is budgeted like
  // the public registration route rather than treated as a free read. Keyed on
  // the acting administrator, not the IP: several admins may share an office
  // egress, and one of them working through a supplier list must not throttle
  // the others.
  const rl = await checkRateLimit(RATE_LIMITS.sellerRegister, `admin:${userId}`);
  if (!rl.ok) return { ok: false, error: t("newSeller.errors.rateLimited") };

  const parsed = CreateSellerByAdminSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      field: issue?.path.map(String).join(".") || undefined,
      error: issue?.message ?? t("newSeller.errors.checkTheForm"),
    };
  }

  const { password, ...application } = parsed.data;
  const passwordHash = await hashSellerPassword(password);

  try {
    const result = await createSellerAccount({ ...application, passwordHash }, userId);
    log.info("admin.sellers: account created", {
      scope: "sellers.actions",
      sellerId: result.sellerId,
      // Not `status`: LogFields reserves that key for the HTTP status of a
      // request-scoped log line, and it is typed as a number.
      sellerStatus: result.status,
      actorId: userId,
      // Deliberately not the address: the audit row carries the owner's user id
      // and this line only has to make the event findable.
      ip: clientIpFrom(headers()),
    });
    revalidatePath("/sellers");
    revalidatePath("/sellers/pending");
    revalidatePath("/approvals");
    return { ok: true, sellerId: result.sellerId, status: result.status, email: application.email };
  } catch (error) {
    if (isSellerRegistrationConflictError(error)) {
      // Unlike the public registration route, a collision is NAMED here. That
      // route must answer neutrally because anyone on the internet can call it,
      // which would make it a membership oracle for any address; this caller is
      // a signed-in administrator entitled to know the account already exists.
      switch (error.field) {
        case "email":
          return { ok: false, field: "email", error: t("newSeller.errors.emailTaken") };
        case "crNumber":
          return { ok: false, field: "crNumber", error: t("newSeller.errors.crTaken") };
        case "phone":
          return { ok: false, field: "phone", error: t("newSeller.errors.phoneTaken") };
      }
    }
    // The service throws this when an ADMIN asks to open an account ACTIVE.
    // It is a permission answer, not a fault, so it is reported and not logged.
    if (error instanceof Error && error.message.startsWith("Current super admin authority")) {
      return { ok: false, field: "status", error: t("newSeller.errors.activeNeedsSuperAdmin") };
    }
    if (error instanceof Error && error.message.startsWith("Current admin authority")) {
      return { ok: false, error: t("newSeller.errors.authorityWithdrawn") };
    }
    if (error instanceof Error && error.message.startsWith("Commission rate must be")) {
      return { ok: false, field: "commissionRate", error: error.message };
    }
    log.error("admin.sellers: account creation failed", error, { scope: "sellers.actions", actorId: userId });
    return { ok: false, error: t("newSeller.errors.notCreated") };
  }
}
