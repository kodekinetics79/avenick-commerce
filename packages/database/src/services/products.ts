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
  publiclyDiscoverable?: boolean;
  inStock?: boolean;
  sort?: "newest" | "name_asc";
  currency?: Currency;
}

export function normalizeCatalogSearch(value?: string) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized || undefined;
}

export async function listProducts(params: ProductListParams) {
  const { page = 1, limit = 20, search, categoryId, categorySlug, sellerId, status, b2c, b2b, publiclyDiscoverable, inStock, sort } = params;
  const skip = (page - 1) * limit;
  const normalizedSearch = normalizeCatalogSearch(search);
  const categoryIds = categorySlug
    ? await db.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE category_tree AS (
          SELECT id FROM "Category" WHERE slug = ${categorySlug} AND "isActive" = true
          UNION ALL
          SELECT child.id
          FROM "Category" child
          INNER JOIN category_tree parent ON child."parentId" = parent.id
          WHERE child."isActive" = true
        )
        SELECT id FROM category_tree
      `.then((rows) => rows.map(({ id }) => id))
    : undefined;
  const and: Prisma.ProductWhereInput[] = [];
  if (publiclyDiscoverable !== undefined) and.push({ isPubliclyDiscoverable: publiclyDiscoverable });
  if (normalizedSearch) {
    and.push({
      OR: [
        { nameEn: { contains: normalizedSearch, mode: "insensitive" } },
        { nameAr: { contains: normalizedSearch, mode: "insensitive" } },
        { sku: { contains: normalizedSearch, mode: "insensitive" } },
        { commercialMetadata: { is: { OR: [
          { manufacturerPartNumber: { contains: normalizedSearch, mode: "insensitive" } },
          { supplierPartNumber: { contains: normalizedSearch, mode: "insensitive" } },
          { externalItemNumber: { contains: normalizedSearch, mode: "insensitive" } },
          { erpCode: { contains: normalizedSearch, mode: "insensitive" } },
        ] } } },
      ],
    });
  }

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    // Pilot imports attach products to leaf categories at varying depths.
    // Resolve the full active subtree so every advertised parent category is
    // a truthful browse path, not an exact-slug dead end.
    ...(categoryIds && { categoryId: { in: categoryIds } }),
    ...(sellerId && { sellerId }),
    ...(b2c !== undefined && { isB2CEnabled: b2c }),
    ...(b2b !== undefined && { isB2BEnabled: b2b }),
    ...(inStock && { inventory: { some: { qty: { gt: 0 } } } }),
    ...(and.length > 0 && { AND: and }),
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
            inventory: { select: { variantId: true, qty: true, reservedQty: true } },
            variants: {
              where: { isActive: true },
              select: { id: true, prices: { where: { isActive: true } } },
            },
            category: { select: { nameEn: true, nameAr: true, slug: true } },
            brand: { select: { nameEn: true, nameAr: true } },
            seller: { select: { businessNameEn: true, businessNameAr: true, tier: true, rating: true } },
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
      select: {
        id: true, orderNumber: true, status: true, currency: true, createdAt: true, type: true,
        items: { where: { sellerId }, select: { total: true } },
      },
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
    recentOrders: recentOrders.map(({ items, ...order }) => ({
      ...order,
      total: items.reduce((sum, item) => sum + Number(item.total), 0),
    })),
    unreadMessages,
    rfqCount,
  };
}
