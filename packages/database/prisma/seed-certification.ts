import {
  AuditAction,
  CompanySize,
  CompanyStatus,
  Country,
  Currency,
  FulfillmentType,
  Industry,
  Language,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  POStatus,
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

const prisma = new PrismaClient();
const CERT_TAG = "AVENICK_HOSTED_CERTIFICATION_V1";

function certificationConfiguration() {
  const environment = process.env.CERTIFICATION_ENVIRONMENT;
  const password = process.env.CERTIFICATION_PASSWORD;
  const expectedHost = process.env.CERTIFICATION_DATABASE_HOST;
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (environment !== "preview" && environment !== "certification") {
    throw new Error("CERTIFICATION_ENVIRONMENT must be preview or certification");
  }
  if (!password || password.length < 16) {
    throw new Error("CERTIFICATION_PASSWORD must be supplied and at least 16 characters");
  }
  if (!expectedHost || !databaseUrl) {
    throw new Error("CERTIFICATION_DATABASE_HOST and DIRECT_URL/DATABASE_URL are required");
  }

  const actualHost = new URL(databaseUrl).hostname;
  if (actualHost !== expectedHost || actualHost.includes("-pooler.")) {
    throw new Error("Certification database target does not match the explicit unpooled host");
  }
  return { password, actualHost };
}

async function main() {
  const { password, actualHost } = certificationConfiguration();
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const upsertUser = (email: string, firstName: string, lastName: string, role: UserRole) =>
      tx.user.upsert({
        where: { email },
        update: { passwordHash, firstName, lastName, role, status: UserStatus.ACTIVE, deletedAt: null, language: Language.EN },
        create: { email, passwordHash, firstName, lastName, role, status: UserStatus.ACTIVE, language: Language.EN },
      });

    const admin = await upsertUser("cert-admin@avenick.test", "Certification", "Admin", UserRole.SUPER_ADMIN);
    await tx.adminProfile.upsert({ where: { userId: admin.id }, update: {}, create: { userId: admin.id } });
    const buyer = await upsertUser("cert-buyer@avenick.test", "Certification", "Buyer", UserRole.CONSUMER);
    const companyAdmin = await upsertUser("cert-company-admin@avenick.test", "Company", "Requester", UserRole.COMPANY_ADMIN);
    const companyApprover = await upsertUser("cert-company-approver@avenick.test", "Company", "Approver", UserRole.COMPANY_APPROVER);
    const sellerAOwner = await upsertUser("cert-seller-a-owner@avenick.test", "Seller A", "Owner", UserRole.SELLER_OWNER);
    const fulfillmentStaff = await upsertUser("cert-seller-a-fulfillment@avenick.test", "Seller A", "Fulfillment", UserRole.SELLER_STAFF);
    const catalogStaff = await upsertUser("cert-seller-a-catalog@avenick.test", "Seller A", "Catalog", UserRole.SELLER_STAFF);
    const sellerBOwner = await upsertUser("cert-seller-b-owner@avenick.test", "Seller B", "Owner", UserRole.SELLER_OWNER);

    const company = await tx.company.upsert({
      where: { crNumber: "CERT-AE-COMPANY-A" },
      update: { status: CompanyStatus.ACTIVE, deletedAt: null, country: Country.AE, city: "Dubai" },
      create: {
        nameEn: "Avenick Certification Company A", nameAr: "شركة أفينيك للاعتماد أ",
        crNumber: "CERT-AE-COMPANY-A", vatNumber: "CERT-VAT-COMPANY-A",
        industry: Industry.BUILDING_MATERIALS, size: CompanySize.MEDIUM,
        country: Country.AE, city: "Dubai", status: CompanyStatus.ACTIVE,
        creditLimit: 100000, paymentTerms: 30,
      },
    });
    await tx.companyMember.upsert({
      where: { userId: companyAdmin.id },
      update: { companyId: company.id, role: UserRole.COMPANY_ADMIN, isActive: true, department: "Procurement", spendLimit: 50000 },
      create: { userId: companyAdmin.id, companyId: company.id, role: UserRole.COMPANY_ADMIN, isActive: true, department: "Procurement", spendLimit: 50000 },
    });
    await tx.companyMember.upsert({
      where: { userId: companyApprover.id },
      update: { companyId: company.id, role: UserRole.COMPANY_APPROVER, isActive: true, department: "Finance", spendLimit: 100000 },
      create: { userId: companyApprover.id, companyId: company.id, role: UserRole.COMPANY_APPROVER, isActive: true, department: "Finance", spendLimit: 100000 },
    });
    const existingPolicy = await tx.approvalPolicy.findFirst({ where: { companyId: company.id, name: "Certification maker-checker approval" } });
    if (existingPolicy) {
      await tx.approvalPolicy.update({ where: { id: existingPolicy.id }, data: { thresholdAmount: 1, currency: Currency.AED, approverRole: UserRole.COMPANY_APPROVER, isActive: true } });
    } else {
      await tx.approvalPolicy.create({ data: { companyId: company.id, name: "Certification maker-checker approval", thresholdAmount: 1, currency: Currency.AED, approverRole: UserRole.COMPANY_APPROVER, isActive: true } });
    }

    const sellerA = await tx.sellerProfile.upsert({
      where: { userId: sellerAOwner.id },
      update: { status: SellerStatus.ACTIVE, deletedAt: null },
      create: {
        userId: sellerAOwner.id, businessNameEn: "Avenick Certification Seller A",
        crNumber: "CERT-AE-SELLER-A", type: SellerType.DISTRIBUTOR, country: Country.AE,
        city: "Dubai", tier: SellerTier.VERIFIED, status: SellerStatus.ACTIVE, commissionRate: 5,
      },
    });
    const sellerB = await tx.sellerProfile.upsert({
      where: { userId: sellerBOwner.id },
      update: { status: SellerStatus.ACTIVE, deletedAt: null },
      create: {
        userId: sellerBOwner.id, businessNameEn: "Avenick Certification Seller B",
        crNumber: "CERT-AE-SELLER-B", type: SellerType.DISTRIBUTOR, country: Country.AE,
        city: "Abu Dhabi", tier: SellerTier.VERIFIED, status: SellerStatus.ACTIVE, commissionRate: 5,
      },
    });
    await tx.sellerMembership.upsert({
      where: { userId: fulfillmentStaff.id },
      update: { sellerId: sellerA.id, title: "Certification fulfillment staff", permissions: ["orders.view", "orders.fulfill"], isActive: true },
      create: { userId: fulfillmentStaff.id, sellerId: sellerA.id, title: "Certification fulfillment staff", permissions: ["orders.view", "orders.fulfill"], isActive: true },
    });
    await tx.sellerMembership.upsert({
      where: { userId: catalogStaff.id },
      update: { sellerId: sellerA.id, title: "Certification catalog staff", permissions: ["catalog.view", "catalog.manage"], isActive: true },
      create: { userId: catalogStaff.id, sellerId: sellerA.id, title: "Certification catalog staff", permissions: ["catalog.view", "catalog.manage"], isActive: true },
    });

    const category = await tx.category.upsert({
      where: { slug: "certification-supplies" },
      update: { isActive: true },
      create: { nameEn: "Certification Supplies", nameAr: "مستلزمات الاعتماد", slug: "certification-supplies", sortOrder: 999, isActive: true },
    });
    const ensureWarehouse = async (id: string, sellerId: string, name: string) => {
      const warehouse = await tx.warehouse.upsert({
        where: { id }, update: { sellerId, isActive: true },
        create: { id, sellerId, nameEn: name, type: WarehouseType.SELLER, country: Country.AE, city: "Dubai", isActive: true },
      });
      return tx.inventoryLocation.upsert({
        where: { warehouseId_code: { warehouseId: warehouse.id, code: "CERT-01" } },
        update: { isActive: true }, create: { warehouseId: warehouse.id, code: "CERT-01", zone: "CERT", aisle: "01", bin: "01", isActive: true },
      });
    };
    const locationA = await ensureWarehouse("cert-warehouse-seller-a", sellerA.id, "Certification Seller A Warehouse");
    const locationB = await ensureWarehouse("cert-warehouse-seller-b", sellerB.id, "Certification Seller B Warehouse");

    const ensureProduct = async (input: { sku: string; slug: string; sellerId: string; name: string; price: number; locationId: string }) => {
      const product = await tx.product.upsert({
        where: { sku: input.sku },
        update: { sellerId: input.sellerId, categoryId: category.id, status: ProductStatus.ACTIVE, isB2CEnabled: true, isB2BEnabled: true, deletedAt: null, moq: 1, tags: ["certification"] },
        create: {
          sellerId: input.sellerId, categoryId: category.id, sku: input.sku, slug: input.slug,
          nameEn: input.name, nameAr: input.name, descriptionEn: `${CERT_TAG} deterministic test product`,
          status: ProductStatus.ACTIVE, isB2CEnabled: true, isB2BEnabled: true,
          origin: Country.AE, moq: 1, listingHealth: 100, tags: ["certification"], publishedAt: new Date(),
        },
      });
      for (const type of [PricingType.B2C, PricingType.B2B]) {
        const current = await tx.productPrice.findFirst({ where: { productId: product.id, variantId: null, type, currency: Currency.AED, minQty: 1, maxQty: null } });
        if (current) await tx.productPrice.update({ where: { id: current.id }, data: { price: input.price, vatRate: 5, isActive: true } });
        else await tx.productPrice.create({ data: { productId: product.id, type, currency: Currency.AED, minQty: 1, price: input.price, vatRate: 5, isActive: true } });
      }
      const stock = await tx.inventoryStock.findFirst({ where: { productId: product.id, variantId: null, locationId: input.locationId } });
      if (stock) await tx.inventoryStock.update({ where: { id: stock.id }, data: { qty: Math.max(stock.qty, stock.reservedQty + 100), reorderPoint: 10 } });
      else await tx.inventoryStock.create({ data: { productId: product.id, locationId: input.locationId, qty: 100, reservedQty: 0, reorderPoint: 10 } });
      return product;
    };
    const productA = await ensureProduct({ sku: "CERT-SELLER-A-PRODUCT", slug: "cert-seller-a-product", sellerId: sellerA.id, name: "Certification Seller A Product", price: 100, locationId: locationA.id });
    const productB = await ensureProduct({ sku: "CERT-SELLER-B-PRODUCT", slug: "cert-seller-b-product", sellerId: sellerB.id, name: "Certification Seller B Product", price: 200, locationId: locationB.id });

    await tx.purchaseOrder.upsert({
      where: { poNumber: "CERT-PO-READY" },
      update: { companyId: company.id, requesterId: companyAdmin.id, status: POStatus.DRAFT, currency: Currency.AED, total: 0, notes: CERT_TAG },
      create: { poNumber: "CERT-PO-READY", companyId: company.id, requesterId: companyAdmin.id, status: POStatus.DRAFT, currency: Currency.AED, total: 0, notes: CERT_TAG },
    });
    await tx.order.upsert({
      where: { orderNumber: "AVN-CERT-HOSTED-MULTI" },
      update: { userId: buyer.id, status: OrderStatus.DELIVERED },
      create: {
        orderNumber: "AVN-CERT-HOSTED-MULTI", userId: buyer.id, type: OrderType.B2C,
        status: OrderStatus.DELIVERED, fulfillment: FulfillmentType.SELLER_FULFILLED,
        currency: Currency.AED, subtotal: 300, vatAmount: 15, shippingAmount: 0, discountAmount: 0, total: 315,
        paymentMethod: PaymentMethod.BANK_TRANSFER, paymentStatus: PaymentStatus.PAID,
        shippingAddress: { label: "Certification", line1: "Hosted Certification Lane", city: "Dubai", country: "AE" },
        items: { create: [
          { productId: productA.id, sellerId: sellerA.id, sku: productA.sku, nameEn: productA.nameEn, nameAr: productA.nameAr, quantity: 1, unitPrice: 100, vatRate: 5, vatAmount: 5, total: 105, status: OrderStatus.DELIVERED },
          { productId: productB.id, sellerId: sellerB.id, sku: productB.sku, nameEn: productB.nameEn, nameAr: productB.nameAr, quantity: 1, unitPrice: 200, vatRate: 5, vatAmount: 10, total: 210, status: OrderStatus.DELIVERED },
        ] },
      },
    });

    await tx.auditLog.create({
      data: { actorId: admin.id, entityType: "CertificationFixture", entityId: CERT_TAG, action: AuditAction.UPDATE, after: { tag: CERT_TAG, environment: process.env.CERTIFICATION_ENVIRONMENT, users: 8, sellers: 2, company: company.id } },
    });
    return { companyId: company.id, sellerAId: sellerA.id, sellerBId: sellerB.id };
  }, { timeout: 60_000 });

  console.log(`Certification fixture applied safely to ${actualHost}`);
  console.log(JSON.stringify({ tag: CERT_TAG, ...result }));
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
