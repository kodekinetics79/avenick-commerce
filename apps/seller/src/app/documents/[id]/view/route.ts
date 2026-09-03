import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@avenick/database";
import { isRecordId } from "@avenick/utils";
import { browserDirectUploadsEnabled, isKeyInUploadNamespace } from "@avenick/utils/browser-upload-policy";
import { presignGetUrl } from "@avenick/utils/s3";
import { ONBOARDING_SELLER_STATUSES, requireSellerAnyPermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Open a compliance document.
 *
 * SellerDocument.fileUrl holds an object KEY under the seller's private
 * prefix, not a URL: the bucket serves nothing under private/ anonymously, so
 * the only way to read the file is a presigned GET minted here, for this
 * seller, for a few minutes. The redirect is marked no-store so the signed
 * URL is not kept by any cache between the seller and the browser.
 *
 * Rows that predate the upload path (seed data) hold an absolute URL instead;
 * those are passed through unchanged rather than mis-signed as keys.
 */
const NO_STORE = { "cache-control": "no-store" } as const;

/**
 * A seed-era absolute link the browser can actually follow. The bare
 * `^https?://` test alone let a malformed value (`https://`, a host with a
 * space) reach NextResponse.redirect, which throws — a 500 where the seller
 * should be told the file is unreachable. Mirrors the admin viewer so both
 * answer such a row the same way (409).
 */
function isFollowableLink(fileUrl: string): boolean {
  if (!/^https?:\/\//i.test(fileUrl)) return false;
  try {
    const url = new URL(fileUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!isRecordId(params.id)) notFound();
  // These bodies are read by the seller in a browser tab, so they are written
  // in the reader's language like every other refusal in this portal.
  const t = await getTranslations("sellerRelations");

  // A seller under review may read what they have filed. The permission
  // failure is answered here as 403 rather than left to bubble as a 500;
  // the status redirect (NEXT_REDIRECT) must propagate untouched.
  let sellerId: string;
  try {
    const context = await requireSellerAnyPermission(["documents.view", "documents.manage"], {
      allowedSellerStatuses: ONBOARDING_SELLER_STATUSES,
    });
    sellerId = context.seller.id;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Seller permission required:")) {
      return new NextResponse(t("documentView.forbidden"), {
        status: 403,
        headers: NO_STORE,
      });
    }
    throw error;
  }

  // Scoped by sellerId in the query itself: another seller's id is simply not found.
  const document = await db.sellerDocument.findFirst({
    where: { id: params.id, sellerId },
    select: { fileUrl: true },
  });
  if (!document) notFound();

  if (isKeyInUploadNamespace(document.fileUrl, { kind: "seller", sellerId }, "seller-document")) {
    if (!browserDirectUploadsEnabled()) {
      return new NextResponse(t("documentView.storageUnavailable"), { status: 503, headers: NO_STORE });
    }
    // The helper's default TTL (minutes, not hours) is the whole lifetime of
    // this link; the browser follows it immediately.
    return NextResponse.redirect(presignGetUrl(document.fileUrl), { status: 302, headers: NO_STORE });
  }

  if (isFollowableLink(document.fileUrl)) {
    return NextResponse.redirect(document.fileUrl, { status: 302, headers: NO_STORE });
  }

  // Neither a key this seller owns nor a link: the row cannot be opened, and
  // saying so beats a redirect to nowhere.
  return new NextResponse(t("documentView.unopenable"), {
    status: 409,
    headers: NO_STORE,
  });
}
