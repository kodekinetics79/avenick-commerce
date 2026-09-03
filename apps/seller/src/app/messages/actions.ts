"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { isRecordId } from "@avenick/utils";
import { checkRateLimit, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";
import {
  MESSAGE_BODY_MAX_LENGTH,
  MessagingRefusal,
  SELLER_MESSAGING_PERMISSION,
  replyToThread,
} from "@avenick/database";
import { requireSellerPermission } from "@/lib/auth";

export type ReplyActionState = {
  error?: string;
  ok?: boolean;
  /**
   * False when the reply was stored but the buyer has no page that shows it
   * (thread without an RFQ). The form says so instead of implying delivery.
   */
  buyerVisible?: boolean;
};

/**
 * Built per call rather than at module scope so every refusal it can state is
 * written in the caller's language; the shape and the rules are unchanged.
 */
function replySchema(t: (key: string, values?: Record<string, string | number>) => string) {
  return z.object({
    // The id is interpolated into a revalidation path below; pin the record-id
    // shape rather than trusting a route param that a crafted link can shape.
    threadId: z.string().refine(isRecordId, t("replyErrors.threadNotIdentified")),
    body: z
      .string()
      .trim()
      .min(1, t("reply.writeSomething"))
      // The ceiling is passed as a string so it stays in Western digits inside
      // an Arabic sentence.
      .max(MESSAGE_BODY_MAX_LENGTH, t("replyErrors.tooLong", { max: String(MESSAGE_BODY_MAX_LENGTH) })),
  });
}

/**
 * Post a seller reply on a buyer thread.
 *
 * Authorisation happens twice on purpose: the session check here decides who
 * may call the action at all, and `replyToThread` re-reads the member and the
 * seller inside its transaction so a suspension that lands between the two
 * still wins. The rate limit is keyed on the member, not the seller, so one
 * runaway staff account cannot silence the whole organisation.
 */
export async function replyToThreadAction(input: unknown): Promise<ReplyActionState> {
  const t = await getTranslations("sellerRelations");
  let context: Awaited<ReturnType<typeof requireSellerPermission>>;
  try {
    context = await requireSellerPermission(SELLER_MESSAGING_PERMISSION);
  } catch (error) {
    // A member whose grant was withdrawn since the page rendered gets told
    // so; "retry" would be a lie. Session redirects (NEXT_REDIRECT) are not
    // Errors with this prefix and keep propagating to the client boundary.
    if (error instanceof Error && error.message.startsWith("Seller permission required")) {
      return { error: t("replyErrors.permissionRequired", { permission: SELLER_MESSAGING_PERMISSION }) };
    }
    throw error;
  }
  const { seller, userId } = context;

  const parsed = replySchema(t).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("replyErrors.invalid") };
  const { threadId, body } = parsed.data;

  const rl = await checkRateLimit(RATE_LIMITS.messageReply, userId);
  if (!rl.ok) {
    const minutes = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 60_000));
    return { error: t("replyErrors.rateLimited", { count: minutes, n: String(minutes) }) };
  }

  let result;
  try {
    result = await replyToThread({ threadId, sellerId: seller.id, actorId: userId, body });
  } catch (error) {
    // Only refusals written for the member are shown verbatim: "closed",
    // "not found" and the actor fence each say something different about why
    // the reply did not land. Anything else (a connection error names the
    // database host, a constraint violation names tables) is logged and
    // replaced with a generic line — same discipline as documents/actions.ts.
    if (error instanceof MessagingRefusal || (error instanceof Error && error.message.startsWith("Current seller"))) {
      return { error: error.message };
    }
    log.error("seller thread reply failed", error, { scope: "messages.actions", sellerId: seller.id, threadId });
    return { error: t("replyErrors.notSent") };
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${encodeURIComponent(threadId)}`);
  return { ok: true, buyerVisible: result.buyerVisible };
}
