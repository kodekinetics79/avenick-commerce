import { AuditAction, type Currency, type OrderStatus, type Prisma, type PricingType } from "@prisma/client";
import { db } from "../client";
import { lockProductCommercialRows, requireCurrentSellerActor } from "./checkout-invariants";

export const SELLER_CATALOG_CURRENCIES = ["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"] as const satisfies readonly Currency[];

export type SellerCatalogListingInput = {
  categoryId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  imageUrl?: string | null;
  origin?: Prisma.ProductCreateInput["origin"];
  moq: number;
  currency: Currency;
  vatRate: number;
  b2bPrice?: number | null;
  b2cPrice?: number | null;
};

export type SellerCatalogMutation = SellerCatalogListingInput & {
  actorId: string;
  sellerId: string;
};

function slugPart(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

async function availableSlug(
  tx: Prisma.TransactionClient,
  input: Pick<SellerCatalogListingInput, "nameEn" | "sku">,
  currentProductId?: string,
) {
  const base = `${slugPart(input.nameEn) || "product"}-${slugPart(input.sku) || "sku"}`.slice(0, 120);
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const collision = await tx.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!collision || collision.id === currentProductId) return candidate;
  }
  throw new Error("Unable to allocate a unique product URL");
}

function activePrices(input: SellerCatalogListingInput) {
  const prices: Array<{ type: PricingType; price: number }> = [];
  if (input.b2bPrice != null) prices.push({ type: "B2B", price: input.b2bPrice });
  if (input.b2cPrice != null) prices.push({ type: "B2C", price: input.b2cPrice });
  return prices;
}

function isTrustedProductImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname === "placehold.co"
      || url.hostname === "www.mennekes.org"
      || url.hostname === "avenick.com"
      || url.hostname.endsWith(".avenick.com")
    );
  } catch {
    return false;
  }
}

function assertListingInput(input: SellerCatalogListingInput) {
  if (!input.categoryId || !input.sku.trim() || !input.nameEn.trim() || !input.nameAr.trim()) {
    throw new Error("Category, SKU, English name and Arabic name are required");
  }
  if (!Number.isInteger(input.moq) || input.moq < 1 || input.moq > 1_000_000) throw new Error("MOQ must be a positive whole number");
  if (!SELLER_CATALOG_CURRENCIES.includes(input.currency)) throw new Error("Unsupported currency");
  if (input.imageUrl && !isTrustedProductImageUrl(input.imageUrl)) throw new Error("Product image host is not approved");
  if (!Number.isFinite(input.vatRate) || input.vatRate < 0 || input.vatRate > 100) throw new Error("VAT rate must be between 0 and 100");
  const prices = activePrices(input);
  if (prices.length === 0) throw new Error("At least one B2B or B2C price is required");
  if (prices.some(({ price }) => !Number.isFinite(price) || price <= 0 || price > 999_999_999.99)) throw new Error("Prices must be positive amounts");
}

function productFields(input: SellerCatalogListingInput, slug: string) {
  return {
    categoryId: input.categoryId,
    sku: input.sku.trim(),
    slug,
    nameEn: input.nameEn.trim(),
    nameAr: input.nameAr.trim(),
    descriptionEn: input.descriptionEn?.trim() || null,
    descriptionAr: input.descriptionAr?.trim() || null,
    origin: input.origin ?? null,
    moq: input.moq,
    status: "PENDING_REVIEW" as const,
    // This flag expresses the seller's publication intent. The customer catalog
    // still requires status=ACTIVE, which only the governed admin review grants.
    isPubliclyDiscoverable: true,
    isB2BEnabled: input.b2bPrice != null,
    isB2CEnabled: input.b2cPrice != null,
    publishedAt: null,
  };
}

async function replacePrices(tx: Prisma.TransactionClient, productId: string, input: SellerCatalogListingInput) {
  await tx.productPrice.updateMany({ where: { productId, isActive: true }, data: { isActive: false } });
  await tx.productPrice.createMany({
    data: activePrices(input).map(({ type, price }) => ({
      productId,
      type,
      currency: input.currency,
      minQty: input.moq,
      price,
      vatRate: input.vatRate,
      isActive: true,
    })),
  });
}

async function replacePrimaryImage(tx: Prisma.TransactionClient, productId: string, input: SellerCatalogListingInput) {
  if (!input.imageUrl) return;
  await tx.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
  await tx.productImage.create({
    data: { productId, url: input.imageUrl, altEn: input.nameEn, altAr: input.nameAr, isPrimary: true },
  });
}

