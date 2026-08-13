import { NextRequest, NextResponse } from "next/server";
import { getOrdersForSeller } from "@avenick/database";
import type { OrderStatus } from "@avenick/database";
import { getServerSellerContext, sellerHasPermission } from "@/lib/seller-server";

const ORDER_STATUSES = new Set<OrderStatus>([
  "PENDING_PAYMENT",
  "PAYMENT_CONFIRMED",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURNED",
]);

export async function GET(req: NextRequest) {
  try {
    const context = await getServerSellerContext();
    if (!context) return NextResponse.json({ success: false, error: "Seller account required" }, { status: 401 });
    if (!sellerHasPermission(context, "orders.view")) {
      return NextResponse.json({ success: false, error: "Order-view permission required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawStatus = searchParams.get("status")?.trim();
    const status = rawStatus && ORDER_STATUSES.has(rawStatus as OrderStatus) ? rawStatus as OrderStatus : undefined;
    if (rawStatus && !status) {
      return NextResponse.json({ success: false, error: "Invalid order status filter" }, { status: 400 });
    }

    const rawPage = Number(searchParams.get("page") ?? 1);
    const rawLimit = Number(searchParams.get("limit") ?? 20);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isInteger(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 20;

    const result = await getOrdersForSeller(context.sellerId, { page, limit, ...(status ? { status } : {}) });
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to load seller orders" }, { status: 500 });
  }
}
