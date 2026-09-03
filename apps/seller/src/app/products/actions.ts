"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  Prisma,
  db,
  generateProductIssues,
  lockInventoryStockRows,
  lockProductCommercialRows,
  refreshProductHealth,
  requireCurrentSellerActor,
  resolveTaxJurisdiction,
  type Country,
  type Currency,
  type PricingType,
  type ProductStatus,
} from "@avenick/database";
import { log } from "@avenick/observability";
import { slugify } from "@avenick/utils";
import { platformName } from "@avenick/utils/portal-config";
import { isKeyInUploadNamespace } from "@avenick/utils/browser-upload-policy";
import { isObjectStorageConfigured, objectPublicUrl } from "@avenick/utils/s3";
import { z } from "zod";
import { requireSellerPermission, requireSellerSession } from "@/lib/auth";
import { assertProductImportPermissions } from "@/lib/product-import-policy";
import {
  SELLER_BULK_STATUSES,
  bulkTransitionBlocker,
  type BulkStatus,
  type BulkStatusSkipReason as SellerBulkStatusSkipReason,
} from "@/lib/product-status-transitions";

// The seller-side status rule (which moves a seller may make, and why one is
// refused) lives in @/lib/product-status-transitions so it can be unit-tested:
// a "use server" module may only export async functions. The alias keeps the
// products table importing the skip reasons from here, as it always has.
export type BulkStatusSkipReason = SellerBulkStatusSkipReason;
const STATUSES = SELLER_BULK_STATUSES;

export interface BulkStatusResult {
  count: number;
  /** Rows selected but not changed, with the reason, so the UI never claims more than happened. */
  skipped: Array<{ id: string; reason: BulkStatusSkipReason }>;
}

/**
 * Bulk pause / resume (seller-scoped). Only acts on products that belong to
 * the calling seller — ids for other sellers are silently ignored — and only
 * on transitions the seller is allowed to make (see STATUSES). Everything
 * else is reported back as skipped rather than quietly applied.
 */
export async function bulkUpdateProductStatus(productIds: string[], status: BulkStatus): Promise<BulkStatusResult> {
  const { seller, userId } = await requireSellerPermission("catalog.manage");
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  if (productIds.length === 0) return { count: 0, skipped: [] };

  const res = await db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, userId, seller.id, "catalog.manage");
    const targets = await tx.product.findMany({
      where: { id: { in: productIds }, sellerId: seller.id, deletedAt: null },
      select: { id: true },
    });
    await lockProductCommercialRows(tx, targets.map((target) => target.id));
    // Re-read under the fence: the status decided on is the status acted on.
    const currentTargets = await tx.product.findMany({
      where: { id: { in: targets.map((target) => target.id) }, sellerId: seller.id, deletedAt: null },
      select: { id: true, status: true, publishedAt: true },
    });
    const skipped: BulkStatusResult["skipped"] = [];
    const eligible: typeof currentTargets = [];
    for (const target of currentTargets) {
      const blocker = bulkTransitionBlocker(status, target);
      if (blocker) skipped.push({ id: target.id, reason: blocker });
      else eligible.push(target);
    }
    if (eligible.length === 0) return { count: 0, skipped };

    // Resuming keeps the original publishedAt: the listing was approved once,
    // and that date is the approval record, not the last un-pause.
    const updated = await tx.product.updateMany({
      where: { id: { in: eligible.map((target) => target.id) }, status: { in: eligible.map((t) => t.status) } },
      data: { status },
    });
    for (const target of eligible) {
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
    return { count: updated.count, skipped };
  });

  revalidatePath("/products");
  return res;
}

// ─── Listing health ──────────────────────────────────────────────────────────

/**
 * Recompute the derived listing-health score and the "Fix Your Products" queue
 * for products this request just wrote.
 *
 * Two deliberate properties:
 *  1. It runs AFTER the write transaction commits. refreshProductHealth and
 *     generateProductIssues open their own transactions on the shared client,
 *     so calling them from inside the write would have them wait on row locks
 *     the caller still holds — a self-deadlock, not a slow query.
 *  2. A failure here is logged, never rethrown. The catalog write already
 *     committed; turning a stale derived score into "your product was not
 *     saved" would be the bigger lie. The score is recomputed on the next write.
 */
async function refreshListingHealth(productIds: readonly string[]): Promise<void> {
  for (const productId of [...new Set(productIds)]) {
    try {
      await refreshProductHealth(productId);
      await generateProductIssues(productId);
    } catch (error) {
      log.error("listing health refresh failed", error, { scope: "products.actions", productId });
    }
  }
}

// ─── Statutory VAT ───────────────────────────────────────────────────────────

export type StatutoryVatRow = { currency: string; country: string; rate: number };

/** Every currency the schema knows about; only the priceable ones survive below. */
const CATALOG_CURRENCIES = ["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"] as const;

/**
 * The statutory VAT rate a price row in `currency` must carry.
 *
 * resolveTaxJurisdiction is checkout's own authority (packages/database/src/
 * services/orders.ts). Asking it with no shipping address returns the
 * currency's home jurisdiction — precisely the rate assertStatutoryVatRate
 * later demands of the price row. It throws for a currency with no home
 * jurisdiction (USD today); that refusal is the answer and is propagated, never
 * replaced with the schema's 5% column default, which is wrong in most of the GCC.
 */
function statutoryVatFor(currency: string): { country: string; rate: number } {
  const jurisdiction = resolveTaxJurisdiction(null, currency as Currency);
  return { country: jurisdiction.country, rate: jurisdiction.rate };
}

/**
 * The currencies a seller may actually price in, with the statutory rate that
 * will be stored for each. A currency whose rate cannot be established is
 * omitted rather than offered with a guessed rate — a price row carrying the
 * wrong rate makes the product unsellable at checkout, which is a far worse
 * outcome for the seller than not being able to choose that currency.
 */
export async function loadStatutoryVatTable(): Promise<StatutoryVatRow[]> {
  await requireSellerSession();
  const rows: StatutoryVatRow[] = [];
  for (const currency of CATALOG_CURRENCIES) {
    try {
      const { country, rate } = statutoryVatFor(currency);
      rows.push({ currency, country, rate });
    } catch {
      // No home VAT jurisdiction for this currency; it cannot be priced without
      // a delivery destination, so it is not offered.
    }
  }
  return rows;
}

// ─── Create / edit ───────────────────────────────────────────────────────────

export type ProductFormState = {
  ok?: boolean;
  productId?: string;
  error?: string;
  /** Keyed by form field path, e.g. "sku" or "prices.0.price". */
  fieldErrors?: Record<string, string>;
};