/** Seller-scoped creation. A seller can request review but can never self-activate. */
export async function createSellerCatalogListing(input: SellerCatalogMutation) {
  assertListingInput(input);
  return db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, input.actorId, input.sellerId, ["catalog.manage", "pricing.manage"]);
    const category = await tx.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } });
    if (!category) throw new Error("Active category not found");
    const duplicate = await tx.product.findUnique({ where: { sku: input.sku.trim() }, select: { id: true } });
    if (duplicate) throw new Error("SKU is already in use");
    const slug = await availableSlug(tx, input);
    const product = await tx.product.create({ data: { sellerId: input.sellerId, ...productFields(input, slug) } });
    await replacePrices(tx, product.id, input);
    await replacePrimaryImage(tx, product.id, input);
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: input.sellerId,
        entityType: "Product",
        entityId: product.id,
        action: AuditAction.CREATE,
        after: { status: "PENDING_REVIEW", source: "SELLER_SELF_SERVICE", sku: product.sku },
      },
    });
    return product;
  });
}

/** Seller-scoped edit. Any edit returns the listing to governed review. */
export async function updateSellerCatalogListing(input: SellerCatalogMutation & { productId: string }) {
  assertListingInput(input);
  return db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, input.actorId, input.sellerId, ["catalog.manage", "pricing.manage"]);
    await lockProductCommercialRows(tx, [input.productId]);
    const current = await tx.product.findFirst({
      where: { id: input.productId, sellerId: input.sellerId, deletedAt: null },
      select: { id: true, status: true, sku: true, nameEn: true, categoryId: true, prices: { where: { isActive: true }, select: { type: true } } },
    });
    if (!current) throw new Error("Product not found in this seller account");
    if (current.sku !== input.sku.trim()) throw new Error("SKU cannot be changed after creation");
    if (new Set(current.prices.map((price) => price.type)).size !== current.prices.length) {
      throw new Error("Tiered pricing cannot be changed in the simple listing editor");
    }
    const category = await tx.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } });
    if (!category) throw new Error("Active category not found");
    const slug = await availableSlug(tx, input, current.id);
    const product = await tx.product.update({ where: { id: current.id }, data: productFields(input, slug) });
    await replacePrices(tx, product.id, input);
    await replacePrimaryImage(tx, product.id, input);
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: input.sellerId,
        entityType: "Product",
        entityId: product.id,
        action: AuditAction.UPDATE,
        before: { status: current.status, nameEn: current.nameEn, categoryId: current.categoryId },
        after: { status: "PENDING_REVIEW", source: "SELLER_SELF_SERVICE", nameEn: product.nameEn, categoryId: product.categoryId },
      },
    });
    return product;
  });
}

// ─── ARCHIVE AND RESTORE ─────────────────────────────────────────────────────
//
// `Product.deletedAt` was read by every catalogue query in the codebase and
// written by nothing: a seller could create and edit a listing but never remove
// one. A SKU typed wrong, a line that was discontinued, a product uploaded to
// the wrong account — all of it stayed in the catalogue for good, and the only
// approximation available was pausing the listing, which is a different
// statement ("temporarily not for sale") stored in a different column.
//
// Archiving is a SOFT delete on purpose, and must stay one. Order lines, quotes,
// commissions and payout items all point at Product rows; a hard delete would
// either fail on those foreign keys or, worse, take the history with it. Setting
// deletedAt removes the listing from every catalogue, search and seller list —
// they all already filter on it — while every past order still resolves what was
// bought.

/** Why an archive attempt was refused. The UI names the blocker; it never guesses. */
export type ArchiveBlockedReason = "RESERVED_STOCK" | "OPEN_ORDER_LINES";

export class ProductArchiveBlockedError extends Error {
  readonly reason: ArchiveBlockedReason;
  /** Units reserved, or open lines, depending on the reason. */
  readonly count: number;

  constructor(reason: ArchiveBlockedReason, count: number) {
    super(
      reason === "RESERVED_STOCK"
        ? `This listing has ${count} unit${count === 1 ? "" : "s"} of stock reserved against open orders. Fulfil or release them before archiving it.`
        : `This listing has ${count} order line${count === 1 ? "" : "s"} still to fulfil. Complete or cancel them before archiving it.`,
    );
    this.name = "ProductArchiveBlockedError";
    this.reason = reason;
    this.count = count;
  }
}

