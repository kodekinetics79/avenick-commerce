import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { db } from "@avenick/database";
import { isRecordId } from "@avenick/utils";
import { browserDirectUploadsEnabled, isKeyInUploadNamespace } from "@avenick/utils/browser-upload-policy";
import { presignGetUrl } from "@avenick/utils/s3";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Open a seller's compliance document for review.
 *
 * SellerDocument.fileUrl holds an object KEY under the seller's private
 * prefix, not a URL: the bucket serves nothing under private/ anonymously, so
 * the only way to read the file is a presigned GET minted here, for this
 * request, for a few minutes. The redirect is marked no-store so the signed
 * URL is not kept by any cache between the platform and the reviewer's browser.
 *
 * This is the admin twin of apps/seller/src/app/documents/[id]/view/route.ts
 * and applies the same namespace test (isKeyInUploadNamespace, the stricter
 * of the two guards — it also checks the generated-segment shape), so a row
 * either opens in both portals or in neither. The one difference: an admin
 * reviews every seller, so the row is loaded by id alone and the namespace is
 * checked against the sellerId the row itself carries.
 *
 * Rows that predate the upload path (seed data) hold an absolute URL instead;
 * those are passed through unchanged rather than mis-signed as keys.
 */
const NO_STORE = { "cache-control": "no-store" } as const;

/**
 * Whether a seed-era fileUrl is an absolute http(s) link the browser could
 * follow. Parsed before it is passed on: NextResponse.redirect throws on a
 * malformed URL, and a bad row must answer 409 below — where the reviewer is
 * told the file is unreachable — rather than surface as a 500.
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

  // Re-checked against the database on every request. An unauthenticated or
  // no-longer-admin caller is sent to /login; that redirect (NEXT_REDIRECT)
  // must propagate untouched.
  await requireAdminSession();

  const document = await db.sellerDocument.findUnique({
    where: { id: params.id },
    select: { fileUrl: true, sellerId: true },
  });
  if (!document) notFound();

  if (isKeyInUploadNamespace(document.fileUrl, { kind: "seller", sellerId: document.sellerId }, "seller-document")) {
    if (!browserDirectUploadsEnabled()) {
      return new NextResponse(
        "File storage is not configured in this environment, so this document cannot be opened.",
        { status: 503, headers: NO_STORE },
      );
    }
    // The helper's default TTL (minutes, not hours) is the whole lifetime of
    // this link; the browser follows it immediately.
    return NextResponse.redirect(presignGetUrl(document.fileUrl), { status: 302, headers: NO_STORE });
  }

  if (isFollowableLink(document.fileUrl)) {
    return NextResponse.redirect(document.fileUrl, { status: 302, headers: NO_STORE });
  }

  // Neither a key in the owning seller's namespace nor a link the browser
  // could follow: the row cannot be opened, and saying so beats a redirect to
  // nowhere.
  return new NextResponse("This document's file reference cannot be opened from this environment.", {
    status: 409,
    headers: NO_STORE,
  });
}
