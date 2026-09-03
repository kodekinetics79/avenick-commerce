"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { RATE_LIMITS, checkRateLimit } from "@avenick/auth/rate-limit";
import { SELLER_DOCUMENT_TYPES, recordSellerDocument, type DocumentType } from "@avenick/database";
import { log } from "@avenick/observability";
import {
  UPLOAD_POLICIES,
  browserDirectUploadsEnabled,
  isKeyInUploadNamespace,
} from "@avenick/utils/browser-upload-policy";
import { ONBOARDING_SELLER_STATUSES, requireSellerPermission } from "@/lib/auth";

const DOCUMENT_POLICY = UPLOAD_POLICIES["seller-document"];

/**
 * What the browser sends after a successful PUT to the presigned URL. Every
 * field is re-checked here against the policy the presigner applied, because
 * the browser is the one reporting them: the key must be one the presigner
 * would have issued to THIS seller, the media type must be the one signed for
 * that key's extension, and the size must be within the ceiling.
 *
 * Built per call rather than at module scope so every refusal it can state is
 * written in the caller's language; the shape and the rules are unchanged.
 */
function recordDocumentSchema(t: (key: string, values?: Record<string, string | number>) => string) {
  return z.object({
    type: z.enum(SELLER_DOCUMENT_TYPES as [DocumentType, ...DocumentType[]]),
    fileKey: z.string().min(1).max(512),
    fileName: z.string().trim().min(1, t("documentErrors.fileNameRequired")).max(255),
    fileSize: z.number().int().positive(),
    mimeType: z.string().trim().min(1).max(128),
    /** Calendar date (YYYY-MM-DD) chosen by the seller; absent when the type has no expiry. */
    expiryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, t("documentErrors.expiryNotCalendarDate"))
      .nullable()
      .optional(),
  });
}

export type RecordSellerDocumentInput = z.input<ReturnType<typeof recordDocumentSchema>>;

export type RecordSellerDocumentState =
  | { ok: true; documentId: string; supersededCount: number }
  | { ok: false; error: string };

/** The extension the presigner keyed the object under, lowercase with the dot. */
function keyExtension(key: string): string {
  const dot = key.lastIndexOf(".");
  return dot >= 0 ? key.slice(dot).toLowerCase() : "";
}

/**
 * Record a document the browser has just uploaded, opening (or replacing) the
 * admin review for its type. Open to a seller still under review — that is
 * the whole point: approval needs these files.
 *
 * Errors come back as state rather than throws so the uploader can show them
 * in place; the one exception is the auth redirect, which must propagate.
 */
export async function recordSellerDocumentAction(raw: unknown): Promise<RecordSellerDocumentState> {
  const { seller, userId } = await requireSellerPermission("documents.manage", {
    allowedSellerStatuses: ONBOARDING_SELLER_STATUSES,
  });
  const t = await getTranslations("sellerRelations");

  // With no storage configured the key cannot exist, so nothing may be recorded
  // against it — the same fail-closed answer the presign route gives.
  if (!browserDirectUploadsEnabled()) {
    return { ok: false, error: t("documentErrors.uploadsDisabled") };
  }

  const parsed = recordDocumentSchema(t).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? t("documentErrors.invalidDetails") };
  }
  const input = parsed.data;

  // Namespace check: the key must be one the presigner would have minted for
  // this seller and this purpose. A key under another seller's prefix, a
  // product-image key, or a hand-built path is refused before any write.
  if (!isKeyInUploadNamespace(input.fileKey, { kind: "seller", sellerId: seller.id }, "seller-document")) {
    return { ok: false, error: t("documentErrors.foreignKey") };
  }

  // The stored media type must be the one storage enforced for that extension;
  // recording anything else would make the row lie about the object.
  const expectedType = DOCUMENT_POLICY.mediaTypesByExtension[keyExtension(input.fileKey)];
  const declaredType = input.mimeType.split(";")[0]!.trim().toLowerCase();
  if (!expectedType || declaredType !== expectedType) {
    return { ok: false, error: t("documentErrors.typeMismatch") };
  }
  if (input.fileSize > DOCUMENT_POLICY.maxBytes) {
    return { ok: false, error: t("documentErrors.tooLarge") };
  }

  let expiryDate: Date | null = null;
  if (input.expiryDate) {
    // A calendar date with no time zone is taken as UTC midnight; the Document
    // Center compares it to "now" the same way for every seller.
    expiryDate = new Date(`${input.expiryDate}T00:00:00.000Z`);
    if (Number.isNaN(expiryDate.getTime())) return { ok: false, error: t("documentErrors.expiryInvalid") };
    if (expiryDate.getTime() <= Date.now()) {
      return { ok: false, error: t("documentErrors.expiryNotFuture") };
    }
  }

  // Per-seller budget: every record is one admin review item.
  const rl = await checkRateLimit(RATE_LIMITS.sellerDocumentUpload, seller.id);
  if (!rl.ok) {
    return { ok: false, error: t("documentErrors.rateLimited") };
  }

  try {
    const result = await recordSellerDocument({
      sellerId: seller.id,
      actorId: userId,
      type: input.type,
      fileKey: input.fileKey,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: expectedType,
      expiryDate,
    });
    revalidatePath("/documents");
    revalidatePath("/compliance");
    revalidatePath("/onboarding");
    return { ok: true, documentId: result.id, supersededCount: result.supersededIds.length };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Current seller") || error.message.startsWith("Only files uploaded"))
    ) {
      return { ok: false, error: error.message };
    }
    log.error("seller document record failed", error, { scope: "documents.actions", sellerId: seller.id });
    return { ok: false, error: t("documentErrors.notRecorded") };
  }
}
