"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, createSellerCatalogListing, db, lockInventoryStockRows, lockProductCommercialRows, requireCurrentSellerActor, updateSellerCatalogListing } from "@avenick/database";
import { requireSellerPermissions, requireSellerSession } from "@/lib/auth";
import { assertProductImportPermissions } from "@/lib/product-import-policy";
import { parseSellerProductForm, PRODUCT_CURRENCIES, SELLER_MUTABLE_PRODUCT_STATUSES } from "@/lib/product-form";

const STATUSES = SELLER_MUTABLE_PRODUCT_STATUSES;
type BulkStatus = (typeof STATUSES)[number];

/**
 * Bulk update product status (seller-scoped). Only acts on products that
 * belong to the calling seller — ids for other sellers are silently ignored.
 */
export async function bulkUpdateProductStatus(productIds: string[], status: BulkStatus): Promise<{ count: number }> {
  const { seller, userId } = await requireSellerPermissions(["catalog.manage", "pricing.manage"]);
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  if (productIds.length === 0) return { count: 0 };

  const res = await db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, userId, seller.id, ["catalog.manage", "pricing.manage"]);
    const targets = await tx.product.findMany({
      where: { id: { in: productIds }, sellerId: seller.id, deletedAt: null },
      select: { id: true, status: true },
    });
    await lockProductCommercialRows(tx, targets.map((target) => target.id));
    const currentTargets = await tx.product.findMany({
      where: { id: { in: targets.map((target) => target.id) }, sellerId: seller.id, deletedAt: null },
      select: { id: true, status: true },
    });
    const updated = await tx.product.updateMany({
      where: { id: { in: currentTargets.map((target) => target.id) } },
      data: { status, ...(status === "PENDING_REVIEW" ? { publishedAt: null, isPubliclyDiscoverable: true } : {}) },
    });
    for (const target of currentTargets) {
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

export type ProductActionState = { error?: string; productId?: string };

function productMutationInput(parsed: ReturnType<typeof parseSellerProductForm> & { success: true }) {
  const value = parsed.data;
  return {
    categoryId: value.categoryId,
    sku: value.sku,
    nameEn: value.nameEn,
    nameAr: value.nameAr,
    descriptionEn: value.descriptionEn,
    descriptionAr: value.descriptionAr,
    imageUrl: value.imageUrl,
    origin: value.origin,
    moq: value.moq,
    currency: value.currency,
    vatRate: value.vatRate,
    b2bPrice: value.b2bEnabled ? value.b2bPrice : null,
    b2cPrice: value.b2cEnabled ? value.b2cPrice : null,
  };
}

export async function createProductAction(_state: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const parsed = parseSellerProductForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the listing details." };
  try {
    const { seller, userId } = await requireSellerPermissions(["catalog.manage", "pricing.manage"]);
    const product = await createSellerCatalogListing({ actorId: userId, sellerId: seller.id, ...productMutationInput(parsed) });
    revalidatePath("/products");
    return { productId: product.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to submit this listing." };
  }
}

export async function updateProductAction(productId: string, _state: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const parsed = parseSellerProductForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the listing details." };
  try {
    const { seller, userId } = await requireSellerPermissions(["catalog.manage", "pricing.manage"]);
    const product = await updateSellerCatalogListing({ productId, actorId: userId, sellerId: seller.id, ...productMutationInput(parsed) });
    revalidatePath("/products");
    revalidatePath(`/products/${product.id}/edit`);
    return { productId: product.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to submit these listing changes." };
  }
}

export type ImportRow = {
  sku: string;
  nameEn?: string;
  nameAr?: string;
  status?: string;
  price?: string;
  currency?: string;
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
export async function importProductsCsv(rows: ImportRow[], options: {
  /** Deterministic seams for PostgreSQL capability-revocation regressions. */
  afterSessionCheck?: () => Promise<void>;
  afterActorLock?: () => Promise<void>;
} = {}): Promise<ImportResult> {
  const { seller, userId, membership } = await requireSellerSession();
  const result: ImportResult = { updated: 0, skipped: 0, errors: [] };

  // Limit to a sane batch to keep the request bounded.
  const batch = rows.slice(0, 1000);
  assertProductImportPermissions(membership.permissions ?? [], batch);
  await options.afterSessionCheck?.();

  for (const row of batch) {
    const sku = (row.sku ?? "").trim();
    if (!sku) {
      result.skipped++;
      continue;
    }

    const product = await db.product.findFirst({
      where: { sku, sellerId: seller.id, deletedAt: null },
      select: { id: true },
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
        const required = ["catalog.manage"];
        if (row.price?.trim()) required.push("pricing.manage");
        if (row.stock?.trim()) required.push("inventory.manage");
        await requireCurrentSellerActor(tx, userId, seller.id, required);
        await options.afterActorLock?.();
        await lockProductCommercialRows(tx, [product.id]);
        const currentProduct = await tx.product.findFirstOrThrow({
          where: { id: product.id, sellerId: seller.id, deletedAt: null },
          include: { prices: { where: { isActive: true } }, inventory: true },
        });
        if (Object.keys(data).length > 0) {
          await tx.product.update({ where: { id: currentProduct.id }, data });
        }

        const priceNum = Number(row.price);
        if (row.price?.trim() && Number.isFinite(priceNum) && priceNum >= 0) {
          if (currentProduct.prices.length > 1) {
            throw new Error("Price import is ambiguous across multiple active price identities");
          }
          const existing = currentProduct.prices[0];
          const currency = row.currency?.trim().toUpperCase();
          if (currency && !(PRODUCT_CURRENCIES as readonly string[]).includes(currency)) {
            throw new Error("Price currency is not supported");
          }
          if (existing && currency && existing.currency !== currency) {
            throw new Error(`Price currency must remain ${existing.currency}`);
          }
          if (existing) {
            await tx.productPrice.update({ where: { id: existing.id }, data: { price: priceNum } });
          } else {
            if (!currency) throw new Error("Price creation requires an explicit currency column");
            await tx.productPrice.create({
              data: { productId: currentProduct.id, type: "B2C", currency: currency as (typeof PRODUCT_CURRENCIES)[number], price: priceNum },
            });
          }
        }

        const stockNum = Number(row.stock);
        if (row.stock?.trim() && Number.isInteger(stockNum) && stockNum >= 0) {
          if (currentProduct.inventory.length !== 1) {
            throw new Error(
              currentProduct.inventory.length === 0
                ? "Stock import requires an existing inventory identity"
                : "Stock import is ambiguous across multiple location or variant identities",
            );
          }
          const inv = currentProduct.inventory[0];
          await lockInventoryStockRows(tx, [inv.id]);
          const currentStock = await tx.inventoryStock.findUniqueOrThrow({ where: { id: inv.id } });
          // The conditional write closes the race with checkout reservations:
          // a CSV can never lower on-hand stock below the current reservation.
          const changed = await tx.inventoryStock.updateMany({
            where: {
              id: currentStock.id,
              qty: currentStock.qty,
              reservedQty: { lte: stockNum },
            },
            data: { qty: stockNum },
          });
          if (changed.count !== 1) throw new Error("Stock quantity cannot be below reserved quantity");
        }
        await tx.auditLog.create({
          data: {
            actorId: userId,
            sellerId: seller.id,
            entityType: "Product",
            entityId: currentProduct.id,
            action: AuditAction.UPDATE,
            before: {
              nameEn: currentProduct.nameEn,
              nameAr: currentProduct.nameAr,
              status: currentProduct.status,
              price: currentProduct.prices.length === 1 ? Number(currentProduct.prices[0]!.price) : null,
              stock: currentProduct.inventory.length === 1 ? currentProduct.inventory[0]!.qty : null,
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
