"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, db } from "@avenick/database";
import { requireSellerPermission } from "@/lib/auth";

const STATUSES = ["DRAFT", "ACTIVE", "SUPPRESSED", "INACTIVE"] as const;
type BulkStatus = (typeof STATUSES)[number];

/**
 * Bulk update product status (seller-scoped). Only acts on products that
 * belong to the calling seller — ids for other sellers are silently ignored.
 */
export async function bulkUpdateProductStatus(productIds: string[], status: BulkStatus): Promise<{ count: number }> {
  const { seller, userId } = await requireSellerPermission("catalog.manage");
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  if (productIds.length === 0) return { count: 0 };

  const res = await db.$transaction(async (tx) => {
    const targets = await tx.product.findMany({
      where: { id: { in: productIds }, sellerId: seller.id, deletedAt: null },
      select: { id: true, status: true },
    });
    const updated = await tx.product.updateMany({
      where: { id: { in: targets.map((target) => target.id) } },
      data: { status, ...(status === "ACTIVE" ? { publishedAt: new Date() } : {}) },
    });
    for (const target of targets) {
      await tx.auditLog.create({
        data: {
          actorId: userId,
          sellerId: seller.id,
          entityType: "Product",
          entityId: target.id,
          action: AuditAction.STATUS_CHANGE,
          before: { status: target.status },
          after: { status, source: "SELLER_BULK_ACTION" },
        },
      });
    }
    return updated;
  });

  revalidatePath("/products");
  return { count: res.count };
}

export type ImportRow = {
  sku: string;
  nameEn?: string;
  nameAr?: string;
  status?: string;
  price?: string;
  stock?: string;
};

export type ImportResult = {
  updated: number;
  skipped: number;
  errors: string[];
};

/**
 * CSV-driven bulk update. Matches existing products by SKU within the seller's
 * own catalog and updates name/status/price/stock where provided. Unknown SKUs
 * are reported back rather than silently creating products — keeps the seller's
 * catalog authoritative and avoids accidental duplicates.
 */
export async function importProductsCsv(rows: ImportRow[]): Promise<ImportResult> {
  const { seller, userId } = await requireSellerPermission("catalog.manage");
  const result: ImportResult = { updated: 0, skipped: 0, errors: [] };

  // Limit to a sane batch to keep the request bounded.
  const batch = rows.slice(0, 1000);

  for (const row of batch) {
    const sku = (row.sku ?? "").trim();
    if (!sku) {
      result.skipped++;
      continue;
    }

    const product = await db.product.findFirst({
      where: { sku, sellerId: seller.id, deletedAt: null },
      include: { prices: { where: { isActive: true }, take: 1 }, inventory: { take: 1 } },
    });

    if (!product) {
      result.skipped++;
      result.errors.push(`SKU "${sku}" not found in your catalog`);
      continue;
    }

    const data: { nameEn?: string; nameAr?: string; status?: BulkStatus } = {};
    if (row.nameEn?.trim()) data.nameEn = row.nameEn.trim();
    if (row.nameAr?.trim()) data.nameAr = row.nameAr.trim();
    const statusUp = row.status?.trim().toUpperCase();
    if (statusUp && (STATUSES as readonly string[]).includes(statusUp)) data.status = statusUp as BulkStatus;

    try {
      await db.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.product.update({ where: { id: product.id }, data });
        }

        const priceNum = Number(row.price);
        if (row.price?.trim() && Number.isFinite(priceNum) && priceNum >= 0) {
          const existing = product.prices[0];
          if (existing) {
            await tx.productPrice.update({ where: { id: existing.id }, data: { price: priceNum } });
          } else {
            await tx.productPrice.create({ data: { productId: product.id, type: "B2C", price: priceNum } });
          }
        }

        const stockNum = Number(row.stock);
        if (row.stock?.trim() && Number.isInteger(stockNum) && stockNum >= 0) {
          const inv = product.inventory[0];
          if (inv) {
            await tx.inventoryStock.update({ where: { id: inv.id }, data: { qty: stockNum } });
          }
          // No inventory row yet → skip (location unknown); name/status/price still applied.
        }
        await tx.auditLog.create({
          data: {
            actorId: userId,
            sellerId: seller.id,
            entityType: "Product",
            entityId: product.id,
            action: AuditAction.UPDATE,
            before: {
              nameEn: product.nameEn,
              nameAr: product.nameAr,
              status: product.status,
              price: product.prices[0] ? Number(product.prices[0].price) : null,
              stock: product.inventory[0]?.qty ?? null,
            },
            after: {
              source: "SELLER_CSV_IMPORT",
              fields: Object.keys(data),
              ...(row.price?.trim() ? { price: Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : "IGNORED_INVALID" } : {}),
              ...(row.stock?.trim() ? { stock: Number.isInteger(stockNum) && stockNum >= 0 ? stockNum : "IGNORED_INVALID" } : {}),
            },
          },
        });
      });
      result.updated++;
    } catch (e) {
      result.skipped++;
      result.errors.push(`SKU "${sku}": ${(e as Error).message}`);
    }
  }

  if (result.updated > 0) revalidatePath("/products");
  return result;
}
