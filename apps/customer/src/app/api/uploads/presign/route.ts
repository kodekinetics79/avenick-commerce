import { z } from "zod";
import { auth } from "@/lib/auth-instance";
import { BUYER_ROLES, checkRateLimit, guarded, jsonErr, jsonOk } from "@avenick/auth";
import {
  UPLOAD_PRESIGN_RATE_LIMIT,
  browserDirectUploadsEnabled,
  createPresignedUpload,
} from "@avenick/utils/browser-upload-policy";

export const dynamic = "force-dynamic";

/**
 * Buyer-side presigning for direct-to-storage uploads.
 *
 * The fail-closed stub this replaces was right about what had to exist first: a
 * size ceiling, a verified media type, and a role→namespace binding. All three
 * now live in @avenick/utils/browser-upload-policy and are enforced by the
 * signature itself, not by anything the browser is trusted to do.
 *
 * The buyer purposes are the only ones this portal will sign. Sellers upload
 * through the seller portal's own endpoint under its own auth context; a buyer
 * session cannot obtain a key under `…/sellers/…` from here or anywhere else.
 */
const PresignSchema = z.object({
  purpose: z.enum(["message-attachment", "avatar"]),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  /** Exact byte length. It is signed into the URL, so it must be the truth. */
  size: z.number().int().positive(),
});

export const POST = guarded({ auth, roles: BUYER_ROLES }, async ({ req, userId, requestId }) => {
  // Kept from the stub deliberately: an explicit boundary check, so no future
  // edit can issue a URL without first passing the fail-closed gate. An
  // unconfigured environment gets 503 and never a fabricated or unsigned URL.
  if (!browserDirectUploadsEnabled()) {
    return jsonErr(
      "File storage is not configured for this environment, so uploads are unavailable.",
      503,
      requestId,
    );
  }

  // Each grant is a licence to write one object, so throttle before doing work.
  const rl = await checkRateLimit(UPLOAD_PRESIGN_RATE_LIMIT, userId);
  if (!rl.ok) {
    return jsonErr("Too many upload requests. Please try again shortly.", 429, requestId);
  }

  const body = PresignSchema.parse(await req.json().catch(() => ({})));

  const decision = createPresignedUpload({
    // The namespace is derived from the authenticated session id alone. Nothing
    // in the request body reaches the object key.
    principal: { kind: "buyer", userId },
    purpose: body.purpose,
    filename: body.filename,
    contentType: body.contentType,
    size: body.size,
  });
  if (!decision.ok) return jsonErr(decision.error, decision.status, requestId);

  return jsonOk(decision.upload);
});