/**
 * Order-line states that still owe a buyer something from this listing.
 *
 * Everything up to and including PROCESSING: the seller has not handed the goods
 * over yet. SHIPPED and later are on their way and no longer depend on the
 * listing being visible, and CANCELLED / REFUNDED owe nothing.
 */
const OPEN_ORDER_ITEM_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_CONFIRMED",
  "CONFIRMED",
  "PROCESSING",
];

/**
 * Archive one of the seller's own listings.
 *
 * Refuses while the listing still owes anybody something. Reserved stock is
 * inventory checkout has already promised to a buyer, and an open order line is
 * a commitment the seller has not discharged; archiving out from under either
 * would leave a reservation pointing at a listing that no longer appears
 * anywhere its owner can see it. Both are stated with their counts so the seller
 * knows what to clear rather than being told "no".
 */
export async function archiveSellerListing(input: { productId: string; sellerId: string; actorId: string }) {
  return db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, input.actorId, input.sellerId, "catalog.manage");
    await lockProductCommercialRows(tx, [input.productId]);

    const current = await tx.product.findFirst({
      where: { id: input.productId, sellerId: input.sellerId, deletedAt: null },
      select: { id: true, status: true, sku: true, nameEn: true },
    });
    if (!current) throw new Error("Product not found in this seller account");

    const reserved = await tx.inventoryStock.aggregate({
      where: { productId: current.id },
      _sum: { reservedQty: true },
    });
    const reservedQty = reserved._sum.reservedQty ?? 0;
    if (reservedQty > 0) throw new ProductArchiveBlockedError("RESERVED_STOCK", reservedQty);

    const openLines = await tx.orderItem.count({
      where: { productId: current.id, status: { in: OPEN_ORDER_ITEM_STATUSES } },
    });
    if (openLines > 0) throw new ProductArchiveBlockedError("OPEN_ORDER_LINES", openLines);

    const archivedAt = new Date();
    // Compare-and-set on deletedAt: two archive clicks from two tabs must
    // produce one archive and one honest "already archived", not two audit rows
    // claiming the listing was removed twice.
    const applied = await tx.product.updateMany({
      where: { id: current.id, sellerId: input.sellerId, deletedAt: null },
      data: { deletedAt: archivedAt },
    });
    if (applied.count !== 1) throw new Error("Product not found in this seller account");

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: input.sellerId,
        entityType: "Product",
        entityId: current.id,
        action: AuditAction.DELETE,
        before: { status: current.status, sku: current.sku, nameEn: current.nameEn, deletedAt: null },
        after: { archived: true, deletedAt: archivedAt.toISOString(), source: "SELLER_SELF_SERVICE" },
      },
    });

    return { productId: current.id, archivedAt };
  });
}

/**
 * Put an archived listing back.
 *
 * An archive nobody can undo is a delete with a softer name, and a seller who
 * archives the wrong SKU would have to re-key the whole listing — the SKU
 * included, which is unique across the marketplace and still held by the
 * archived row. It returns as a DRAFT rather than to whatever status it had:
 * the catalogue moved on while it was gone, so it is re-published deliberately
 * through the same review the listing went through the first time, never
 * restored straight back into the storefront.
 */
export async function restoreSellerListing(input: { productId: string; sellerId: string; actorId: string }) {
  return db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, input.actorId, input.sellerId, "catalog.manage");
    await lockProductCommercialRows(tx, [input.productId]);

    const current = await tx.product.findFirst({
      where: { id: input.productId, sellerId: input.sellerId, deletedAt: { not: null } },
      select: { id: true, status: true, sku: true, deletedAt: true },
    });
    if (!current) throw new Error("Archived product not found in this seller account");

    const applied = await tx.product.updateMany({
      where: { id: current.id, sellerId: input.sellerId, deletedAt: { not: null } },
      data: { deletedAt: null, status: "DRAFT" },
    });
    if (applied.count !== 1) throw new Error("Archived product not found in this seller account");

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: input.sellerId,
        entityType: "Product",
        entityId: current.id,
        action: AuditAction.UPDATE,
        before: { archived: true, deletedAt: current.deletedAt?.toISOString() ?? null, status: current.status },
        after: { archived: false, deletedAt: null, status: "DRAFT", source: "SELLER_SELF_SERVICE" },
      },
    });

    return { productId: current.id, status: "DRAFT" as const };
  });
}
