import { db } from "../index";
import { read } from "../resilient-ops";
import type { Prisma, ProductStatus, Currency, PricingType } from "@prisma/client";

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  categorySlug?: string;
  categoryId?: string;
  sellerId?: string;
  status?: ProductStatus;
  b2c?: boolean;
  b2b?: boolean;
  inStock?: boolean;
  sort?: "newest" | "name_asc";
  currency?: Currency;
}

export async function listProducts(params: ProductListParams) {
  const { page = 1, limit = 20, search, categoryId, categorySlug, sellerId, status, b2c, b2b, inStock, sort } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(categorySlug && { category: { slug: categorySlug } }),
    ...(sellerId && { sellerId }),
    ...(b2c !== undefined && { isB2CEnabled: b2c }),
    ...(b2b !== undefined && { isB2BEnabled: b2b }),
    ...(inStock && { inventory: { some: { qty: { gt: 0 } } } }),
    ...(search && {
      OR: [
        { nameEn: { contains: search, mode: "insensitive" } },
        { nameAr: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  // Catalog listing is a "must stay up" read: run it through the resilience
  // layer with a short-lived, stale-on-failure cache so a DB blip degrades to
  // last-known-good results instead of a 500 on the browse/search path.
  const cacheKey = `products:list:${JSON.stringify({ page, limit, sort, where })}`;
  const { data } = await read(
    async () => {
      const [products, total] = await Promise.all([
        db.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: sort === "name_asc" ? { nameEn: "asc" } : { createdAt: "desc" },
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            prices: { where: { isActive: true } },
            inventory: { select: { qty: true, reservedQty: true } },
            category: { select: { nameEn: true, nameAr: true, slug: true } },
            brand: { select: { nameEn: true, nameAr: true } },
            seller: { select: { businessNameEn: true, businessNameAr: true, tier: true, rating: true } },
            issues: { where: { resolvedAt: null } },
          },
        }),
        db.product.count({ where }),
      ]);
      return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    { name: "products.list", cache: { key: cacheKey, ttlMs: 60_000 } },
  );

  return data;
}

export async function getProductBySlug(
  slug: string,
  channel: "B2C" | "B2B" = "B2C",
  currency?: Currency,
) {
  const product = await db.product.findUnique({
    where: { slug, deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      prices: { where: { isActive: true }, orderBy: [{ type: "asc" }, { minQty: "asc" }] },
      inventory: { include: { location: { include: { warehouse: true } } } },
      category: true,
      brand: true,
      seller: { select: { id: true, businessNameEn: true, businessNameAr: true, tier: true, rating: true, reviewCount: true, city: true, country: true } },
      compliance: { where: { status: "APPROVED" } },
      variants: { include: { prices: { where: { isActive: true } } } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!product) return null;
  const { inventory, variants, prices, ...safe } = product;
  return {
    ...safe,
    prices: prices.filter((price) => price.type === channel && (!currency || price.currency === currency)),
    inventory: inventory.map((stock) => ({
      variantId: stock.variantId,
      available: Math.max(0, stock.qty - stock.reservedQty),
    })),
    variants: variants.map((variant) => ({
      ...variant,
      prices: variant.prices.filter((price) => price.type === channel && (!currency || price.currency === currency)),
    })),
  };
}

export async function getSellerDashboard(sellerId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    todayOrderCount,
    pendingOrders,
    lowStockItems,
    issueCount,
    pendingCompliance,
    pendingPayout,
    activeListings,
    recentOrders,
    unreadMessages,
    rfqCount,
  ] = await Promise.all([
    db.orderItem.count({ where: { sellerId, order: { createdAt: { gte: today } } } }),
    db.orderItem.count({ where: { sellerId, status: "PROCESSING" } }),
    // Count low-stock items using raw SQL for cross-column comparison
    db.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint as count FROM "InventoryStock" WHERE "productId" IN (SELECT id FROM "Product" WHERE "sellerId" = ${sellerId}) AND qty <= "reorderPoint"`.then((r) => Number(r[0]?.count ?? 0)),
    db.productIssue.count({ where: { product: { sellerId }, resolvedAt: null } }),
    db.sellerDocument.count({ where: { sellerId, status: "PENDING_REVIEW" } }),
    db.sellerPayout.aggregate({ where: { sellerId, status: "PENDING" }, _sum: { amount: true } }),
    db.product.count({ where: { sellerId, status: "ACTIVE", deletedAt: null } }),
    db.order.findMany({
      where: { items: { some: { sellerId } } },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true, status: true, total: true, currency: true, createdAt: true, type: true },
    }),
    db.message.count({ where: { thread: { sellerId }, isRead: false, senderType: "BUYER" } }),
    db.rFQRequest.count({ where: { sellerId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
  ]);

  const monthRevenue = await db.orderItem.aggregate({
    where: { sellerId, order: { createdAt: { gte: monthStart }, paymentStatus: "PAID" } },
    _sum: { total: true },
  });

  return {
    todayOrderCount,
    pendingOrders,
    lowStockItems,
    issueCount,
    pendingCompliance,
    pendingPayoutAmount: pendingPayout._sum.amount ?? 0,
    activeListings,
    monthRevenue: monthRevenue._sum.total ?? 0,
    recentOrders,
    unreadMessages,
    rfqCount,
  };
}
