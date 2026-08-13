import { NextResponse } from "next/server";
import { db } from "@avenick/database";
import { z } from "zod";
import { getServerB2BContext } from "@/lib/b2b-server";
import { companyCurrencyForCountry } from "@/lib/company-currency";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive().max(100000) })).min(1).max(500),
});

export async function POST(request: Request) {
  const ctx = await getServerB2BContext();
  if (!ctx) return NextResponse.json({ success: false, error: "Active company account required" }, { status: 401 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid requisition basket" }, { status: 400 });

  const currency = companyCurrencyForCountry(ctx.company.country);
  const products = await db.product.findMany({
    where: { id: { in: [...new Set(parsed.data.items.map((item) => item.productId))] }, deletedAt: null },
    include: {
      prices: { where: { isActive: true, type: "B2B", currency } },
      variants: { where: { isActive: true }, select: { id: true } },
      inventory: { where: { variantId: null }, select: { qty: true, reservedQty: true } },
      seller: { select: { id: true, status: true, deletedAt: true } },
    },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  try {
    const lines = parsed.data.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product || product.status !== "ACTIVE" || !product.isB2BEnabled || product.seller.status !== "ACTIVE" || product.seller.deletedAt) {
        throw new Error("A requisition product is no longer available for B2B ordering");
      }
      if (product.variants.length > 0) throw new Error(`Select a variant for "${product.nameEn}" before reordering`);
      if (item.quantity < product.moq) throw new Error(`Minimum order quantity for "${product.nameEn}" is ${product.moq}`);
      const available = product.inventory.reduce((sum, stock) => sum + stock.qty - stock.reservedQty, 0);
      if (available < item.quantity) throw new Error(`Insufficient stock for "${product.nameEn}"`);
      const tier = product.prices
        .filter((price) => price.minQty <= item.quantity && (price.maxQty == null || item.quantity <= price.maxQty))
        .sort((a, b) => b.minQty - a.minQty)[0];
      if (!tier) throw new Error(`No active B2B ${currency} price for "${product.nameEn}"`);
      return {
        productId: product.id, slug: product.slug, nameEn: product.nameEn, nameAr: product.nameAr,
        sku: product.sku, qty: item.quantity, moq: product.moq, unitPrice: Number(tier.price),
        vatRate: Number(tier.vatRate), sellerId: product.seller.id, currency,
      };
    });
    return NextResponse.json({ success: true, data: { currency, lines } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to reprice requisition" }, { status: 409 });
  }
}