/** A validation failure the seller can fix in a specific field. */
class ProductFieldError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = "ProductFieldError";
  }
}

/** A refusal whose message is safe and useful to show the seller verbatim. */
class ProductConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductConflictError";
  }
}

/** Money never crosses the wire as a JS number; the string feeds Prisma.Decimal. */
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

const PriceRowSchema = z
  .object({
    /** Present for a stored row the seller is editing; absent for a new tier. */
    id: z.string().cuid().optional(),
    type: z.enum(["B2C", "B2B"]),
    currency: z.enum(CATALOG_CURRENCIES),
    price: z.string().trim().regex(MONEY_PATTERN, "Enter a price such as 199.00"),
    minQty: z.number().int().min(1).max(1_000_000),
    maxQty: z.number().int().min(1).max(1_000_000).nullable(),
  })
  .superRefine((row, ctx) => {
    if (row.maxQty !== null && row.maxQty < row.minQty) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxQty"], message: "Max quantity must be at least the min quantity" });
    }
    if (new Prisma.Decimal(row.price).lte(0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "Price must be greater than zero" });
    }
  });

/**
 * The only place a NEW image URL may point at is the object-storage namespace
 * that POST /api/uploads/presign writes into. The prefix is derived from the
 * same S3 configuration the presigner uses, so it is http://localhost:9000/…
 * against a local MinIO and https://… in production without either being
 * special-cased. Any other host is refused: a seller-supplied hotlink would be
 * a poison row — next/image throws for a host outside remotePatterns, which
 * takes the whole products list down, not just that card. When storage is not
 * configured no URL can have been minted, so none is accepted.
 */
function storedImageUrlPrefix(): string | null {
  return isObjectStorageConfigured() ? objectPublicUrl("") : null;
}

const ImageSchema = z.object({
  id: z.string().cuid().optional(),
  url: z.string().trim().url().max(2000),
  altEn: z.string().trim().max(200).nullable(),
});

function assertNewImageUrl(url: string, index: number, sellerId: string): void {
  const prefix = storedImageUrlPrefix();
  if (prefix === null) {
    throw new ProductFieldError(`images.${index}.url`, "Image storage is not configured, so no image can be attached to this listing.");
  }
  // Host AND namespace: the URL must resolve to a key the presigner would have
  // issued to THIS seller for a product image. Another seller's image, a
  // private document, or a hand-built key under the right host are all refused.
  const key = url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
  if (!key || !isKeyInUploadNamespace(key, { kind: "seller", sellerId }, "product-image")) {
    throw new ProductFieldError(`images.${index}.url`, "Only images uploaded through this form can be attached to a listing.");
  }
}

const ProductInputSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(3, "SKU must be at least 3 characters")
      .max(50, "SKU must be 50 characters or fewer")
      .regex(/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/, "SKU may contain letters, digits and . _ / - and must start with a letter or digit"),
    nameEn: z.string().trim().min(2, "English name is required").max(200),
    /**
     * Genuinely optional. An absent translation is stored as the empty string
     * (Product.nameAr is NOT NULL) so listing health can report
     * MISSING_ARABIC_TITLE truthfully. It is never back-filled from nameEn — a
     * copy of the English string is not an Arabic name.
     */
    nameAr: z.string().trim().max(200),
    descriptionEn: z.string().trim().max(5000),
    descriptionAr: z.string().trim().max(5000),
    categoryId: z.string().cuid("Choose a category"),
    brandId: z.string().cuid().nullable(),
    origin: z.enum(["AE", "SA", "QA", "KW", "OM", "BH"]).nullable(),
    isB2CEnabled: z.boolean(),
    isB2BEnabled: z.boolean(),
    moq: z.number().int().min(1, "Minimum order quantity must be at least 1").max(1_000_000),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    images: z.array(ImageSchema).max(8),
    /** Absent — not empty — when the actor has no pricing capability. */
    prices: z.array(PriceRowSchema).max(12).optional(),
    /** Absent — not zero — when the actor has no inventory capability. */
    stockQty: z.number().int().min(0).max(10_000_000).optional(),
    /**
     * Edit only: the on-hand figure the form displayed when it was opened
     * (null when it showed no stock row). updateProduct compares it with the
     * live row before writing, so a prefilled number saved after a fulfilment
     * moved the stock is refused instead of quietly restoring the older figure.
     */
    stockQtyAsLoaded: z.number().int().min(0).max(10_000_000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.isB2CEnabled && !value.isB2BEnabled) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["isB2BEnabled"], message: "Enable at least one sales channel." });
    }
    if (!value.prices) return;
    const seenIds = new Set<string>();
    value.prices.forEach((row, index) => {
      if (row.id) {
        if (seenIds.has(row.id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["prices", index, "price"], message: "This price row was submitted twice." });
        }
        seenIds.add(row.id);
      }
      // A price on a channel the listing does not sell through is a price no
      // buyer can ever be quoted. Refuse it rather than store dead data.
      if (row.type === "B2C" && !value.isB2CEnabled) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["prices", index, "type"], message: "Enable the B2C channel or remove this B2C price." });
      }
      if (row.type === "B2B" && !value.isB2BEnabled) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["prices", index, "type"], message: "Enable the B2B channel or remove this B2B price." });
      }
    });
    // Several rows for one channel and currency are quantity tiers — the shape
    // the seed data and checkout's resolveUnitPrice already use. Their ranges
    // must not overlap: checkout picks the applicable tier with the highest
    // minQty, so an overlap would make the price for a quantity depend on which
    // row happened to win. A gap is allowed (it is a loud refusal at checkout,
    // not a wrong price), but each lower tier must end before the next begins.
    const groups = new Map<string, { index: number; minQty: number; maxQty: number | null }[]>();
    value.prices.forEach((row, index) => {
      const identity = `${row.type}:${row.currency}`;
      groups.set(identity, [...(groups.get(identity) ?? []), { index, minQty: row.minQty, maxQty: row.maxQty }]);
    });
    for (const [identity, rows] of groups) {
      const ordered = [...rows].sort((a, b) => a.minQty - b.minQty || a.index - b.index);
      for (let i = 1; i < ordered.length; i++) {
        const lower = ordered[i - 1]!;
        const upper = ordered[i]!;
        if (lower.minQty === upper.minQty || lower.maxQty === null || lower.maxQty >= upper.minQty) {
          const [type, currency] = identity.split(":");
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["prices", upper.index, "minQty"],
            message: `Overlaps the ${type} ${currency} tier that starts at ${lower.minQty}. Give that tier a max quantity below ${upper.minQty}, or remove one of them.`,
          });
        }
      }
    }
  });

