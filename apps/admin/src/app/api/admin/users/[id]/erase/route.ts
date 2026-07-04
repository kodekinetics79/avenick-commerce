import { auth } from "@/lib/auth-instance";
import { guarded, jsonOk, ApiError, ADMIN_ROLES } from "@avenick/auth";
import { eraseUserData } from "@avenick/database";
import { z } from "zod";

// Erasure is destructive and irreversible; require an explicit confirmation
// token in the body so it can't be triggered by an accidental request.
const BodySchema = z.object({
  confirm: z.literal("ERASE"),
  reason: z.string().trim().max(500).optional(),
});

/**
 * GDPR/PDPL right-to-erasure (admin-initiated). Anonymises the subject and
 * strips PII while retaining statutorily-required transactional records. The
 * action is written to the audit trail (actor = the admin) by the service.
 */
export const POST = guarded({ auth, roles: ADMIN_ROLES }, async ({ req, params, userId, log }) => {
  const body = BodySchema.parse(await req.json());
  try {
    const result = await eraseUserData(params.id, userId);
    log.warn("data erasure executed", { subjectId: params.id, reason: body.reason });
    return jsonOk(result);
  } catch (e) {
    if (e instanceof Error && /No user/.test(e.message)) {
      throw new ApiError("User not found", 404);
    }
    throw e;
  }
});
