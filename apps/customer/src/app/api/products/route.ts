import { NextRequest, NextResponse } from "next/server";
import { listProducts } from "@manzil/database";
import type { ProductStatus } from "@manzil/database";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await listProducts({
      page: parseInt(searchParams.get("page") ?? "1"),
      limit: parseInt(searchParams.get("limit") ?? "24"),
      search: searchParams.get("search") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      status: "ACTIVE" as ProductStatus,
      b2c: searchParams.get("b2c") === "true" ? true : undefined,
      b2b: searchParams.get("b2b") === "true" ? true : undefined,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to fetch products" }, { status: 500 });
  }
}