export type ProductFormInput = z.infer<typeof ProductInputSchema>;

const CreateIntentSchema = z.enum(["SAVE_DRAFT", "SUBMIT_FOR_REVIEW"]);
const UpdateIntentSchema = z.enum(["SAVE", "SAVE_DRAFT", "SUBMIT_FOR_REVIEW"]);
type UpdateIntent = z.infer<typeof UpdateIntentSchema>;

type ResolvedPriceRow = {
  id?: string;
  type: PricingType;
  currency: Currency;
  price: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  minQty: number;
  maxQty: number | null;
  statutoryCountry: string;
};

/**
 * Attach the statutory VAT rate to each submitted price row.
 *
 * The rate is never taken from the form. ProductPrice.vatRate is what checkout
 * compares against the destination's statutory rate, and a seller who free-typed
 * it would be authoring a row that makes their own product unsellable.
 */
function resolvePriceRows(rows: NonNullable<ProductFormInput["prices"]>): ResolvedPriceRow[] {
  return rows.map((row, index) => {
    let jurisdiction: { country: string; rate: number };
    try {
      jurisdiction = statutoryVatFor(row.currency);
    } catch (error) {
      throw new ProductFieldError(`prices.${index}.currency`, (error as Error).message);
    }
    return {
      ...(row.id ? { id: row.id } : {}),
      type: row.type as PricingType,
      currency: row.currency as Currency,
      price: new Prisma.Decimal(row.price),
      vatRate: new Prisma.Decimal(jurisdiction.rate),
      minQty: row.minQty,
      maxQty: row.maxQty,
      statutoryCountry: jurisdiction.country,
    };
  });
}

/**
 * Field-sensitive capability set, mirroring requiredProductImportPermissions:
 * catalog staff may edit listing copy, but commercial price and physical stock
 * are separate grants. A payload that omits `prices`/`stockQty` asks for
 * neither, so it needs neither.
 */
function requiredCapabilities(input: ProductFormInput): string[] {
  const required = ["catalog.manage"];
  if (input.prices !== undefined) required.push("pricing.manage");
  if (input.stockQty !== undefined) required.push("inventory.manage");
  return required;
}

function missingCapabilities(granted: readonly string[], required: readonly string[]): string[] {
  if (granted.includes("*")) return [];
  return required.filter((capability) => !granted.includes(capability));
}

function fieldErrorsFrom(error: z.ZodError): ProductFormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Please correct the highlighted fields.", fieldErrors };
}

function uniqueViolationTargets(error: unknown): string[] {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return [];
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
}

/**
 * Map a thrown failure onto form state. Messages this module authored, and the
 * capability refusals raised by requireCurrentSellerActor, are shown verbatim
 * because they tell the seller what to do. Anything unrecognised is reported as
 * a failure with the detail sent to the log — never as a partial success.
 */
function failureState(error: unknown, fallback: string): ProductFormState {
  if (error instanceof ProductFieldError) return { error: error.message, fieldErrors: { [error.field]: error.message } };
  if (error instanceof ProductConflictError) return { error: error.message };
  if (error instanceof Error && (error.message.startsWith("Current seller") || error.message.startsWith("Seller permission required:"))) {
    return { error: error.message };
  }
  log.error("seller product write failed", error, { scope: "products.actions" });
  return { error: fallback };
}

/**
 * slugify() strips every non-Latin character, so an Arabic-only name or SKU can
 * reduce to nothing. Fall back to a stable literal rather than an empty slug.
 */
function baseProductSlug(nameEn: string, sku: string): string {
  const parts = [slugify(nameEn).slice(0, 60), slugify(sku).slice(0, 40)].filter((part) => part.length > 0);
  return parts.join("-") || "product";
}

function slugSuffix(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/**
 * Resolve the stock location new inventory is written to.
 *
 * There is no seller-facing warehouse UI yet, so a seller's first listing would
 * otherwise be unable to record opening stock at all. Nothing is invented here:
 * when the seller has no location, one is provisioned from their OWN registered
 * country and city — the same shape the pilot importer's ensureSellerAndLocation
 * uses. requireCurrentSellerActor holds the seller fence for the whole
 * transaction, so two concurrent first-product creates cannot both provision one.
 */
async function ensureSellerStockLocation(
  tx: Prisma.TransactionClient,
  seller: { id: string; businessNameEn: string; businessNameAr: string | null; country: Country; city: string },
): Promise<string> {
  const existing = await tx.inventoryLocation.findFirst({
    where: { isActive: true, warehouse: { sellerId: seller.id, isActive: true } },
    orderBy: [{ warehouse: { createdAt: "asc" } }, { code: "asc" }],
    select: { id: true },
  });
  if (existing) return existing.id;

  const warehouse = await tx.warehouse.create({
    data: {
      sellerId: seller.id,
      nameEn: `${seller.businessNameEn} — Main`,
      nameAr: seller.businessNameAr,
      type: "SELLER",
      country: seller.country,
      city: seller.city,
    },
    select: { id: true },
  });
  const location = await tx.inventoryLocation.create({
    data: { warehouseId: warehouse.id, code: "MAIN" },
    select: { id: true },
  });
  return location.id;
}

async function assertCatalogReferences(tx: Prisma.TransactionClient, categoryId: string, brandId: string | null): Promise<void> {
  const category = await tx.category.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true } });
  if (!category) throw new ProductFieldError("categoryId", "Choose an active category.");
  if (brandId) {
    const brand = await tx.brand.findFirst({ where: { id: brandId, isActive: true }, select: { id: true } });
    if (!brand) throw new ProductFieldError("brandId", "Choose an active brand, or leave the brand blank.");
  }
}

function auditPriceSnapshot(rows: readonly ResolvedPriceRow[]) {
  return rows.map((row) => ({
    type: row.type,
    currency: row.currency,
    price: row.price.toString(),
    vatRate: row.vatRate.toString(),
    statutoryCountry: row.statutoryCountry,
    minQty: row.minQty,
    maxQty: row.maxQty,
  }));
}

/**
 * Create a listing.
 *
 * A seller can never publish to the public storefront from here. DRAFT is their
 * own private working state; PENDING_REVIEW is the queue admin approval reads
 * (approveProduct in packages/database/src/services/admin.ts, which is what
 * sets ACTIVE and publishedAt). isPubliclyDiscoverable is not written by this
 * path at all — it is the admin's decision, not the supplier's.
 */
