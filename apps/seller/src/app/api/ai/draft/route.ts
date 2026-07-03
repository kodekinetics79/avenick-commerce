import { auth } from "@/lib/auth-instance";
import { guarded, jsonOk, jsonErr, SELLER_ROLES, checkRateLimit, RATE_LIMITS } from "@avenick/auth";
import { generateDraft } from "@/lib/ai";
import { z } from "zod";

const DraftSchema = z.object({
  kind: z.enum(["rfq", "listing"]),
  context: z.string().max(4000).default(""),
});

export const POST = guarded({ auth, roles: SELLER_ROLES }, async ({ req, userId, requestId }) => {
  const rl = await checkRateLimit(RATE_LIMITS.aiDraft, userId);
  if (!rl.ok) {
    return jsonErr("Draft limit reached for this hour. Please try again later.", 429, requestId);
  }

  const body = DraftSchema.parse(await req.json().catch(() => ({})));
  const result = await generateDraft(body.kind, body.context);
  return jsonOk(result);
});
