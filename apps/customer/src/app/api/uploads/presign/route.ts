import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth-instance";
import { isObjectStorageConfigured, presignPutUrl, objectPublicUrl, buildObjectKey } from "@avenick/utils/s3";

export const dynamic = "force-dynamic";

const Body = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().max(160).optional(),
  // Where the object lives; constrained to known namespaces so a caller can't
  // write anywhere in the bucket.
  namespace: z.enum(["rfq-documents", "compliance", "product-images"]).default("rfq-documents"),
});

/**
 * Vend a short-lived presigned PUT URL so the browser can upload a file
 * directly to object storage. Auth-gated: only signed-in users get a URL.
 * Returns 503 with a clear message when object storage isn't configured, so
 * the UI can show "uploads unavailable" instead of a broken control.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in to upload files" }, { status: 401 });
  }
  if (!isObjectStorageConfigured()) {
    return NextResponse.json(
      { success: false, error: "File uploads are not available in this environment" },
      { status: 503 },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid upload request" }, { status: 400 });
  }

  const key = buildObjectKey(parsed.data.namespace, parsed.data.filename);
  const uploadUrl = presignPutUrl(key, { contentType: parsed.data.contentType, expiresIn: 300 });

  return NextResponse.json({
    success: true,
    data: { uploadUrl, key, publicUrl: objectPublicUrl(key), expiresIn: 300 },
  });
}
