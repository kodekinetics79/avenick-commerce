import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import {
  AuditAction,
  ProductIssueType,
  ProductStatus,
  SellerStatus,
  SellerTier,
  SellerType,
  UserRole,
  UserStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "../client";
import { lockInventoryStockRows, lockPilotSellerKeys, lockProductCommercialRows, lockSellerCommercialRows, requireCurrentAdminActor } from "./checkout-invariants";

export type PilotAssetSet = { images?: string[]; documents?: string[] };

export type PilotCatalogRecord = {
  sourceSheet: string;
  sourceRow: number;
  sellerKey: string;
  brand?: string | null;
  manufacturer?: string | null;
  family?: string | null;
  subcategory?: string | null;
  name: string;
  description?: string | null;
  partNumberItem?: string | number | null;
  partNumber?: string | number | null;
  externalItemNumber?: string | number | null;
  filterElements?: string | number | null;
  erpCode?: string | number | null;
  sku: string;
  purchasePrice?: number | null;
  purchaseCurrency?: string | null;
  purchaseLandedCost?: number | null;
  unitPriceSAR?: number | null;
  perCarton?: number | null;
  perPallet?: number | null;
  stockAvailable?: number | null;
  uom?: string | null;
  safetyStock?: number | null;
  moqSales?: number | null;
  moqPurchase?: number | null;
  maxVolumeLeadTime?: string | number | null;
  deliveryLeadTime?: string | number | null;
  hsCode?: string | number | null;
  incoterms?: string | null;
  dimensionsCm?: { length?: number | null; width?: number | null; height?: number | null } | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  cbm?: number | null;
  priceValidity?: string | null;
  vendorCode?: string | number | null;
  vendorLegalName?: string | null;
  productGroup?: string | null;
  assetKey?: string | null;
  assets?: PilotAssetSet;
};

export type PilotCatalogFile = {
  version: number;
  generatedFrom?: string;
  purpose?: string;
  sellerKeys?: string[];
  records: PilotCatalogRecord[];
};

const SELLERS: Record<string, { name: string; city: string }> = {
  mennekes: { name: "Pilot Catalog — Mennekes", city: "Riyadh" },
  plymouth: { name: "Pilot Catalog — Plymouth", city: "Riyadh" },
  eaton: { name: "Pilot Catalog — Eaton", city: "Riyadh" },
  "bg-nexus": { name: "Pilot Catalog — BG Nexus", city: "Riyadh" },
  "3m": { name: "Pilot Catalog — 3M", city: "Riyadh" },
};

type CatalogClient = Prisma.TransactionClient;

const slugify = (value: string) =>
  value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 90) || "item";
const clean = (value: unknown) => {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text && !["#N/A", "N/A", "-"].includes(text.toUpperCase()) ? text : undefined;
};
const positiveInt = (value: unknown, fallback = 1) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.round(n)) : fallback;
};
const nonNegativeInt = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

export function pilotCatalogFingerprint(row: PilotCatalogRecord) {
  return createHash("sha256")
    .update(JSON.stringify({
      sheet: row.sourceSheet,
      row: row.sourceRow,
      sku: row.sku,
      erp: row.erpCode,
      part: row.partNumber ?? row.partNumberItem,
      price: row.unitPriceSAR,
      stock: row.stockAvailable,
    }))
    .digest("hex")
    .slice(0, 24);
}

export function validatePilotCatalog(file: PilotCatalogFile) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const skus = new Set<string>();
  const counts: Record<string, number> = {};
  let verifiedPriceRows = 0;
  let sourceStockRows = 0;
  let mediaMappedRows = 0;

  if (file?.version !== 1 || !Array.isArray(file.records)) {
    return { errors: ["Unsupported catalog format; expected version 1 with records[]"], warnings, counts, verifiedPriceRows, sourceStockRows, mediaMappedRows };
  }
  if (file.records.length > 20_000) errors.push("A single pilot import is limited to 20,000 product rows");

  for (const row of file.records) {
    if (!row.sourceSheet?.trim()) errors.push(`row ${row.sourceRow}: sourceSheet is required`);
    if (!Number.isInteger(row.sourceRow) || row.sourceRow < 1) errors.push(`${row.sourceSheet}: invalid source row`);
    if (!row.sku?.trim()) errors.push(`${row.sourceSheet}:${row.sourceRow} missing SKU`);
    if (!row.name?.trim()) errors.push(`${row.sourceSheet}:${row.sourceRow} missing product name`);
    if (!SELLERS[row.sellerKey]) errors.push(`${row.sourceSheet}:${row.sourceRow} unknown sellerKey ${row.sellerKey}`);
    if (skus.has(row.sku)) errors.push(`${row.sourceSheet}:${row.sourceRow} duplicate SKU ${row.sku}`);
    skus.add(row.sku);
    counts[row.sellerKey] = (counts[row.sellerKey] ?? 0) + 1;
    if (Number(row.unitPriceSAR) > 0) verifiedPriceRows += 1;
    else warnings.push(`${row.sku}: no verified SAR sales price; will remain DRAFT`);
    if (row.stockAvailable != null && Number.isFinite(Number(row.stockAvailable))) sourceStockRows += 1;
    if ((row.assets?.images?.length ?? 0) > 0 || (row.assets?.documents?.length ?? 0) > 0) mediaMappedRows += 1;
  }

  return { errors, warnings, counts, verifiedPriceRows, sourceStockRows, mediaMappedRows };
}

