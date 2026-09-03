import { z } from "zod";
import { auth } from "@/lib/auth-instance";
import { ONBOARDING_SELLER_STATUSES, requireSellerPermission, type SellerSessionOptions } from "@/lib/auth";
import { SELLER_ROLES, checkRateLimit, guarded, jsonErr, jsonOk } from "@avenick/auth";
import {
  UPLOAD_PRESIGN_RATE_LIMIT,
  browserDirectUploadsEnabled,
  createPresignedUpload,
  type UploadPurpose,
} from "@avenick/utils/browser-upload-policy";

export const dynamic = "force-dynamic";

/**
 * Seller-side presigning for direct-to-storage uploads.
 *
 * The seller portal needs its own endpoint rather than calling the customer
 * one: the namespace must be the seller organization, not the signed-in user,
 * and that mapping only exists in this app's auth context (a SELLER_STAFF user
 * uploads into their employer's prefix, not their own).
 *
 * Two purposes, both blocked before this existed:
 *   product-image   → public/sellers/<sellerId>/products/…   (public read)
 *   seller-document → private/sellers/<sellerId>/documents/…  (private; trade licence,
 *                     CR, VAT — the evidence the seller approval gate needs)
 */
type SellerUploadPurpose = "product-image" | "seller-document";

interface SellerUploadRule {
  permission: string;
  /** Seller statuses admitted for this purpose; ACTIVE only when omitted. */
  session: SellerSessionOptions;
  /** What to tell a seller whose profile status is not admitted. */
  statusRefusal: string;
}

const SELLER_UPLOAD_RULES: Readonly<Record<SellerUploadPurpose, SellerUploadRule>> = {
  // Product imagery is catalog work; KYC evidence is compliance work. Matching
  // the capabilities the corresponding pages already require.
  //
  // Only seller-document admits a PENDING_REVIEW seller: the review needs the
  // documents, so the documents must be uploadable during the review. Catalog
  // media stays ACTIVE-only — a seller who has not been approved must not be
  // able to publish anything into the public bucket.
  "product-image": {
    permission: "catalog.manage",
    session: {},
    statusRefusal: "This seller account is not active yet, so it cannot upload catalog media",
  },
  "seller-document": {
    permission: "documents.manage",
    session: { allowedSellerStatuses: ONBOARDING_SELLER_STATUSES },
    statusRefusal: "This seller account cannot upload documents in its current status",
  },
};

const PresignSchema = z.object({
  purpose: z.enum(["product-image", "seller-document"]),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  /** Exact byte length. It is signed into the URL, so it must be the truth. */
  size: z.number().int().positive(),
});

/**
 * requireSellerPermission() is written for pages: it throws for a missing
 * capability and redirect()s — a NEXT_REDIRECT throw — for a seller whose
 * status the purpose does not admit (SUSPENDED, REJECTED, deleted; also
 * PENDING_REVIEW for catalog media) or a staff member without a live
 * membership. Both are 403 to the caller, but they are not the
 * same fact, so each keeps its own message: telling a pending seller their
 * permissions are wrong would send them looking in the wrong place. Everything
 * else is rethrown — a database outage must surface as a 500 through
 * guarded(), never as a quiet "you lack permission".
 */
type SellerContextResolution =
  | { ok: true; context: Awaited<ReturnType<typeof requireSellerPermission>> }
  | { ok: false; error: string };

async function resolveSellerContext(rule: SellerUploadRule): Promise<SellerContextResolution> {
  try {
    return { ok: true, context: await requireSellerPermission(rule.permission, rule.session) };
  } catch (error) {
    const digest = (error as { digest?: unknown } | null | undefined)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return { ok: false, error: rule.statusRefusal };
    }
    if (error instanceof Error && error.message.startsWith("Seller permission required:")) {
      return { ok: false, error: "You do not have permission to upload this kind of file" };
    }
    throw error;
  }
}

export const POST = guarded({ auth, roles: SELLER_ROLES }, async ({ req, userId, requestId }) => {
  // Explicit fail-closed gate at the boundary, matching the customer portal: an
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

  // Capability is checked per purpose: a staff member with catalog rights must
  // not thereby be able to file the organization's compliance documents.
  const resolved = await resolveSellerContext(SELLER_UPLOAD_RULES[body.purpose]);
  if (!resolved.ok) return jsonErr(resolved.error, 403, requestId);

  const decision = createPresignedUpload({
    // Namespace comes from the seller resolved through the session — owner via
    // SellerProfile.userId, staff via SellerMembership — never from the body.
    principal: { kind: "seller", sellerId: resolved.context.seller.id },
    purpose: body.purpose satisfies UploadPurpose,
    filename: body.filename,
    contentType: body.contentType,
    size: body.size,
  });
  if (!decision.ok) return jsonErr(decision.error, decision.status, requestId);

  return jsonOk(decision.upload);
});
