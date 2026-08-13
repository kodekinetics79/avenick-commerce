import { PrismaClient, ProductIssueType, ProductStatus, SellerStatus, SellerTier, SellerType, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { extname, resolve } from "node:path";

const db = new PrismaClient();

type PilotAssetSet = { images?: string[]; documents?: string[] };

type PilotCatalogRecord = {
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

type PilotCatalogFile = {
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

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 90) || "item";

const asPositiveInt = (value: unknown, fallback: number) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.round(n)) : fallback;
};

const asNonNegativeInt = (value: unknown) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

const cleanString = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s && !["#N/A", "N/A", "-"].includes(s.toUpperCase()) ? s : undefined;
};

function sourceFingerprint(row: PilotCatalogRecord) {
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
    .slice(0, 16);
}

function sourceTags(row: PilotCatalogRecord): string[] {
  // Product.tags is used only for searchable pilot provenance until dedicated
  // industrial catalog metadata lands in the canonical schema. Every value is
  // prefixed so it can be distinguished from merchandising tags and migrated.
  const pairs: Array<[string, unknown]> = [
    ["source", row.sourceSheet],
    ["source-row", row.sourceRow],
    ["source-fingerprint", sourceFingerprint(row)],
    ["erp", row.erpCode],
    ["part", row.partNumber ?? row.partNumberItem],
    ["external-item", row.externalItemNumber],
    ["uom", row.uom],
    ["lead-time", row.deliveryLeadTime],
    ["hs", row.hsCode],
    ["vendor-code", row.vendorCode],
    ["vendor", row.vendorLegalName],
    ["group", row.productGroup],
  ];
  return pairs
    .map(([k, v]) => (cleanString(v) ? `${k}:${cleanString(v)}` : null))
    .filter((x): x is string => Boolean(x));
}

async function loadCatalog(path: string): Promise<PilotCatalogFile> {
  const bytes = await readFile(path);
  const raw = extname(path).toLowerCase() === ".gz" ? gunzipSync(bytes) : bytes;
  const parsed = JSON.parse(raw.toString("utf8")) as PilotCatalogFile;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.records)) {
    throw new Error("Unsupported pilot catalog format; expected version 1 with a records array");
  }
  return parsed;
}

function validateCatalog(file: PilotCatalogFile) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const skus = new Set<string>();
  const counts = new Map<string, number>();

  for (const row of file.records) {
    if (!row.sku?.trim()) errors.push(`${row.sourceSheet}:${row.sourceRow} missing SKU`);
    if (!row.name?.trim()) errors.push(`${row.sourceSheet}:${row.sourceRow} missing product name`);
    if (!SELLERS[row.sellerKey]) errors.push(`${row.sourceSheet}:${row.sourceRow} unknown sellerKey ${row.sellerKey}`);
    if (skus.has(row.sku)) errors.push(`${row.sourceSheet}:${row.sourceRow} duplicate SKU ${row.sku}`);
    skus.add(row.sku);
    counts.set(row.sellerKey, (counts.get(row.sellerKey) ?? 0) + 1);
    if (!(Number(row.unitPriceSAR) > 0)) warnings.push(`${row.sku}: no verified SAR sales price; will remain DRAFT`);
  }

  return { errors, warnings, counts };
}

async function ensureSeller(sellerKey: string) {
  const config = SELLERS[sellerKey];
  if (!config) throw new Error(`Unsupported seller ${sellerKey}`);
  const email = `pilot.catalog+${sellerKey}@avenick.test`;
  const password = process.env.PILOT_TEST_PASSWORD?.trim();
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;

  const user = await db.user.upsert({
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

  const seller = await db.sellerProfile.upsert({
    where: { userId: user.id },
    update: {
      businessNameEn: config.name,
      status: SellerStatus.ACTIVE,
      tier: SellerTier.VERIFIED,
    },
    create: {
      userId: user.id,
      businessNameEn: config.name,
      businessNameAr: config.name,
      crNumber: `PILOT-CATALOG-${sellerKey.toUpperCase()}`,
      type: SellerType.DISTRIBUTOR,
      country: "SA",
      city: config.city,
      description: "Pilot seller created from the client-supplied industrial product catalog. Not a representation of a legal manufacturer account.",
      tier: SellerTier.VERIFIED,
      status: SellerStatus.ACTIVE,
      commissionRate: 5,
    },
  });

  const warehouse = await db.warehouse.upsert({
    where: { id: `pilot-wh-${sellerKey}` },
    update: { sellerId: seller.id, isActive: true },
    create: {
      id: `pilot-wh-${sellerKey}`,
      sellerId: seller.id,
      nameEn: `${config.name} Warehouse`,
      type: "SELLER",
      country: "SA",
      city: config.city,
    },
  });
  const location = await db.inventoryLocation.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "MAIN" } },
    update: { isActive: true },
    create: { warehouseId: warehouse.id, code: "MAIN", zone: "PILOT" },
  });

  return { seller, location };
}