export async function createProduct(input: unknown, intent: unknown): Promise<ProductFormState> {
  const { seller, userId, membership } = await requireSellerPermission("catalog.manage");

  const parsedIntent = CreateIntentSchema.safeParse(intent);
  if (!parsedIntent.success) return { error: "Unknown save action." };
  const parsed = ProductInputSchema.safeParse(input);
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const data = parsed.data;

  const capabilities = requiredCapabilities(data);
  const missing = missingCapabilities(membership.permissions ?? [], capabilities);
  if (missing.length > 0) return { error: `Seller permission required: ${missing.join(" and ")}` };

  // Review is the gate to being sold, and an unpriced listing is not sellable.
  if (parsedIntent.data === "SUBMIT_FOR_REVIEW" && (data.prices?.length ?? 0) === 0) {
    return {
      error: "Add at least one price before submitting for review.",
      fieldErrors: { prices: "At least one price is required to submit for review. You can still save this as a draft." },
    };
  }

  let priceRows: ResolvedPriceRow[];
  try {
    priceRows = resolvePriceRows(data.prices ?? []);
  } catch (error) {
    return failureState(error, "Couldn't price this product.");
  }

  try {
    data.images.forEach((image, index) => assertNewImageUrl(image.url, index, seller.id));
  } catch (error) {
    return failureState(error, "Couldn't attach these images.");
  }

  const status: ProductStatus = parsedIntent.data === "SUBMIT_FOR_REVIEW" ? "PENDING_REVIEW" : "DRAFT";
  const baseSlug = baseProductSlug(data.nameEn, data.sku);
  let created: { id: string } | null = null;

  for (let attempt = 0; attempt < 4 && created === null; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${slugSuffix()}`;
    try {
      created = await db.$transaction(async (tx) => {
        // Locks the acting user and the seller organization for the whole
        // transaction and re-reads their live capability. The product row does
        // not exist yet, so the seller fence is what serialises two concurrent
        // creates of the same SKU and the first-ever stock location.
        await requireCurrentSellerActor(tx, userId, seller.id, capabilities);

        const duplicate = await tx.product.findFirst({
          where: { sku: data.sku, sellerId: seller.id, deletedAt: null },
          select: { id: true },
        });
        if (duplicate) throw new ProductFieldError("sku", `SKU "${data.sku}" already exists in your catalog.`);
        await assertCatalogReferences(tx, data.categoryId, data.brandId);

        const product = await tx.product.create({
          data: {
            // Tenancy comes from the session, never from the submitted form.
            sellerId: seller.id,
            categoryId: data.categoryId,
            brandId: data.brandId,
            sku: data.sku,
            slug,
            nameEn: data.nameEn,
            nameAr: data.nameAr,
            descriptionEn: data.descriptionEn || null,
            descriptionAr: data.descriptionAr || null,
            status,
            isB2CEnabled: data.isB2CEnabled,
            isB2BEnabled: data.isB2BEnabled,
            origin: data.origin,
            moq: data.moq,
            tags: data.tags,
            // isPubliclyDiscoverable and publishedAt are intentionally absent:
            // both belong to the admin approval path.
          },
          select: { id: true },
        });

        if (priceRows.length > 0) {
          await tx.productPrice.createMany({
            data: priceRows.map((row) => ({
              productId: product.id,
              type: row.type,
              currency: row.currency,
              price: row.price,
              vatRate: row.vatRate,
              minQty: row.minQty,
              maxQty: row.maxQty,
              isActive: true,
            })),
          });
        }

        if (data.images.length > 0) {
          await tx.productImage.createMany({
            data: data.images.map((image, index) => ({
              productId: product.id,
              url: image.url,
              altEn: image.altEn,
              isPrimary: index === 0,
              sortOrder: index,
            })),
          });
        }

        if (data.stockQty !== undefined && data.stockQty > 0) {
          const locationId = await ensureSellerStockLocation(tx, seller);
          const stock = await tx.inventoryStock.create({
            data: { productId: product.id, locationId, qty: data.stockQty },
            select: { id: true },
          });
          await tx.inventoryMovement.create({
            data: {
              stockId: stock.id,
              type: "IN",
              qty: data.stockQty,
              reference: `PRODUCT_CREATE:${data.sku}`,
              notes: "Opening stock recorded with the new listing",
              createdBy: userId,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: userId,
            sellerId: seller.id,
            entityType: "Product",
            entityId: product.id,
            action: AuditAction.CREATE,
            after: {
              source: "SELLER_PRODUCT_FORM",
              sku: data.sku,
              slug,
              status,
              nameEn: data.nameEn,
              // Record whether Arabic was supplied, not the text itself: the
              // audit trail is for who-changed-what, not a second copy of the
              // catalog.
              hasArabicName: data.nameAr.length > 0,
              categoryId: data.categoryId,
              brandId: data.brandId,
              isB2CEnabled: data.isB2CEnabled,
              isB2BEnabled: data.isB2BEnabled,
              moq: data.moq,
              prices: auditPriceSnapshot(priceRows),
              openingStock: data.stockQty ?? null,
              imageCount: data.images.length,
            },
          },
        });

        return product;
      });
    } catch (error) {
      const targets = uniqueViolationTargets(error);
      if (targets.includes("sku")) {
        return {
          error: "That SKU is already registered.",
          fieldErrors: {
            sku: `SKU "${data.sku}" is already registered on ${platformName()}. SKUs are unique across the whole marketplace — choose a different one.`,
          },
        };
      }
      // The slug is generated, not seller input, so a collision is retried with
      // a fresh suffix instead of being shown as a validation error.
      if (targets.includes("slug")) continue;
      return failureState(error, "Couldn't create the product. Nothing was saved.");
    }
  }

  if (created === null) {
    return { error: "Couldn't allocate a unique product URL for this listing. Please try again." };
  }

  await refreshListingHealth([created.id]);
  revalidatePath("/products");
  revalidatePath("/issues");
  return { ok: true, productId: created.id };
}

/**
 * Seller-side status transitions.
 *
 * A seller may move a listing between their own private states and the review
 * queue; they may never move it to ACTIVE, which only admin approval does. A
 * listing that is already live (or suppressed, or suspended by the platform)
 * keeps its status when its content is saved — silently pulling a selling
 * product back into review would take it off sale without being asked.
 */
const SELLER_WITHDRAWABLE_STATUSES = new Set<string>(["DRAFT", "PENDING_REVIEW", "REJECTED"]);

function resolveUpdateStatus(current: ProductStatus, intent: UpdateIntent): ProductStatus {
  if (intent === "SAVE") return current;
  if (!SELLER_WITHDRAWABLE_STATUSES.has(current)) {
    throw new ProductConflictError(
      `This listing is ${current.replace(/_/g, " ").toLowerCase()}, so saving it here cannot change its status. Use the product list's bulk actions instead.`,
    );
  }
  return intent === "SUBMIT_FOR_REVIEW" ? "PENDING_REVIEW" : "DRAFT";
}