async function ensureSeller(client: CatalogClient, sellerKey: string, testPassword?: string) {
  const config = SELLERS[sellerKey];
  if (!config) throw new Error(`Unsupported seller ${sellerKey}`);
  const email = `pilot.catalog+${sellerKey}@avenick.test`;
  const passwordHash = testPassword ? await bcrypt.hash(testPassword, 12) : null;
  const user = await client.user.upsert({
    where: { email },
    update: {
      role: UserRole.SELLER_OWNER,
      status: UserStatus.ACTIVE,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email,
      passwordHash,
      firstName: "Pilot",
      lastName: config.name.replace("Pilot Catalog — ", ""),
      role: UserRole.SELLER_OWNER,
      status: UserStatus.ACTIVE,
      language: "EN",
    },
  });
  const seller = await client.sellerProfile.upsert({
    where: { userId: user.id },
    update: { businessNameEn: config.name, status: SellerStatus.ACTIVE, tier: SellerTier.VERIFIED },
    create: {
      userId: user.id,
      businessNameEn: config.name,
      businessNameAr: config.name,
      crNumber: `PILOT-CATALOG-${sellerKey.toUpperCase()}`,
      type: SellerType.DISTRIBUTOR,
      country: "SA",
      city: config.city,
      description: "Pilot seller created from client-supplied industrial catalog data. This is test data and is not a claim of manufacturer authorization.",
      tier: SellerTier.VERIFIED,
      status: SellerStatus.ACTIVE,
      commissionRate: 5,
    },
  });
  const warehouse = await client.warehouse.upsert({
    where: { id: `pilot-wh-${sellerKey}` },
    update: { sellerId: seller.id, isActive: true },
    create: { id: `pilot-wh-${sellerKey}`, sellerId: seller.id, nameEn: `${config.name} Warehouse`, type: "SELLER", country: "SA", city: config.city },
  });
  const location = await client.inventoryLocation.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "MAIN" } },
    update: { isActive: true },
    create: { warehouseId: warehouse.id, code: "MAIN", zone: "PILOT" },
  });
  return { seller, location };
}

async function ensureCategory(client: CatalogClient, family?: string | null, subcategory?: string | null) {
  const familyName = family?.trim() || "Industrial Products";
  const familySlug = `pilot-${slugify(familyName)}`;
  const parent = await client.category.upsert({
    where: { slug: familySlug },
    update: { nameEn: familyName, isActive: true },
    create: { nameEn: familyName, nameAr: familyName, slug: familySlug, isActive: true },
  });
  const childName = subcategory?.trim() || "General";
  const childSlug = `${familySlug}-${slugify(childName)}`;
  return client.category.upsert({
    where: { slug: childSlug },
    update: { nameEn: childName, parentId: parent.id, isActive: true },
    create: { nameEn: childName, nameAr: childName, slug: childSlug, parentId: parent.id, isActive: true },
  });
}

async function ensureBrand(client: CatalogClient, name?: string | null) {
  const brandName = name?.trim() || "Unspecified";
  const slug = `pilot-${slugify(brandName)}`;
  return client.brand.upsert({
    where: { slug },
    update: { nameEn: brandName, isActive: true },
    create: { nameEn: brandName, nameAr: brandName, slug, isActive: true },
  });
}

