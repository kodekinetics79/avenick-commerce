import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { generateDraft } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !["SELLER_OWNER", "SELLER_STAFF"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = body.kind;
  if (kind !== "rfq" && kind !== "listing") {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const result = await generateDraft(kind, String(body.context ?? ""));
  return NextResponse.json(result);
}
