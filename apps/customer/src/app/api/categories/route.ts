import { NextResponse } from "next/server";
import { db } from "@avenick/database";

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