function commercialPayload(row: PilotCatalogRecord): Prisma.InputJsonValue {
  // Prisma distinguishes database-null sentinels from JSON null at the type
  // level. Round-tripping through JSON produces a plain, serializable JSON value
  // while preserving explicit nulls inside the source-evidence object.
  const payload = {
    filterElements: clean(row.filterElements) ?? null,
    maxVolumeLeadTime: clean(row.maxVolumeLeadTime) ?? null,
    dimensionsCm: row.dimensionsCm ?? null,
    netWeightKg: row.netWeightKg ?? null,
    grossWeightKg: row.grossWeightKg ?? null,
    cbm: row.cbm ?? null,
    priceValidity: row.priceValidity ?? null,
    assetKey: row.assetKey ?? null,
    assets: row.assets ?? null,
  };
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

async function upsertProduct(client: CatalogClient, row: PilotCatalogRecord, sellerId: string, locationId: string, assetBaseUrl?: string) {
  const category = await ensureCategory(client, row.family, row.subcategory);
  const brand = await ensureBrand(client, row.brand ?? row.manufacturer ?? row.sourceSheet);
  const verifiedPrice = Number(row.unitPriceSAR) > 0 ? Number(row.unitPriceSAR) : null;
  const status = verifiedPrice ? ProductStatus.ACTIVE : ProductStatus.DRAFT;
  const fingerprint = pilotCatalogFingerprint(row);
  const slug = `${slugify(row.sku)}-${fingerprint.slice(0, 8)}`;
  const moq = positiveInt(row.moqSales, 1);

  const product = await client.product.upsert({
    where: { sku: row.sku },
    update: {
      sellerId,
      categoryId: category.id,
      brandId: brand.id,
      slug,
      nameEn: row.name.trim(),
      nameAr: row.name.trim(),
      descriptionEn: row.description?.trim() || null,
      descriptionAr: null,
      status,
      isB2BEnabled: true,
      isB2CEnabled: false,
      weight: Number(row.netWeightKg) > 0 ? Number(row.netWeightKg) : undefined,
      dimensions: { cm: row.dimensionsCm ?? null, cbm: row.cbm ?? null, grossWeightKg: row.grossWeightKg ?? null },
      tags: ["pilot-catalog", `source:${slugify(row.sourceSheet)}`],
      moq,
      publishedAt: verifiedPrice ? new Date() : null,
      deletedAt: null,
    },
    create: {
      sellerId,
      categoryId: category.id,
      brandId: brand.id,
      sku: row.sku,
      slug,
      nameEn: row.name.trim(),
      nameAr: row.name.trim(),
      descriptionEn: row.description?.trim() || null,
      status,
      isB2BEnabled: true,
      isB2CEnabled: false,
      weight: Number(row.netWeightKg) > 0 ? Number(row.netWeightKg) : undefined,
      dimensions: { cm: row.dimensionsCm ?? null, cbm: row.cbm ?? null, grossWeightKg: row.grossWeightKg ?? null },
      tags: ["pilot-catalog", `source:${slugify(row.sourceSheet)}`],
      moq,
      listingHealth: 0,
      publishedAt: verifiedPrice ? new Date() : null,
    },
  });

  await client.productCommercialMetadata.upsert({
    where: { productId: product.id },
    update: {
      sourceSystem: "CLIENT_PILOT_CATALOG",
      sourceSheet: row.sourceSheet,
      sourceRow: row.sourceRow,
      erpCode: clean(row.erpCode),
      externalItemNumber: clean(row.externalItemNumber),
      manufacturerPartNumber: clean(row.partNumber ?? row.partNumberItem),
      supplierPartNumber: clean(row.partNumberItem),
      uom: clean(row.uom),
      moqPurchase: row.moqPurchase == null ? null : positiveInt(row.moqPurchase),
      leadTimeText: clean(row.deliveryLeadTime ?? row.maxVolumeLeadTime),
      hsCode: clean(row.hsCode),
      incoterms: clean(row.incoterms),
      purchasePrice: Number(row.purchasePrice) > 0 ? Number(row.purchasePrice) : null,
      purchaseCurrencyCode: clean(row.purchaseCurrency),
      landedCost: Number(row.purchaseLandedCost) > 0 ? Number(row.purchaseLandedCost) : null,
      packQty: row.perCarton == null ? null : positiveInt(row.perCarton),
      palletQty: row.perPallet == null ? null : positiveInt(row.perPallet),
      vendorCode: clean(row.vendorCode),
      vendorLegalName: clean(row.vendorLegalName),
      productGroup: clean(row.productGroup),
      sourcePayload: commercialPayload(row),
      sourceFingerprint: fingerprint,
      observedAt: new Date(),
    },
    create: {
      productId: product.id,
      sourceSystem: "CLIENT_PILOT_CATALOG",
      sourceSheet: row.sourceSheet,
      sourceRow: row.sourceRow,
      erpCode: clean(row.erpCode),
      externalItemNumber: clean(row.externalItemNumber),
      manufacturerPartNumber: clean(row.partNumber ?? row.partNumberItem),
      supplierPartNumber: clean(row.partNumberItem),
      uom: clean(row.uom),
      moqPurchase: row.moqPurchase == null ? null : positiveInt(row.moqPurchase),
      leadTimeText: clean(row.deliveryLeadTime ?? row.maxVolumeLeadTime),
      hsCode: clean(row.hsCode),
      incoterms: clean(row.incoterms),
      purchasePrice: Number(row.purchasePrice) > 0 ? Number(row.purchasePrice) : null,
      purchaseCurrencyCode: clean(row.purchaseCurrency),
      landedCost: Number(row.purchaseLandedCost) > 0 ? Number(row.purchaseLandedCost) : null,
      packQty: row.perCarton == null ? null : positiveInt(row.perCarton),
      palletQty: row.perPallet == null ? null : positiveInt(row.perPallet),
      vendorCode: clean(row.vendorCode),
      vendorLegalName: clean(row.vendorLegalName),
      productGroup: clean(row.productGroup),
      sourcePayload: commercialPayload(row),
      sourceFingerprint: fingerprint,
    },
  });

  await client.productPrice.deleteMany({ where: { productId: product.id, type: "B2B", currency: "SAR" } });
  if (verifiedPrice) {
    await client.productPrice.create({ data: { productId: product.id, type: "B2B", currency: "SAR", minQty: moq, price: verifiedPrice, vatRate: 15, isActive: true } });
  }

  await client.productIssue.deleteMany({
    where: {
      productId: product.id,
      issueType: { in: [ProductIssueType.NO_PRICE, ProductIssueType.MISSING_ARABIC_TITLE, ProductIssueType.MISSING_ENGLISH_DESCRIPTION] },
      resolvedAt: null,
    },
  });
  await client.productIssue.create({
    data: {
      productId: product.id,
      issueType: ProductIssueType.MISSING_ARABIC_TITLE,
      severity: "WARNING",
      message: "Client source did not include a verified Arabic title; English fallback is displayed until translation review.",
    },
  });
  if (!row.description?.trim()) {
    await client.productIssue.create({
      data: { productId: product.id, issueType: ProductIssueType.MISSING_ENGLISH_DESCRIPTION, severity: "WARNING", message: "Source catalog did not include an English product description." },
    });
  }
  if (!verifiedPrice) {
    await client.productIssue.create({
      data: { productId: product.id, issueType: ProductIssueType.NO_PRICE, severity: "ERROR", message: "No verified SAR sales price exists in the supplied source. Product remains DRAFT and cannot be ordered." },
    });
  }

  const initialStock = await client.inventoryStock.findMany({
    where: { productId: product.id, locationId },
    select: { id: true },
  });
  await lockInventoryStockRows(client, initialStock.map((stock) => stock.id));
  const currentStock = await client.inventoryStock.findMany({
    where: { productId: product.id, locationId },
    orderBy: { id: "asc" },
  });
  if (currentStock.length > 1 || currentStock.some((stock) => stock.variantId != null)) {
    throw new Error(`Catalog stock identity is ambiguous for SKU ${row.sku}`);
  }
  const existingStock = currentStock[0];
  const hasSourceStock = row.stockAvailable != null && Number.isFinite(Number(row.stockAvailable));
  const sourceQty = hasSourceStock ? nonNegativeInt(row.stockAvailable) : null;
  if (existingStock?.reservedQty && (sourceQty == null || sourceQty < existingStock.reservedQty)) {
    throw new Error(`Catalog stock for SKU ${row.sku} cannot be below reserved quantity`);
  }
  if (existingStock && sourceQty != null) {
    const changed = await client.inventoryStock.updateMany({
      where: {
        id: existingStock.id,
        qty: existingStock.qty,
        reservedQty: existingStock.reservedQty,
      },
      data: { qty: sourceQty, reorderPoint: nonNegativeInt(row.safetyStock) },
    });
    if (changed.count !== 1) throw new Error(`Catalog stock changed concurrently for SKU ${row.sku}`);
  } else if (existingStock) {
    await client.inventoryStock.delete({ where: { id: existingStock.id } });
  } else if (sourceQty != null) {
    await client.inventoryStock.create({
      data: { productId: product.id, locationId, qty: sourceQty, reservedQty: 0, reorderPoint: nonNegativeInt(row.safetyStock) },
    });
  }

  if (assetBaseUrl && row.assets?.images?.length) {
    await client.productImage.deleteMany({ where: { productId: product.id } });
    const base = assetBaseUrl.replace(/\/+$/, "");
    await client.productImage.createMany({
      data: row.assets.images.map((filename, index) => ({
        productId: product.id,
        url: `${base}/${encodeURIComponent(row.sellerKey)}/${encodeURIComponent(filename)}`,
        altEn: row.name,
        isPrimary: index === 0,
        sortOrder: index,
      })),
    });
  }
  return { active: Boolean(verifiedPrice), hasSourceStock: row.stockAvailable != null, hasMappedMedia: Boolean(row.assets?.images?.length || row.assets?.documents?.length) };
}

export async function applyPilotCatalog(file: PilotCatalogFile, options: {
  actorId?: string;
  assetBaseUrl?: string;
  testPassword?: string;
} = {}) {
  const validation = validatePilotCatalog(file);
  if (validation.errors.length) throw new Error(`Catalog validation failed: ${validation.errors.slice(0, 10).join("; ")}`);

  // One transaction makes the import all-or-nothing, including its audit row.
  // A generous explicit timeout is required for the bounded 20k-row pilot file.
  return db.$transaction(async (tx) => {
    if (options.actorId) await requireCurrentAdminActor(tx, options.actorId);
    const sellerKeys = [...new Set(file.records.map((row) => row.sellerKey))].sort();
    await lockPilotSellerKeys(tx, sellerKeys);

    // Every commercial transaction acquires the complete lock set once in the
    // global order: sellers, then products. This prevents checkout/import and
    // reversed multi-seller imports from deadlocking.
    const existingUsers = await tx.user.findMany({
      where: { email: { in: sellerKeys.map((key) => `pilot.catalog+${key}@avenick.test`) } },
      select: { sellerProfile: { select: { id: true } } },
    });
    const existingProductsForLocks = await tx.product.findMany({
      where: { sku: { in: file.records.map((row) => row.sku) } },
      select: { id: true },
    });
    await lockSellerCommercialRows(tx, existingUsers.flatMap((user) => user.sellerProfile ? [user.sellerProfile.id] : []));
    await lockProductCommercialRows(tx, existingProductsForLocks.map(({ id }) => id));

    const contexts = new Map<string, Awaited<ReturnType<typeof ensureSeller>>>();
    for (const key of sellerKeys) {
      contexts.set(key, await ensureSeller(tx, key, options.testPassword));
    }

    // SKU is globally unique. Re-import may update only a product previously
    // created by this importer for the same deterministic pilot seller; never
    // transfer another seller's catalog merely because an input SKU collides.
    const existing = await tx.product.findMany({
      where: { sku: { in: file.records.map((row) => row.sku) } },
      select: { sku: true, sellerId: true, commercialMetadata: { select: { sourceSystem: true } } },
    });
    const rowBySku = new Map(file.records.map((row) => [row.sku, row]));
    for (const product of existing) {
      const row = rowBySku.get(product.sku);
      const expectedSeller = row ? contexts.get(row.sellerKey)?.seller.id : undefined;
      if (
        !expectedSeller ||
        product.sellerId !== expectedSeller ||
        product.commercialMetadata?.sourceSystem !== "CLIENT_PILOT_CATALOG"
      ) {
        throw new Error(`Catalog SKU ${product.sku} already belongs to a non-pilot or different seller product`);
      }
    }

    let activeWithVerifiedPrice = 0;
    let draftMissingPrice = 0;
    let rowsWithSourceStock = 0;
    let rowsWithMappedMedia = 0;
    for (const row of file.records) {
      const context = contexts.get(row.sellerKey);
      if (!context) throw new Error(`Seller context missing for ${row.sellerKey}`);
      const applied = await upsertProduct(tx, row, context.seller.id, context.location.id, options.assetBaseUrl);
      if (applied.active) activeWithVerifiedPrice += 1;
      else draftMissingPrice += 1;
      if (applied.hasSourceStock) rowsWithSourceStock += 1;
      if (applied.hasMappedMedia) rowsWithMappedMedia += 1;
    }

    const result = {
      imported: file.records.length,
      activeWithVerifiedPrice,
      draftMissingPrice,
      rowsWithSourceStock,
      rowsWithMappedMedia,
      sellerKeys: [...contexts.keys()],
      source: file.generatedFrom ?? "client-supplied pilot catalog",
    };
    if (options.actorId) {
      const actor = await tx.user.findUniqueOrThrow({ where: { id: options.actorId }, select: { role: true } });
      await tx.auditLog.create({
        data: {
          actorId: options.actorId,
          entityType: "PilotCatalogImport",
          entityId: createHash("sha256").update(JSON.stringify(result)).digest("hex").slice(0, 24),
          action: AuditAction.CREATE,
          after: { ...result, actorRole: actor.role, tenantScope: "pilot-catalog" },
        },
      });
    }
    return result;
  }, { maxWait: 10_000, timeout: 15 * 60_000 });
}
