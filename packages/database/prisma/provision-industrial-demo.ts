import {
  AuditAction,
  CompanySize,
  CompanyStatus,
  Country,
  Currency,
  Industry,
  Language,
  PricingType,
  PrismaClient,
  ProductStatus,
  SellerStatus,
  SellerTier,
  SellerType,
  UserRole,
  UserStatus,
  WarehouseType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  INDUSTRIAL_DEMO_MENNEKES_PART_NUMBERS,
  fetchMennekesProduct,
  manufacturerDescription,
  reviewedEatonProducts,
} from "../src/services/demo-product-enrichment";
import {
  INDUSTRIAL_DEMO_CATEGORIES,
  INDUSTRIAL_DEMO_CURRENCY,
  INDUSTRIAL_DEMO_TAG,
  industrialDemoCategorySlug,
  industrialDemoCommercialFacts,
  industrialDemoSellerIndex,
  validateIndustrialDemoCatalog,
} from "../src/services/industrial-demo-catalog";

const prisma = new PrismaClient();

function configuration() {
  if (process.env.DEMO_ENVIRONMENT !== "certification" || process.env.DEMO_ALLOW_PROVISION !== "true") {
    throw new Error("Industrial demo provisioning requires certification environment and explicit opt-in");
  }
  const password = process.env.DEMO_PASSWORD;
  const expectedHost = process.env.DEMO_DATABASE_HOST;
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const runId = process.env.DEMO_RUN_ID?.trim().toLowerCase();
  if (!password || password.length < 16) throw new Error("DEMO_PASSWORD must be at least 16 characters");
  if (!expectedHost || !databaseUrl) throw new Error("DEMO_DATABASE_HOST and DIRECT_URL/DATABASE_URL are required");
  if (!runId || !/^[a-z0-9][a-z0-9-]{2,30}$/.test(runId)) throw new Error("DEMO_RUN_ID must be a stable lowercase identifier");
  const actual = new URL(databaseUrl);
  if (actual.hostname !== expectedHost || actual.hostname.includes("-pooler.")) {
    throw new Error("Industrial demo target must match the explicit unpooled certification host");
  }
  return { password, host: actual.hostname, runId };
}