/**
 * Edit an existing listing. Every read and write is scoped by the session's
 * sellerId, so a product id belonging to another seller resolves to nothing
 * rather than being trusted because the client sent it.
 */
export async function updateProduct(productId: unknown, input: unknown, intent: unknown): Promise<ProductFormState> {
  const { seller, userId, membership } = await requireSellerPermission("catalog.manage");

  const parsedId = z.string().cuid().safeParse(productId);
  if (!parsedId.success) return { error: "Unknown product." };
  const parsedIntent = UpdateIntentSchema.safeParse(intent);
  if (!parsedIntent.success) return { error: "Unknown save action." };
  const parsed = ProductInputSchema.safeParse(input);
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const data = parsed.data;
  const id = parsedId.data;

  const capabilities = requiredCapabilities(data);
  const missing = missingCapabilities(membership.permissions ?? [], capabilities);
  if (missing.length > 0) return { error: `Seller permission required: ${missing.join(" and ")}` };

  if (parsedIntent.data === "SUBMIT_FOR_REVIEW" && data.prices !== undefined && data.prices.length === 0) {
    return {
      error: "Add at least one price before submitting for review.",
      fieldErrors: { prices: "At least one price is required to submit for review." },
    };
  }

  let priceRows: ResolvedPriceRow[] | null;
  try {
    priceRows = data.prices === undefined ? null : resolvePriceRows(data.prices);
  } catch (error) {
    return failureState(error, "Couldn't price this product.");
  }

  try {
    await db.$transaction(async (tx) => {
      await requireCurrentSellerActor(tx, userId, seller.id, capabilities);
      await lockProductCommercialRows(tx, [id]);

      // Read under the fence, exactly as bulkUpdateProductStatus does: the row
      // that gets written must be the row that was decided on.
      const current = await tx.product.findFirst({
        where: { id, sellerId: seller.id, deletedAt: null },
        include: {
          // Variant-level prices and stock are a different identity that this
          // form does not manage, so they are neither read nor touched.
          prices: { where: { variantId: null } },
          images: { orderBy: { sortOrder: "asc" } },
          inventory: { where: { variantId: null } },
        },
      });
      if (!current) throw new ProductConflictError("That product is not in your catalog.");

      const nextStatus = resolveUpdateStatus(current.status, parsedIntent.data);
      await assertCatalogReferences(tx, data.categoryId, data.brandId);

      // A staff member without pricing.manage submits no `prices`, so the
      // pre-transaction "at least one price" check above cannot see the
      // catalog. Count the live rows — product-level or variant-level — so an
      // unpriced listing never reaches review through that gap.
      if (priceRows === null && parsedIntent.data === "SUBMIT_FOR_REVIEW") {
        const livePrices = await tx.productPrice.count({
          where: { isActive: true, OR: [{ productId: current.id }, { variant: { productId: current.id } }] },
        });
        if (livePrices === 0) {
          throw new ProductFieldError("prices", "This product has no active price. Someone with pricing access must add one before it can be submitted for review.");
        }
      }

      if (data.sku !== current.sku) {
        const duplicate = await tx.product.findFirst({
          where: { sku: data.sku, sellerId: seller.id, deletedAt: null, NOT: { id: current.id } },
          select: { id: true },
        });
        if (duplicate) throw new ProductFieldError("sku", `SKU "${data.sku}" already exists in your catalog.`);
      }

      const updated = await tx.product.updateMany({
        // Compare-and-set on the fields this decision was read from, so a
        // concurrent approval or bulk status change is never silently clobbered.
        where: { id: current.id, sellerId: seller.id, deletedAt: null, status: current.status, updatedAt: current.updatedAt },
        data: {
          categoryId: data.categoryId,
          brandId: data.brandId,
          sku: data.sku,
          nameEn: data.nameEn,
          nameAr: data.nameAr,
          descriptionEn: data.descriptionEn || null,
          descriptionAr: data.descriptionAr || null,
          status: nextStatus,
          isB2CEnabled: data.isB2CEnabled,
          isB2BEnabled: data.isB2BEnabled,
          origin: data.origin,
          moq: data.moq,
          tags: data.tags,
          // slug is deliberately not rewritten — it is a public URL identity
          // that outlives a name change. isPubliclyDiscoverable and publishedAt
          // stay with the admin approval path.
        },
      });
      if (updated.count !== 1) {
        throw new ProductConflictError("This product changed while you were editing it. Reload the page and try again.");
      }

      const beforePrices = current.prices
        .filter((row) => row.isActive)
        .map((row) => ({ type: row.type, currency: row.currency, price: row.price.toString(), vatRate: row.vatRate.toString(), minQty: row.minQty, maxQty: row.maxQty }));

      if (priceRows !== null) {
        const activePrices = current.prices.filter((row) => row.isActive);
        const activeById = new Map(activePrices.map((row) => [row.id, row]));
        // Rows are matched by id, never by channel+currency: a product may
        // legitimately carry several quantity tiers per channel (the seeded
        // catalog does), and matching on identity would either refuse them or
        // guess which tier a submitted row replaces.
        const keptRows = priceRows.filter((row): row is ResolvedPriceRow & { id: string } => Boolean(row.id && activeById.has(row.id)));
        const keptIds = new Set(keptRows.map((row) => row.id));
        // A removed row is deactivated rather than deleted, so the price an
        // audit entry or a past quote referred to stays readable. Removals go
        // first so the display-price uniqueness index never sees a kept row
        // moving into a slot that a removed row is still occupying.
        const removed = activePrices.filter((row) => !keptIds.has(row.id));
        if (removed.length > 0) {
          const deactivated = await tx.productPrice.updateMany({
            where: { id: { in: removed.map((row) => row.id) }, productId: current.id, isActive: true },
            data: { isActive: false },
          });
          if (deactivated.count !== removed.length) {
            throw new ProductConflictError("A price changed while you were editing it. Reload the page and try again.");
          }
        }
        // Kept rows are rewritten highest minQty first, so a tier that moves
        // up out of the display slot vacates it before a lower tier moves in.
        for (const row of [...keptRows].sort((a, b) => b.minQty - a.minQty)) {
          const existing = activeById.get(row.id)!;
          const changed = await tx.productPrice.updateMany({
            // Compare-and-set on everything the seller saw for this row.
            where: {
              id: row.id,
              productId: current.id,
              price: existing.price,
              vatRate: existing.vatRate,
              minQty: existing.minQty,
              maxQty: existing.maxQty,
              isActive: true,
            },
            data: { type: row.type, currency: row.currency, price: row.price, vatRate: row.vatRate, minQty: row.minQty, maxQty: row.maxQty },
          });
          if (changed.count !== 1) {
            throw new ProductConflictError("A price changed while you were editing it. Reload the page and try again.");
          }
        }
        // An id that is not one of this product's live rows is not trusted as
        // a row reference; the submitted values simply become a new row.
        const created = priceRows.filter((row) => !(row.id && keptIds.has(row.id)));
        if (created.length > 0) {
          await tx.productPrice.createMany({
            data: created.map((row) => ({
              productId: current.id,
              type: row.type,
              currency: row.currency,
              price: row.price,
              vatRate: row.vatRate,
              minQty: row.minQty,
              maxQty: row.maxQty,
              isActive: true,
            })),
          });
        }
      }

      const keptImageIds = new Set(data.images.map((image) => image.id).filter((value): value is string => Boolean(value)));
      const removedImages = current.images.filter((image) => !keptImageIds.has(image.id));
      if (removedImages.length > 0) {
        await tx.productImage.deleteMany({ where: { id: { in: removedImages.map((image) => image.id) }, productId: current.id } });
      }
      for (const [index, image] of data.images.entries()) {
        // An id that is not one of this product's own rows is treated as a new
        // image rather than trusted as a row reference.
        const owned = image.id ? current.images.some((existing) => existing.id === image.id) : false;
        if (owned && image.id) {
          // The stored url is the row's identity and is never rewritten from
          // the form; only caption and ordering are the seller's to change.
          await tx.productImage.update({
            where: { id: image.id, productId: current.id },
            data: { altEn: image.altEn, isPrimary: index === 0, sortOrder: index },
          });
        } else {
          assertNewImageUrl(image.url, index, seller.id);
          await tx.productImage.create({
            data: { productId: current.id, url: image.url, altEn: image.altEn, isPrimary: index === 0, sortOrder: index },
          });
        }
      }

      const beforeStock = current.inventory.length === 1 ? current.inventory[0]!.qty : null;
      if (data.stockQty !== undefined) {
        if (current.inventory.length > 1) {
          throw new ProductConflictError(
            "Stock for this product is split across more than one location, so it cannot be set from this form. The seller portal has no per-location stock adjustment yet.",
          );
        }
        // The form sends the figure it displayed alongside the new one. Without
        // it a save cannot be told apart from a stale prefill, and a stale
        // prefill written as an ADJUSTMENT would silently restore stock that
        // a fulfilment has since shipped — so the number is required.
        if (data.stockQtyAsLoaded === undefined) {
          throw new ProductFieldError("stockQty", "The stock figure this edit started from is missing. Reload the page and set the quantity again.");
        }
        const existingStock = current.inventory[0];
        if (existingStock) {
          await lockInventoryStockRows(tx, [existingStock.id]);
          const currentStock = await tx.inventoryStock.findUniqueOrThrow({ where: { id: existingStock.id } });
          if (data.stockQtyAsLoaded === null || currentStock.qty !== data.stockQtyAsLoaded) {
            throw new ProductConflictError(
              `On-hand stock changed from ${data.stockQtyAsLoaded ?? "none"} to ${currentStock.qty} while you were editing. Reload the page and set the quantity again.`,
            );
          }
          if (currentStock.qty !== data.stockQty) {
            // The conditional write closes the race with checkout reservations:
            // on-hand stock can never be set below what is already reserved.
            const changed = await tx.inventoryStock.updateMany({
              where: { id: currentStock.id, qty: currentStock.qty, reservedQty: { lte: data.stockQty } },
              data: { qty: data.stockQty },
            });
            if (changed.count !== 1) {
              throw new ProductConflictError("Stock quantity cannot be below the quantity already reserved by open orders.");
            }
            await tx.inventoryMovement.create({
              data: {
                stockId: currentStock.id,
                type: "ADJUSTMENT",
                qty: data.stockQty,
                reference: `PRODUCT_EDIT:${current.sku}`,
                notes: `On-hand quantity set from the product form (was ${currentStock.qty})`,
                createdBy: userId,
              },
            });
          }
        } else if (data.stockQtyAsLoaded !== null) {
          // The form showed a stock figure that no longer exists.
          throw new ProductConflictError("The stock record this edit started from no longer exists. Reload the page and set the quantity again.");
        } else if (data.stockQty > 0) {
          const locationId = await ensureSellerStockLocation(tx, seller);
          const stock = await tx.inventoryStock.create({
            data: { productId: current.id, locationId, qty: data.stockQty },
            select: { id: true },
          });
          await tx.inventoryMovement.create({
            data: {
              stockId: stock.id,
              type: "IN",
              qty: data.stockQty,
              reference: `PRODUCT_EDIT:${current.sku}`,
              notes: "First stock recorded from the product form",
              createdBy: userId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          sellerId: seller.id,
          entityType: "Product",
          entityId: current.id,
          action: nextStatus === current.status ? AuditAction.UPDATE : AuditAction.STATUS_CHANGE,
          before: {
            sku: current.sku,
            status: current.status,
            nameEn: current.nameEn,
            hasArabicName: current.nameAr.trim().length > 0,
            categoryId: current.categoryId,
            brandId: current.brandId,
            isB2CEnabled: current.isB2CEnabled,
            isB2BEnabled: current.isB2BEnabled,
            moq: current.moq,
            prices: beforePrices,
            stock: beforeStock,
            imageCount: current.images.length,
          },
          after: {
            source: "SELLER_PRODUCT_FORM",
            sku: data.sku,
            status: nextStatus,
            nameEn: data.nameEn,
            hasArabicName: data.nameAr.length > 0,
            categoryId: data.categoryId,
            brandId: data.brandId,
            isB2CEnabled: data.isB2CEnabled,
            isB2BEnabled: data.isB2BEnabled,
            moq: data.moq,
            prices: priceRows === null ? "UNCHANGED" : auditPriceSnapshot(priceRows),
            stock: data.stockQty ?? "UNCHANGED",
            imageCount: data.images.length,
          },
        },
      });
    });
  } catch (error) {
    if (uniqueViolationTargets(error).includes("sku")) {
      return {
        error: "That SKU is already registered.",
        fieldErrors: {
          sku: `SKU "${data.sku}" is already registered on ${platformName()}. SKUs are unique across the whole marketplace — choose a different one.`,
        },
      };
    }
    if (uniqueViolationTargets(error).length > 0) {
      // The only other unique constraint these writes can hit is the display-
      // price index (one active row per channel and currency covering qty 1).
      // It fires when two submitted tiers both cover quantity 1 in a way the
      // overlap check did not catch, or a concurrent writer added one.
      return {
        error: "These prices could not be saved. Nothing was changed.",
        fieldErrors: { prices: "Two active prices would both apply to a single unit in the same channel and currency. Reload the page and check the tiers." },
      };
    }
    return failureState(error, "Couldn't save this product. Nothing was changed.");
  }

  await refreshListingHealth([id]);
  revalidatePath("/products");
  revalidatePath("/issues");
  revalidatePath(`/products/${id}/edit`);
  return { ok: true, productId: id };
}

// ─── CSV import ──────────────────────────────────────────────────────────────

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
 * Why a CSV status cell was not applied, in the seller's words. Mirrors the
 * products table's skip labels for the bulk action: the two paths obey one
 * rule (bulkTransitionBlocker), so they must explain a refusal the same way.
 */
const IMPORT_STATUS_REFUSALS: Record<BulkStatusSkipReason, () => string> = {
  NOT_APPROVED_YET: () => "status not changed: it is not yet approved — submit it for review from the product form",
  PLATFORM_SUPPRESSED: () => `status not changed: it was suppressed or suspended by ${platformName()} — contact support`,
  ALREADY_IN_STATUS: () => "status not changed: it is already in that status",
  NOT_PAUSABLE: () => "status not changed: it is not live, so there is nothing to pause",
};

/**
 * How much of a cell is echoed back in a refusal or an audit row: enough to
 * recognise the value, never the whole cell. A spreadsheet is seller input of
 * unbounded size, and neither the report nor the audit log may grow with it.
 */
const IMPORT_CELL_ECHO_MAX = 40;
function echoCell(cell: string): string {
  return cell.length > IMPORT_CELL_ECHO_MAX ? `${cell.slice(0, IMPORT_CELL_ECHO_MAX)}…` : cell;
}

/**
 * Cell rules. Each one is the product form's rule for the same field
 * (ProductInputSchema, PriceRowSchema) so a value the form refuses cannot land
 * through a spreadsheet instead: names carry the same length bounds, a price is
 * the same money string that feeds Prisma.Decimal (never a JS number that
 * rounds, never zero), and stock is a whole number under the same ceiling. A
 * cell that fails is reported, not dropped — the seller who typed it must be
 * told it did not land.
 */
const ImportNameEnCell = z.string().trim().min(2, "must be at least 2 characters").max(200, "must be 200 characters or fewer");
const ImportNameArCell = z.string().trim().max(200, "must be 200 characters or fewer");
const ImportPriceCell = z
  .string()
  .trim()
  .regex(MONEY_PATTERN, "enter an amount such as 199.00")
  .refine((cell) => new Prisma.Decimal(cell).gt(0), "must be greater than zero");
const ImportStockCell = z
  .string()
  .trim()
  .regex(/^\d{1,8}$/, "enter a whole number of units")
  .transform(Number)
  .pipe(z.number().int().min(0).max(10_000_000, "must be 10,000,000 or fewer"));

/** The first reason a cell was refused, as one line for the import report. */
function cellRefusal(
  field: string,
  cell: string,
  parsed: { success: true } | { success: false; error: { issues: ReadonlyArray<{ message: string }> } },
): string | null {
  if (parsed.success) return null;
  return `${field} not changed: "${echoCell(cell)}" — ${parsed.error.issues[0]?.message ?? "invalid"}`;
}

/**
 * The line the seller sees for a row that failed. Refusals this module
 * authored and the capability refusals raised by requireCurrentSellerActor
 * tell the seller what to do and are shown as written. Anything else — a
 * driver error, a row that vanished mid-import — is logged with the detail
 * and reported as a failure, never echoed: a database message is not a
 * sentence for a seller, and it may carry query text.
 */
function importRowFailure(error: unknown, productId: string): string {
  if (error instanceof ProductConflictError) return error.message;
  if (error instanceof Error && (error.message.startsWith("Current seller") || error.message.startsWith("Seller permission required:"))) {
    return error.message;
  }
  log.error("seller csv import row failed", error, { scope: "products.actions.import", productId });
  return "could not be imported; nothing on this row was changed";
}

/**
 * Decide the status cell against the row as it is under the fence. A cell
 * equal to the current status is a no-op, not an error — an exported CSV
 * carries every product's real status, and re-importing it after editing
 * names must not shout about rows that did not ask to move. Anything else
 * goes through the same rule as the bulk action, so a CSV can neither
 * resurrect an admin-suppressed listing nor activate one that was never
 * approved; a refusal is returned as a sentence for the import report.
 */
function importStatusDecision(
  requested: string | undefined,
  product: { status: ProductStatus; publishedAt: Date | null },
): { status?: BulkStatus; refusal?: string } {
  if (!requested || requested === product.status) return {};
  if (!(STATUSES as readonly string[]).includes(requested)) {
    return { refusal: `status not changed: a CSV can only set ${STATUSES.join(" or ")}; "${echoCell(requested)}" is set from the product form or by ${platformName()}` };
  }
  const target = requested as BulkStatus;
  const blocker = bulkTransitionBlocker(target, product);
  return blocker ? { refusal: IMPORT_STATUS_REFUSALS[blocker]() } : { status: target };
}

/**
 * CSV-driven bulk update. Matches existing products by SKU within the seller's
 * own catalog and updates name/status/price/stock where provided. Unknown SKUs
 * are reported back rather than silently creating products — keeps the seller's
 * catalog authoritative and avoids accidental duplicates. A cell the seller may
 * not apply — a status move the rule refuses, a value the product form would
 * refuse — is reported in `errors` while the row's other cells still land; it
 * is never dropped silently, and a row that asked for nothing is counted as
 * skipped rather than as an update that did not happen.
 */
export async function importProductsCsv(rows: ImportRow[], options: {
  /** Deterministic seams for PostgreSQL capability-revocation regressions. */
  afterSessionCheck?: () => Promise<void>;
  afterActorLock?: () => Promise<void>;
} = {}): Promise<ImportResult> {
  const { seller, userId, membership } = await requireSellerSession();
  const result: ImportResult = { updated: 0, skipped: 0, errors: [] };
  const touchedProductIds: string[] = [];

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

    // Cells are judged before the transaction opens: their rules do not depend
    // on the row, and a refused cell must not cost a lock. The status cell is
    // the exception — its rule needs the row as it is under the fence.
    const refusals: string[] = [];
    const nameEnCell = row.nameEn?.trim() ?? "";
    const nameArCell = row.nameAr?.trim() ?? "";
    const priceCell = row.price?.trim() ?? "";
    const stockCell = row.stock?.trim() ?? "";
    const nameEn = nameEnCell ? ImportNameEnCell.safeParse(nameEnCell) : null;
    const nameAr = nameArCell ? ImportNameArCell.safeParse(nameArCell) : null;
    const price = priceCell ? ImportPriceCell.safeParse(priceCell) : null;
    const stock = stockCell ? ImportStockCell.safeParse(stockCell) : null;
    for (const [field, cell, parsed] of [
      ["English name", nameEnCell, nameEn],
      ["Arabic name", nameArCell, nameAr],
      ["price", priceCell, price],
      ["stock", stockCell, stock],
    ] as const) {
      const refusal = parsed ? cellRefusal(field, cell, parsed) : null;
      if (refusal) refusals.push(refusal);
    }
    const requestedStatus = row.status?.trim().toUpperCase() || undefined;

    try {
      const outcome = await db.$transaction(async (tx) => {
        const required = ["catalog.manage"];
        if (priceCell) required.push("pricing.manage");
        if (stockCell) required.push("inventory.manage");
        await requireCurrentSellerActor(tx, userId, seller.id, required);
        await options.afterActorLock?.();
        await lockProductCommercialRows(tx, [product.id]);
        const currentProduct = await tx.product.findFirstOrThrow({
          where: { id: product.id, sellerId: seller.id, deletedAt: null },
          include: { prices: { where: { isActive: true } }, inventory: true },
        });

        // The status cell is judged against the row read under the fence, so
        // an admin decision that landed after the CSV was exported is what the
        // rule sees, not what the spreadsheet remembers.
        const data: { nameEn?: string; nameAr?: string; status?: BulkStatus } = {};
        if (nameEn?.success) data.nameEn = nameEn.data;
        if (nameAr?.success) data.nameAr = nameAr.data;
        const decision = importStatusDecision(requestedStatus, currentProduct);
        if (decision.status) data.status = decision.status;
        if (decision.refusal) refusals.push(decision.refusal);

        if (Object.keys(data).length > 0) {
          // Compare-and-set on the status the decision was made from, exactly
          // as the form and the bulk action do: an approval, rejection or
          // suppression that beat this write to the row is never overwritten
          // by a spreadsheet, it turns the row into a reload.
          const changed = await tx.product.updateMany({
            where: { id: currentProduct.id, sellerId: seller.id, deletedAt: null, status: currentProduct.status },
            data,
          });
          if (changed.count !== 1) {
            throw new ProductConflictError("This product changed while the import was running; export it again and retry");
          }
        }

        let priceApplied = false;
        let stockApplied = false;
        if (price?.success) {
          if (currentProduct.prices.length > 1) {
            throw new ProductConflictError("Price import is ambiguous across multiple active price identities");
          }
          const existing = currentProduct.prices[0];
          if (!existing) {
            // The CSV carries an amount but no currency or price type. Creating
            // a price row by assuming "B2C in AED" (what this branch used to do)
            // published a currency the seller never stated; refuse instead and
            // let the seller create the first price, with its currency, in the
            // product editor.
            throw new ProductConflictError("Price import requires an existing active price; set the first price and its currency in the product editor");
          }
          await tx.productPrice.update({ where: { id: existing.id }, data: { price: new Prisma.Decimal(price.data) } });
          priceApplied = true;
        }

        if (stock?.success) {
          if (currentProduct.inventory.length !== 1) {
            throw new ProductConflictError(
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
              reservedQty: { lte: stock.data },
            },
            data: { qty: stock.data },
          });
          if (changed.count !== 1) throw new ProductConflictError("Stock quantity cannot be below reserved quantity");
          stockApplied = true;
        }

        const applied = Object.keys(data).length > 0 || priceApplied || stockApplied;
        // A row that changed nothing and was refused nothing has no event to
        // record — an audit row claiming an UPDATE that did not happen would be
        // a fabrication. A refused cell IS recorded, against the row it was
        // refused on, so "I set it ACTIVE in the CSV" can be answered later.
        if (applied || refusals.length > 0) {
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
                price: currentProduct.prices.length === 1 ? currentProduct.prices[0]!.price.toString() : null,
                stock: currentProduct.inventory.length === 1 ? currentProduct.inventory[0]!.qty : null,
              },
              after: {
                source: "SELLER_CSV_IMPORT",
                fields: Object.keys(data),
                ...(priceApplied && price?.success ? { price: price.data } : {}),
                ...(stockApplied && stock?.success ? { stock: stock.data } : {}),
                ...(decision.refusal ? { statusRefused: { requested: echoCell(requestedStatus ?? ""), reason: decision.refusal } } : {}),
                ...(refusals.length > 0 ? { refused: refusals } : {}),
              },
            },
          });
        }
        return { applied };
      });
      if (outcome.applied) {
        result.updated++;
        touchedProductIds.push(product.id);
      } else {
        // Nothing about the product moved — every cell asked for was refused,
        // or none was asked for — so it is not counted as updated. A row that
        // asked for nothing says so, or the seller would see a skip with no
        // reason attached.
        result.skipped++;
        if (refusals.length === 0) result.errors.push(`SKU "${sku}": nothing to change — every cell after the SKU was empty or already matched`);
      }
    } catch (e) {
      result.skipped++;
      result.errors.push(`SKU "${sku}": ${importRowFailure(e, product.id)}`);
    }
    // A refused cell is a fact about the spreadsheet whether or not the rest
    // of the row landed, so it is reported either way.
    for (const refusal of refusals) result.errors.push(`SKU "${sku}": ${refusal}`);
  }

  if (result.updated > 0) {
    // Health and the "Fix Your Products" queue are derived from the committed
    // rows, so they are recomputed once the whole import has landed.
    await refreshListingHealth(touchedProductIds);
    revalidatePath("/products");
    revalidatePath("/issues");
  }
  return result;
}
