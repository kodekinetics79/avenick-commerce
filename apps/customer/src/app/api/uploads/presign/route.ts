import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { browserDirectUploadsEnabled } from "@avenick/utils/browser-upload-policy";

export const dynamic = "force-dynamic";

/**
 * Browser PUT presigning is deliberately disabled. The current S3-compatible
 * signer cannot bind an object-size ceiling, verified media type, or a user's
 * role to a namespace. Returning a URL would therefore permit unbounded public
 * object hosting. Re-enable only behind a storage policy/post-upload verifier.
 */
export async function POST(_request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in to upload files" }, { status: 401 });
  }
  // Keep this explicit check at the route boundary so a future implementation
  // must consciously replace the fail-closed policy before issuing any URL.
  if (browserDirectUploadsEnabled()) {
    return NextResponse.json({ success: false, error: "Upload policy is not implemented" }, { status: 503 });
  }
  return NextResponse.json(
    { success: false, error: "Direct file uploads are disabled until storage-enforced size and content validation is available" },
    { status: 503 },
  );
}