async function main() {
  const { password, host, runId } = configuration();
  const catalog = validateIndustrialDemoCatalog();
  const passwordHash = await bcrypt.hash(password, 12);
  const sources = [
    ...(await Promise.all(INDUSTRIAL_DEMO_MENNEKES_PART_NUMBERS.map(fetchMennekesProduct))),
    ...reviewedEatonProducts(),
  ];

  const result = await prisma.$transaction(async (tx) => {
    const upsertUser = (email: string, firstName: string, lastName: string, role: UserRole) => tx.user.upsert({
      where: { email },
      update: { passwordHash, firstName, lastName, role, status: UserStatus.ACTIVE, deletedAt: null, language: Language.EN },
      create: { email, passwordHash, firstName, lastName, role, status: UserStatus.ACTIVE, language: Language.EN, emailVerified: new Date() },
    });
    const address = (role: string) => `demo-${runId}-${role}@avenick.test`;

    const admin = await upsertUser(address("admin"), "Industrial Demo", "Admin", UserRole.SUPER_ADMIN);
    await tx.adminProfile.upsert({ where: { userId: admin.id }, update: {}, create: { userId: admin.id } });
    await upsertUser(address("buyer"), "Industrial Demo", "Buyer", UserRole.CONSUMER);
    const requester = await upsertUser(address("requester"), "Industrial Demo", "Requester", UserRole.COMPANY_ADMIN);
    const approver = await upsertUser(address("approver"), "Industrial Demo", "Approver", UserRole.COMPANY_APPROVER);

    const company = await tx.company.upsert({
      where: { crNumber: `DEMO-${runId.toUpperCase()}-COMPANY` },
      update: { nameEn: `Industrial Demo Company ${runId}`, country: Country.SA, city: "Riyadh", status: CompanyStatus.ACTIVE, deletedAt: null },
      create: {
        nameEn: `Industrial Demo Company ${runId}`,
        nameAr: `شركة العرض الصناعي ${runId}`,
        crNumber: `DEMO-${runId.toUpperCase()}-COMPANY`,
        industry: Industry.MANUFACTURING,
        size: CompanySize.MEDIUM,
        country: Country.SA,
        city: "Riyadh",
        status: CompanyStatus.ACTIVE,
        creditLimit: 250000,
        paymentTerms: 30,
      },
    });
    for (const member of [
      { userId: requester.id, role: UserRole.COMPANY_ADMIN, department: "Procurement", spendLimit: 100000 },
      { userId: approver.id, role: UserRole.COMPANY_APPROVER, department: "Finance", spendLimit: 250000 },
    ]) {
      await tx.companyMember.upsert({
        where: { userId: member.userId },
        update: { companyId: company.id, role: member.role, department: member.department, spendLimit: member.spendLimit, isActive: true },
        create: { ...member, companyId: company.id, isActive: true },
      });
    }
    const policy = await tx.approvalPolicy.findFirst({ where: { companyId: company.id, name: "Industrial demo maker-checker" } });
    if (policy) {
      await tx.approvalPolicy.update({ where: { id: policy.id }, data: { thresholdAmount: 1, currency: Currency.SAR, approverRole: UserRole.COMPANY_APPROVER, isActive: true } });
    } else {
      await tx.approvalPolicy.create({ data: { companyId: company.id, name: "Industrial demo maker-checker", thresholdAmount: 1, currency: Currency.SAR, approverRole: UserRole.COMPANY_APPROVER, isActive: true } });
    }

    const cities = ["Riyadh", "Jeddah", "Dammam"];
    const sellers = [];
    const locations = [];
    for (let index = 0; index < 3; index += 1) {
      const label = String.fromCharCode(65 + index);
      const owner = await upsertUser(address(`seller-${label.toLowerCase()}-owner`), `Seller ${label}`, "Owner", UserRole.SELLER_OWNER);
      const fulfillmentStaff = await upsertUser(address(`seller-${label.toLowerCase()}-fulfillment`), `Seller ${label}`, "Fulfillment", UserRole.SELLER_STAFF);
      const catalogStaff = await upsertUser(address(`seller-${label.toLowerCase()}-catalog`), `Seller ${label}`, "Catalog", UserRole.SELLER_STAFF);
      const seller = await tx.sellerProfile.upsert({
        where: { userId: owner.id },
        update: { businessNameEn: `Industrial Demo Seller ${label}`, country: Country.SA, city: cities[index]!, deletedAt: null },
        create: {
          userId: owner.id,
          businessNameEn: `Industrial Demo Seller ${label}`,
          businessNameAr: `بائع العرض الصناعي ${label}`,
          crNumber: `DEMO-${runId.toUpperCase()}-SELLER-${label}`,
          type: SellerType.DISTRIBUTOR,
          country: Country.SA,
          city: cities[index]!,
          description: `${INDUSTRIAL_DEMO_TAG}. Certification-only distributor identity; no manufacturer authorization is implied.`,
          tier: SellerTier.VERIFIED,
          status: SellerStatus.PENDING_REVIEW,
          commissionRate: 5,
        },
      });
      await tx.sellerMembership.upsert({
        where: { userId: fulfillmentStaff.id },
        update: { sellerId: seller.id, title: "Industrial demo fulfillment", permissions: ["orders.view", "orders.fulfill"], isActive: true },
        create: { userId: fulfillmentStaff.id, sellerId: seller.id, title: "Industrial demo fulfillment", permissions: ["orders.view", "orders.fulfill"], isActive: true },
      });
      await tx.sellerMembership.upsert({
        where: { userId: catalogStaff.id },
        update: { sellerId: seller.id, title: "Industrial demo catalog", permissions: ["catalog.view", "catalog.manage", "pricing.manage", "inventory.manage"], isActive: true },
        create: { userId: catalogStaff.id, sellerId: seller.id, title: "Industrial demo catalog", permissions: ["catalog.view", "catalog.manage", "pricing.manage", "inventory.manage"], isActive: true },
      });
      const warehouse = await tx.warehouse.upsert({
        where: { id: `demo-${runId}-warehouse-${label.toLowerCase()}` },
        update: { sellerId: seller.id, nameEn: `Industrial Demo ${label} Warehouse`, country: Country.SA, city: cities[index]!, isActive: true },
        create: { id: `demo-${runId}-warehouse-${label.toLowerCase()}`, sellerId: seller.id, nameEn: `Industrial Demo ${label} Warehouse`, type: WarehouseType.SELLER, country: Country.SA, city: cities[index]!, isActive: true },
      });
      const location = await tx.inventoryLocation.upsert({
        where: { warehouseId_code: { warehouseId: warehouse.id, code: "DEMO-A1" } },
        update: { zone: "DEMO", aisle: "A", bin: "1", isActive: true },
        create: { warehouseId: warehouse.id, code: "DEMO-A1", zone: "DEMO", aisle: "A", bin: "1", isActive: true },
      });
      sellers.push(seller);
      locations.push(location);
    }

    const categories = new Map<string, string>();
    for (const [index, category] of INDUSTRIAL_DEMO_CATEGORIES.entries()) {
      const stored = await tx.category.upsert({
        where: { slug: category.slug },
        update: { nameEn: category.nameEn, nameAr: category.nameAr, sortOrder: 100 + index, isActive: true },
        create: { slug: category.slug, nameEn: category.nameEn, nameAr: category.nameAr, sortOrder: 100 + index, isActive: true },
      });
      categories.set(category.slug, stored.id);
    }
    const mennekesBrand = await tx.brand.upsert({
      where: { slug: "mennekes" },
      update: { nameEn: "MENNEKES", isActive: true },
      create: { slug: "mennekes", nameEn: "MENNEKES", nameAr: "MENNEKES", isActive: true },
    });
    const eatonBrand = await tx.brand.upsert({
      where: { slug: "eaton" },
      update: { nameEn: "Eaton", isActive: true },
      create: { slug: "eaton", nameEn: "Eaton", nameAr: "Eaton", isActive: true },
    });

    for (const source of sources) {
      const sellerIndex = industrialDemoSellerIndex(source.partNumber);
      const facts = industrialDemoCommercialFacts(source.partNumber);
      const skuPrefix = source.manufacturer === "MENNEKES" ? "MNK" : "ETN";
      const brand = source.manufacturer === "MENNEKES" ? mennekesBrand : eatonBrand;
      const categoryId = categories.get(industrialDemoCategorySlug(source.partNumber));
      if (!categoryId) throw new Error(`Category missing for ${source.partNumber}`);
      const product = await tx.product.upsert({
        where: { sku: `DEMO-${skuPrefix}-${source.partNumber}` },
        update: {
          sellerId: sellers[sellerIndex]!.id,
          categoryId,
          brandId: brand.id,
          nameEn: source.name,
          nameAr: `منتج صناعي ${source.manufacturer} ${source.partNumber}`,
          descriptionEn: `${manufacturerDescription(source)}. Certification price and stock are simulated by Avenick and are not manufacturer claims.`,
          isPubliclyDiscoverable: true,
          isB2CEnabled: true,
          isB2BEnabled: true,
          deletedAt: null,
          tags: ["industrial-demo", "manufacturer-sourced", "certification-sandbox"],
          listingHealth: 100,
        },
        create: {
          sellerId: sellers[sellerIndex]!.id,
          categoryId,
          brandId: brand.id,
          sku: `DEMO-${skuPrefix}-${source.partNumber}`,
          slug: `demo-${source.manufacturer.toLowerCase()}-${source.partNumber.toLowerCase()}`,
          nameEn: source.name,
          nameAr: `منتج صناعي ${source.manufacturer} ${source.partNumber}`,
          descriptionEn: `${manufacturerDescription(source)}. Certification price and stock are simulated by Avenick and are not manufacturer claims.`,
          status: ProductStatus.PENDING_REVIEW,
          isPubliclyDiscoverable: true,
          isB2CEnabled: true,
          isB2BEnabled: true,
          moq: 1,
          listingHealth: 100,
          tags: ["industrial-demo", "manufacturer-sourced", "certification-sandbox"],
        },
      });
      const primary = await tx.productImage.findFirst({ where: { productId: product.id, isPrimary: true } });
      if (!primary && source.imageUrl) {
        await tx.productImage.create({ data: { productId: product.id, url: source.imageUrl, altEn: `${source.name}, ${source.manufacturer} part ${source.partNumber}`, isPrimary: true } });
      }
      for (const type of [PricingType.B2C, PricingType.B2B]) {
        const price = await tx.productPrice.findFirst({ where: { productId: product.id, variantId: null, type, currency: INDUSTRIAL_DEMO_CURRENCY, minQty: 1, maxQty: null } });
        if (price) await tx.productPrice.update({ where: { id: price.id }, data: { price: facts.price, vatRate: 15, isActive: true } });
        else await tx.productPrice.create({ data: { productId: product.id, type, currency: INDUSTRIAL_DEMO_CURRENCY, minQty: 1, price: facts.price, vatRate: 15, isActive: true } });
      }
      const stock = await tx.inventoryStock.findFirst({ where: { productId: product.id, variantId: null, locationId: locations[sellerIndex]!.id } });
      if (!stock) {
        await tx.inventoryStock.create({ data: { productId: product.id, locationId: locations[sellerIndex]!.id, qty: facts.onHand, reservedQty: facts.reserved, reorderPoint: facts.reorderPoint } });
      }
      await tx.productCommercialMetadata.upsert({
        where: { productId: product.id },
        update: {
          sourceSystem: source.sourceSystem,
          manufacturerPartNumber: source.partNumber,
          supplierPartNumber: source.partNumber,
          uom: "EA",
          sourceFingerprint: source.fingerprint,
          observedAt: new Date(),
          sourcePayload: {
            sourceUrl: source.sourceUrl,
            imageUrl: source.imageUrl,
            gtin13: source.gtin13,
            specifications: source.specifications,
            commercialTruth: "AVENICK_CERTIFICATION_SANDBOX",
            priceCurrency: INDUSTRIAL_DEMO_CURRENCY,
            price: facts.price,
            inventoryLocation: locations[sellerIndex]!.id,
            onHandAtProvisioning: facts.onHand,
            reservedAtProvisioning: facts.reserved,
            manufacturerAvailabilityClaimed: false,
            manufacturerAuthorizationClaimed: false,
          },
        },
        create: {
          productId: product.id,
          sourceSystem: source.sourceSystem,
          manufacturerPartNumber: source.partNumber,
          supplierPartNumber: source.partNumber,
          uom: "EA",
          sourceFingerprint: source.fingerprint,
          sourcePayload: {
            sourceUrl: source.sourceUrl,
            imageUrl: source.imageUrl,
            gtin13: source.gtin13,
            specifications: source.specifications,
            commercialTruth: "AVENICK_CERTIFICATION_SANDBOX",
            priceCurrency: INDUSTRIAL_DEMO_CURRENCY,
            price: facts.price,
            inventoryLocation: locations[sellerIndex]!.id,
            onHandAtProvisioning: facts.onHand,
            reservedAtProvisioning: facts.reserved,
            manufacturerAvailabilityClaimed: false,
            manufacturerAuthorizationClaimed: false,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          sellerId: sellers[sellerIndex]!.id,
          entityType: "IndustrialDemoProduct",
          entityId: product.id,
          action: AuditAction.UPDATE,
          after: { tag: INDUSTRIAL_DEMO_TAG, runId, sourceUrl: source.sourceUrl, sourceFingerprint: source.fingerprint, partNumber: source.partNumber, status: product.status, commercialTruth: "CERTIFICATION_SANDBOX" },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        entityType: "IndustrialDemoProvisioning",
        entityId: runId,
        action: AuditAction.CREATE,
        after: { tag: INDUSTRIAL_DEMO_TAG, runId, ...catalog, currency: INDUSTRIAL_DEMO_CURRENCY, country: Country.SA, destructive: false },
      },
    });
    return { runId, ...catalog, currency: INDUSTRIAL_DEMO_CURRENCY, accountDomain: "avenick.test" };
  }, { timeout: 120_000 });

  console.log(`Industrial demo provisioned non-destructively on ${host}`);
  console.log(JSON.stringify(result));
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
