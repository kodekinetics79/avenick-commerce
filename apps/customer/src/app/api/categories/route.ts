import { NextResponse } from "next/server";
import { db } from "@avenick/database";

// Must not be statically executed at build time (no DB on build machines).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { children: { where: { isActive: true } } },
    });
    return NextResponse.json({ success: true, data: categories });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