async function ensureCategory(family: string | undefined, subcategory: string | undefined) {
  const familyName = family?.trim() || "Industrial Products";
  const familySlug = `pilot-${slugify(familyName)}`;
  const parent = await db.category.upsert({
    where: { slug: familySlug },
    update: { nameEn: familyName, isActive: true },
    create: { nameEn: familyName, nameAr: familyName, slug: familySlug, isActive: true },
  });

  const childName = subcategory?.trim() || "General";
  const childSlug = `${familySlug}-${slugify(childName)}`;
  return db.category.upsert({
    where: { slug: childSlug },
    update: { nameEn: childName, parentId: parent.id, isActive: true },
    create: { nameEn: childName, nameAr: childName, slug: childSlug, parentId: parent.id, isActive: true },
  });
}

async function ensureBrand(name: string | undefined) {
  const brandName = name?.trim() || "Unspecified";
  const slug = `pilot-${slugify(brandName)}`;
  return db.brand.upsert({
    where: { slug },
    update: { nameEn: brandName, isActive: true },
    create: { nameEn: brandName, nameAr: brandName, slug, isActive: true },
  });
}

async function upsertProduct(row: PilotCatalogRecord, sellerId: string, locationId: string, assetBaseUrl?: string) {
  const category = await ensureCategory(row.family ?? undefined, row.subcategory ?? undefined);
  const brand = await ensureBrand(row.brand ?? row.manufacturer ?? row.sourceSheet);
  const verifiedPrice = Number(row.unitPriceSAR) > 0 ? Number(row.unitPriceSAR) : null;
  const productStatus = verifiedPrice ? ProductStatus.ACTIVE : ProductStatus.DRAFT;
  const slug = `${slugify(row.sku)}-${sourceFingerprint(row).slice(0, 8)}`;
  const weight = Number(row.netWeightKg) > 0 ? Number(row.netWeightKg) : undefined;
  const moq = asPositiveInt(row.moqSales, 1);

  const product = await db.product.upsert({
    where: { sku: row.sku },
    update: {
      sellerId,
      categoryId: category.id,
      brandId: brand.id,
      slug,
      nameEn: row.name.trim(),
      nameAr: row.name.trim(), // explicit fallback; issue below prevents claiming verified Arabic content
      descriptionEn: row.description?.trim() || null,
      descriptionAr: null,
      status: productStatus,
      isB2BEnabled: true,
      isB2CEnabled: false,
      weight,
      dimensions: {
        cm: row.dimensionsCm ?? null,
        cbm: row.cbm ?? null,
        grossWeightKg: row.grossWeightKg ?? null,
      },
      tags: sourceTags(row),
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
      status: productStatus,
      isB2BEnabled: true,
      isB2CEnabled: false,
      weight,
      dimensions: {
        cm: row.dimensionsCm ?? null,
        cbm: row.cbm ?? null,
        grossWeightKg: row.grossWeightKg ?? null,
      },
      tags: sourceTags(row),
      moq,
      listingHealth: 0,
      publishedAt: verifiedPrice ? new Date() : null,
    },
  });

  // Importer owns only pilot B2B/SAR prices for PILOT-* SKUs.
  await db.productPrice.deleteMany({ where: { productId: product.id, type: "B2B", currency: "SAR" } });
  if (verifiedPrice) {
    await db.productPrice.create({
      data: {
        productId: product.id,
        type: "B2B",
        currency: "SAR",
        minQty: moq,
        price: verifiedPrice,
        vatRate: 15,
        isActive: true,
      },
    });
  }

  await db.productIssue.deleteMany({
    where: {
      productId: product.id,
      issueType: { in: [
        ProductIssueType.NO_PRICE,
        ProductIssueType.MISSING_ARABIC_TITLE,
        ProductIssueType.MISSING_ARABIC_DESCRIPTION,
      ] },
      resolvedAt: null,
    },
  });
  await db.productIssue.create({
    data: {
      productId: product.id,
      issueType: ProductIssueType.MISSING_ARABIC_TITLE,
      severity: "WARNING",
      message: "Client source did not include a verified Arabic title; English fallback is displayed until translation is reviewed.",
    },
  });
  if (!row.description) {
    await db.productIssue.create({
      data: {
        productId: product.id,
        issueType: ProductIssueType.MISSING_ENGLISH_DESCRIPTION,
        severity: "WARNING",
        message: "Source catalog did not include an English product description.",
      },
    });
  }
  if (!verifiedPrice) {
    await db.productIssue.create({
      data: {
        productId: product.id,
        issueType: ProductIssueType.NO_PRICE,
        severity: "ERROR",
        message: "No verified SAR sales price exists in the supplied source. Product remains DRAFT and cannot be ordered.",
      },
    });
  }

  // Stock truth: only import a quantity when the source actually contains one.
  // Missing stock never becomes invented inventory.
  await db.inventoryStock.deleteMany({ where: { productId: product.id, locationId } });
  if (row.stockAvailable !== null && row.stockAvailable !== undefined) {
    await db.inventoryStock.create({
      data: {
        productId: product.id,
        locationId,
        qty: asNonNegativeInt(row.stockAvailable),
        reservedQty: 0,
        reorderPoint: asNonNegativeInt(row.safetyStock),
      },
    });
  }

  // Media is attached only when the operator provides a real object-storage/base
  // URL. Otherwise the importer leaves images empty rather than creating broken
  // placeholder links.
  if (assetBaseUrl && row.assets?.images?.length) {
    await db.productImage.deleteMany({ where: { productId: product.id } });
    const base = assetBaseUrl.replace(/\/+$/, "");
    await db.productImage.createMany({
      data: row.assets.images.map((filename, index) => ({
        productId: product.id,
        url: `${base}/${encodeURIComponent(row.sellerKey)}/${encodeURIComponent(filename)}`,
        altEn: row.name,
        isPrimary: index === 0,
        sortOrder: index,
      })),
    });
  }

  return { product, verifiedPrice };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  if (!fileArg) throw new Error("Usage: pnpm db:import-pilot <catalog.json|catalog.json.gz> [--apply]");

  const path = resolve(process.cwd(), fileArg);
  const file = await loadCatalog(path);
  const validation = validateCatalog(file);
  console.log(`Catalog: ${file.records.length} rows from ${file.generatedFrom ?? "provided source"}`);
  console.log("Seller counts:", Object.fromEntries(validation.counts));
  console.log(`Rows without verified sales price: ${validation.warnings.length}`);

  if (validation.errors.length) {
    console.error(validation.errors.slice(0, 50).join("\n"));
    throw new Error(`Catalog validation failed with ${validation.errors.length} error(s)`);
  }
  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to write the catalog.");
    return;
  }
  if (process.env.PILOT_CATALOG_IMPORT !== "1") {
    throw new Error("Refusing write: set PILOT_CATALOG_IMPORT=1 for an explicit non-destructive pilot import");
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PILOT_CATALOG_IMPORT !== "1") {
    throw new Error("Refusing production import: set ALLOW_PILOT_CATALOG_IMPORT=1 only for the designated pilot database");
  }

  const sellerContexts = new Map<string, Awaited<ReturnType<typeof ensureSeller>>>();
  for (const key of new Set(file.records.map((r) => r.sellerKey))) {
    sellerContexts.set(key, await ensureSeller(key));
  }

  let active = 0;
  let draft = 0;
  let withSourceStock = 0;
  let withImages = 0;
  for (let i = 0; i < file.records.length; i++) {
    const row = file.records[i]!;
    const context = sellerContexts.get(row.sellerKey)!;
    const { verifiedPrice } = await upsertProduct(
      row,
      context.seller.id,
      context.location.id,
      process.env.PILOT_ASSET_BASE_URL?.trim(),
    );
    if (verifiedPrice) active += 1;
    else draft += 1;
    if (row.stockAvailable !== null && row.stockAvailable !== undefined) withSourceStock += 1;
    if (row.assets?.images?.length) withImages += 1;
    if ((i + 1) % 100 === 0 || i + 1 === file.records.length) {
      console.log(`Imported ${i + 1}/${file.records.length}`);
    }
  }

  console.log(JSON.stringify({
    imported: file.records.length,
    activeWithVerifiedPrice: active,
    draftMissingPrice: draft,
    rowsWithSourceStock: withSourceStock,
    rowsWithMappedImages: withImages,
    sellerAccounts: [...sellerContexts.keys()],
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
