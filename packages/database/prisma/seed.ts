import {
  PrismaClient,
  UserRole,
  UserStatus,
  Language,
  Country,
  Currency,
  Industry,
  CompanySize,
  CompanyStatus,
  SellerType,
  SellerTier,
  SellerStatus,
  DocumentType,
  DocumentStatus,
  ProductStatus,
  PricingType,
  OrderType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  FulfillmentType,
  WarehouseType,
  RFQStatus,
  MessageSenderType,
  PayoutStatus,
  AuditAction,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const HASH = (pw: string) => bcrypt.hash(pw, 12);

async function main() {
  console.log("🌱 Seeding Avenick...");

  // ── ADMIN ────────────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@avenick.test" },
    update: {},
    create: {
      email: "admin@avenick.test",
      passwordHash: await HASH("Password123!"),
      firstName: "Platform",
      lastName: "Admin",
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      language: Language.EN,
      adminProfile: { create: {} },
    },
  });
  console.log(`✅ Admin: ${adminUser.email}`);

  // ── SELLER USER ────────────────────────────────────────────────────────────
  const sellerUser = await prisma.user.upsert({
    where: { email: "seller@avenick.test" },
    update: {},
    create: {
      email: "seller@avenick.test",
      passwordHash: await HASH("Password123!"),
      firstName: "Mohammed",
      lastName: "Al-Rashidi",
      firstNameAr: "محمد",
      lastNameAr: "الرشيدي",
      role: UserRole.SELLER_OWNER,
      status: UserStatus.ACTIVE,
      language: Language.AR,
    },
  });

  // ── SELLER PROFILE ─────────────────────────────────────────────────────────
  const seller = await prisma.sellerProfile.upsert({
    where: { userId: sellerUser.id },
    update: {},
    create: {
      userId: sellerUser.id,
      businessNameEn: "Gulf Industrial Supplies LLC",
      businessNameAr: "شركة الخليج للمستلزمات الصناعية",
      crNumber: "AE-CR-2022-88112",
      vatNumber: "AE-VAT-100123456",
      type: SellerType.DISTRIBUTOR,
      country: Country.AE,
      city: "Dubai",
      description: "Leading distributor of industrial supplies, safety equipment, and office materials across the GCC.",
      descriptionAr: "موزع رائد للمستلزمات الصناعية ومعدات السلامة والمواد المكتبية في منطقة الخليج.",
      tier: SellerTier.VERIFIED,
      status: SellerStatus.ACTIVE,
      commissionRate: 5.0,
      rating: 4.7,
      reviewCount: 142,
      accountHealth: 87,
      bankDetails: {
        iban: "AE070331234567890123456",
        bankName: "Emirates NBD",
        accountName: "Gulf Industrial Supplies LLC",
      },
      documents: {
        create: [
          {
            type: DocumentType.TRADE_LICENSE,
            fileUrl: "https://placehold.co/400x600?text=Trade+License",
            fileName: "trade-license.pdf",
            status: DocumentStatus.APPROVED,
            expiryDate: new Date("2026-12-31"),
          },
          {
            type: DocumentType.VAT_CERTIFICATE,
            fileUrl: "https://placehold.co/400x600?text=VAT+Certificate",
            fileName: "vat-certificate.pdf",
            status: DocumentStatus.APPROVED,
          },
          {
            type: DocumentType.ISO_CERTIFICATE,
            fileUrl: "https://placehold.co/400x600?text=ISO+Certificate",
            fileName: "iso-9001.pdf",
            status: DocumentStatus.PENDING_REVIEW,
            expiryDate: new Date("2025-06-30"),
          },
        ],
      },
    },
  });
  console.log(`✅ Seller: ${sellerUser.email}`);

  // ── B2C BUYER ──────────────────────────────────────────────────────────────
  const buyerUser = await prisma.user.upsert({
    where: { email: "buyer@avenick.test" },
    update: {},
    create: {
      email: "buyer@avenick.test",
      passwordHash: await HASH("Password123!"),
      firstName: "Sara",
      lastName: "Al-Mansouri",
      firstNameAr: "سارة",
      lastNameAr: "المنصوري",
      role: UserRole.CONSUMER,
      status: UserStatus.ACTIVE,
      language: Language.AR,
    },
  });

  // ── B2B COMPANY ────────────────────────────────────────────────────────────
  const companyUser = await prisma.user.upsert({
    where: { email: "company@avenick.test" },
    update: {},
    create: {
      email: "company@avenick.test",
      passwordHash: await HASH("Password123!"),
      firstName: "Omar",
      lastName: "Al-Suwaidi",
      firstNameAr: "عمر",
      lastNameAr: "السويدي",
      role: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      language: Language.AR,
    },
  });

  const company = await prisma.company.upsert({
    where: { crNumber: "AE-CR-2021-11234" },
    update: {},
    create: {
      nameEn: "Emirates Construction Group",
      nameAr: "مجموعة الإمارات للإنشاءات",
      crNumber: "AE-CR-2021-11234",
      vatNumber: "AE-VAT-200456789",
      industry: Industry.BUILDING_MATERIALS,
      size: CompanySize.LARGE,
      country: Country.AE,
      city: "Abu Dhabi",
      status: CompanyStatus.ACTIVE,
      creditLimit: 500000,
      paymentTerms: 30,
      members: {
        create: {
          userId: companyUser.id,
          role: UserRole.COMPANY_ADMIN,
          department: "Procurement",
        },
      },
    },
  });
  console.log(`✅ B2B Company: ${company.nameEn}`);

  // ── CATEGORIES ──────────────────────────────────────────────────────────────
  const cats = await Promise.all([
    prisma.category.upsert({
      where: { slug: "industrial-supplies" },
      update: {},
      create: { nameEn: "Industrial Supplies", nameAr: "المستلزمات الصناعية", slug: "industrial-supplies", iconName: "Factory", sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: "electronics" },
      update: {},
      create: { nameEn: "Electronics", nameAr: "الإلكترونيات", slug: "electronics", iconName: "Cpu", sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: "office-supplies" },
      update: {},
      create: { nameEn: "Office Supplies", nameAr: "مستلزمات مكتبية", slug: "office-supplies", iconName: "Briefcase", sortOrder: 3 },
    }),
    prisma.category.upsert({
      where: { slug: "safety-ppe" },
      update: {},
      create: { nameEn: "Safety & PPE", nameAr: "معدات السلامة", slug: "safety-ppe", iconName: "ShieldCheck", sortOrder: 4 },
    }),
    prisma.category.upsert({
      where: { slug: "food-hospitality" },
      update: {},
      create: { nameEn: "Food & Hospitality", nameAr: "الأغذية والضيافة", slug: "food-hospitality", iconName: "UtensilsCrossed", sortOrder: 5 },
    }),
    prisma.category.upsert({
      where: { slug: "building-materials" },
      update: {},
      create: { nameEn: "Building Materials", nameAr: "مواد البناء", slug: "building-materials", iconName: "Building2", sortOrder: 6 },
    }),
  ]);
  const [industCat, elecCat, officeCat, safetyCat, foodCat, buildCat] = cats;
  console.log("✅ Categories seeded");

  // ── BRANDS ──────────────────────────────────────────────────────────────────
  const brand3M = await prisma.brand.upsert({
    where: { slug: "3m" },
    update: {},
    create: { nameEn: "3M", nameAr: "ثري إم", slug: "3m", country: Country.AE },
  });
  const brandHoneywell = await prisma.brand.upsert({
    where: { slug: "honeywell" },
    update: {},
    create: { nameEn: "Honeywell", nameAr: "هانيويل", slug: "honeywell", country: Country.AE },
  });
  const brandNavigator = await prisma.brand.upsert({
    where: { slug: "navigator" },
    update: {},
    create: { nameEn: "Navigator", nameAr: "نافيجاتور", slug: "navigator" },
  });

  // ── WAREHOUSES ────────────────────────────────────────────────────────────
  const platformWarehouse = await prisma.warehouse.upsert({
    where: { id: "wh-platform-dubai" },
    update: {},
    create: {
      id: "wh-platform-dubai",
      nameEn: "Avenick Fulfillment Center - Dubai",
      nameAr: "مركز توزيع منزل - دبي",
      type: WarehouseType.PLATFORM,
      country: Country.AE,
      city: "Dubai",
      address: "Jebel Ali Free Zone, Dubai, UAE",
      locations: {
        create: [
          { code: "A-01-01", zone: "A", aisle: "01", bin: "01" },
          { code: "A-01-02", zone: "A", aisle: "01", bin: "02" },
          { code: "B-02-01", zone: "B", aisle: "02", bin: "01" },
        ],
      },
    },
  });

  const sellerWarehouse = await prisma.warehouse.upsert({
    where: { id: "wh-seller-dubai" },
    update: {},
    create: {
      id: "wh-seller-dubai",
      sellerId: seller.id,
      nameEn: "Gulf Industrial - Dubai Warehouse",
      nameAr: "مستودع الخليج الصناعي - دبي",
      type: WarehouseType.SELLER,
      country: Country.AE,
      city: "Dubai",
      locations: {
        create: [
          { code: "S-01-01", zone: "S", aisle: "01", bin: "01" },
          { code: "S-01-02", zone: "S", aisle: "01", bin: "02" },
        ],
      },
    },
  });
  console.log("✅ Warehouses seeded");

  const sellerLoc = await prisma.inventoryLocation.findFirst({ where: { warehouseId: sellerWarehouse.id } });
  const platformLoc = await prisma.inventoryLocation.findFirst({ where: { warehouseId: platformWarehouse.id } });
  if (!sellerLoc || !platformLoc) throw new Error("Warehouse locations not found");

  // ── PRODUCTS ───────────────────────────────────────────────────────────────
  type ProductSeed = {
    sku: string;
    slug: string;
    nameEn: string;
    nameAr: string;
    descriptionEn?: string;
    descriptionAr?: string;
    categoryId: string;
    brandId?: string;
    status: ProductStatus;
    isB2C: boolean;
    isB2B: boolean;
    origin: Country;
    moq: number;
    stock: number;
    b2cPrice?: number;
    b2bPrice: number;
    b2bBulkPrice?: number;
    b2bBulkQty?: number;
    listingHealth: number;
    images: { url: string; isPrimary: boolean }[];
  };

  const productSeeds: ProductSeed[] = [
    {
      sku: "SAFETY-HELM-ANSI-YEL",
      slug: "safety-helmet-ansi-yellow",
      nameEn: "ANSI Safety Helmet - Yellow",
      nameAr: "خوذة أمان ANSI - أصفر",
      descriptionEn: "High-impact ANSI Z89.1 certified safety helmet for construction and industrial sites.",
      descriptionAr: "خوذة سلامة عالية الصلابة معتمدة وفق معيار ANSI Z89.1 لمواقع البناء والصناعة.",
      categoryId: safetyCat.id, brandId: brand3M.id,
      status: ProductStatus.ACTIVE, isB2C: false, isB2B: true,
      origin: Country.AE, moq: 10,
      stock: 5000, b2bPrice: 18.50, b2bBulkPrice: 15.00, b2bBulkQty: 100,
      listingHealth: 92,
      images: [
        { url: "https://placehold.co/600x600/FFD700/000?text=Safety+Helmet", isPrimary: true },
        { url: "https://placehold.co/600x600/FFD700/000?text=Side+View", isPrimary: false },
      ],
    },
    {
      sku: "SAFETY-VEST-HI-VIS-M",
      slug: "hi-vis-safety-vest-medium",
      nameEn: "Hi-Visibility Safety Vest - Medium",
      nameAr: "سترة أمان عاكسة - مقاس متوسط",
      descriptionEn: "EN ISO 20471 Class 2 high-visibility vest for road workers and site personnel.",
      descriptionAr: "سترة عاكسة للرؤية العالية EN ISO 20471 فئة 2 لعمال الطريق وموظفي المواقع.",
      categoryId: safetyCat.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 8000, b2cPrice: 22.00, b2bPrice: 15.00, b2bBulkPrice: 11.50, b2bBulkQty: 50,
      listingHealth: 88,
      images: [{ url: "https://placehold.co/600x600/FF6600/fff?text=Hi-Vis+Vest", isPrimary: true }],
    },
    {
      sku: "PPE-GLOVES-NITRILE-L",
      slug: "nitrile-gloves-large-100",
      nameEn: "Nitrile Disposable Gloves - Large (Box 100)",
      nameAr: "قفازات نيتريل للاستخدام مرة واحدة - كبير (علبة 100)",
      descriptionEn: "Powder-free nitrile gloves, medical and industrial grade.",
      descriptionAr: "قفازات نيتريل خالية من البودرة، للاستخدام الطبي والصناعي.",
      categoryId: safetyCat.id, brandId: brandHoneywell.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.SA, moq: 1,
      stock: 50000, b2cPrice: 45.00, b2bPrice: 35.00, b2bBulkPrice: 29.00, b2bBulkQty: 100,
      listingHealth: 95,
      images: [{ url: "https://placehold.co/600x600/1A73E8/fff?text=Nitrile+Gloves", isPrimary: true }],
    },
    {
      sku: "OFF-A4-PAPER-80GSM-5R",
      slug: "a4-copy-paper-80gsm-box",
      nameEn: "A4 Copier Paper 80gsm - Box (5 Reams)",
      nameAr: "ورق طباعة A4 80 جرام - صندوق (5 رزم)",
      descriptionEn: "Premium A4 white copy paper, 80gsm, 500 sheets per ream.",
      descriptionAr: "ورق طباعة A4 أبيض مميز، 80 جرام، 500 ورقة لكل رزمة.",
      categoryId: officeCat.id, brandId: brandNavigator.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 12000, b2cPrice: 58.00, b2bPrice: 49.00, b2bBulkPrice: 42.00, b2bBulkQty: 50,
      listingHealth: 90,
      images: [{ url: "https://placehold.co/600x600/FFFFFF/333?text=A4+Paper", isPrimary: true }],
    },
    {
      sku: "OFF-CHAIR-ERGO-PRO",
      slug: "ergonomic-office-chair-pro",
      nameEn: "Ergonomic Office Chair Pro",
      nameAr: "كرسي مكتب مريح برو",
      descriptionEn: "Fully adjustable ergonomic chair with lumbar support, suitable for long working hours.",
      descriptionAr: "كرسي مكتبي مريح قابل للتعديل الكامل مع دعم قطني، مناسب لساعات العمل الطويلة.",
      categoryId: officeCat.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 320, b2cPrice: 1250.00, b2bPrice: 1100.00, b2bBulkPrice: 980.00, b2bBulkQty: 5,
      listingHealth: 82,
      images: [{ url: "https://placehold.co/600x600/2C3E50/fff?text=Office+Chair", isPrimary: true }],
    },
    {
      sku: "INDUS-PUMP-CENTRI-2HP",
      slug: "centrifugal-pump-2hp",
      nameEn: "Centrifugal Water Pump - 2HP",
      nameAr: "مضخة مياه طاردة مركزية - 2 حصان",
      descriptionEn: "Heavy-duty 2HP centrifugal pump for industrial and agricultural applications.",
      descriptionAr: "مضخة طاردة مركزية 2 حصان للاستخدام الصناعي والزراعي.",
      categoryId: industCat.id,
      status: ProductStatus.ACTIVE, isB2C: false, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 450, b2bPrice: 850.00, b2bBulkPrice: 780.00, b2bBulkQty: 10,
      listingHealth: 78,
      images: [{ url: "https://placehold.co/600x600/607D8B/fff?text=Water+Pump", isPrimary: true }],
    },
    {
      sku: "BUILD-CEMENT-OPC-50KG",
      slug: "opc-cement-50kg-bag",
      nameEn: "OPC Portland Cement 50kg Bag",
      nameAr: "أسمنت بورتلاند OPC كيس 50 كيلو",
      descriptionEn: "Ordinary Portland Cement Grade 42.5N, suitable for all construction applications.",
      descriptionAr: "أسمنت بورتلاند عادي درجة 42.5N، مناسب لجميع تطبيقات البناء.",
      categoryId: buildCat.id,
      status: ProductStatus.ACTIVE, isB2C: false, isB2B: true,
      origin: Country.SA, moq: 50,
      stock: 100000, b2bPrice: 18.50, b2bBulkPrice: 16.00, b2bBulkQty: 500,
      listingHealth: 75,
      images: [{ url: "https://placehold.co/600x600/9E9E9E/fff?text=Cement", isPrimary: true }],
    },
    {
      sku: "BUILD-REBAR-10MM-12M",
      slug: "steel-rebar-10mm-12m",
      nameEn: "Steel Rebar 10mm × 12m",
      nameAr: "حديد تسليح 10 ملم × 12 متر",
      descriptionEn: "BS4449 Grade 60 deformed steel bar for reinforced concrete construction.",
      descriptionAr: "قضيب فولاذي مشكّل درجة 60 وفق BS4449 للخرسانة المسلحة.",
      categoryId: buildCat.id,
      status: ProductStatus.ACTIVE, isB2C: false, isB2B: true,
      origin: Country.SA, moq: 100,
      stock: 500000, b2bPrice: 12.00, b2bBulkPrice: 10.50, b2bBulkQty: 1000,
      listingHealth: 70,
      images: [{ url: "https://placehold.co/600x600/78909C/fff?text=Steel+Rebar", isPrimary: true }],
    },
    {
      sku: "ELEC-LED-BULB-12W-E27",
      slug: "led-bulb-12w-e27-daylight",
      nameEn: "LED Bulb 12W E27 - Daylight",
      nameAr: "لمبة LED 12 وات E27 - ضوء النهار",
      descriptionEn: "Energy-efficient 12W LED bulb, 6500K daylight, E27 base, 1200 lumens.",
      descriptionAr: "لمبة LED موفرة للطاقة 12 وات، 6500K ضوء نهاري، قاعدة E27، 1200 لومن.",
      categoryId: elecCat.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 25000, b2cPrice: 8.50, b2bPrice: 6.00, b2bBulkPrice: 4.50, b2bBulkQty: 200,
      listingHealth: 85,
      images: [{ url: "https://placehold.co/600x600/FFF9C4/333?text=LED+Bulb", isPrimary: true }],
    },
    {
      sku: "FOOD-DATES-MEDJOOL-1KG",
      slug: "medjool-dates-1kg-premium",
      nameEn: "Premium Medjool Dates 1kg",
      nameAr: "تمر المجدول الفاخر 1 كيلو",
      descriptionEn: "Premium naturally-harvested Medjool dates from Jordan. Halal certified.",
      descriptionAr: "تمر مجدول فاخر طبيعي من الأردن. معتمد حلال.",
      categoryId: foodCat.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.SA, moq: 1,
      stock: 8000, b2cPrice: 95.00, b2bPrice: 78.00, b2bBulkPrice: 68.00, b2bBulkQty: 50,
      listingHealth: 96,
      images: [{ url: "https://placehold.co/600x600/8B4513/fff?text=Medjool+Dates", isPrimary: true }],
    },
    // Incomplete / suppressed products for demo of product issues
    {
      sku: "DRAFT-PUMP-DIESEL",
      slug: "diesel-pump-draft",
      nameEn: "Diesel Fuel Pump",
      nameAr: "",  // missing Arabic title
      categoryId: industCat.id,
      status: ProductStatus.DRAFT, isB2C: false, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 0, b2bPrice: 0, // no price, no stock
      listingHealth: 15,
      images: [],
    },
    {
      sku: "SUPP-HARDHAT-RED",
      slug: "hard-hat-red-suppressed",
      nameEn: "Hard Hat - Red",
      nameAr: "خوذة صلبة - أحمر",
      categoryId: safetyCat.id,
      status: ProductStatus.SUPPRESSED, isB2C: true, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 200, b2cPrice: 25.00, b2bPrice: 20.00,
      listingHealth: 45,
      images: [{ url: "https://placehold.co/600x600/E53935/fff?text=Red+Hard+Hat", isPrimary: true }],
    },
    // Products with pricing tiers
    {
      sku: "GLOVES-LATEX-M-100",
      slug: "latex-gloves-medium-100",
      nameEn: "Latex Examination Gloves - Medium (Box 100)",
      nameAr: "قفازات لاتكس للفحص - متوسط (علبة 100)",
      descriptionEn: "High-quality latex examination gloves, suitable for medical and industrial use.",
      descriptionAr: "قفازات لاتكس عالية الجودة للفحص، مناسبة للاستخدام الطبي والصناعي.",
      categoryId: safetyCat.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.SA, moq: 1,
      stock: 30000, b2cPrice: 38.00, b2bPrice: 29.00, b2bBulkPrice: 24.00, b2bBulkQty: 50,
      listingHealth: 88,
      images: [{ url: "https://placehold.co/600x600/E0E0E0/333?text=Latex+Gloves", isPrimary: true }],
    },
    {
      sku: "ELEC-POWER-STRIP-6WAY",
      slug: "power-strip-6-way-surge",
      nameEn: "6-Way Power Strip with Surge Protection",
      nameAr: "وصلة كهربائية 6 منافذ مع حماية من الارتفاع",
      descriptionEn: "6-outlet power strip with surge protection and 1.8m cable.",
      descriptionAr: "وصلة 6 مقابس مع حماية من ارتفاع التيار وكابل 1.8 متر.",
      categoryId: elecCat.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 3500, b2cPrice: 65.00, b2bPrice: 52.00, b2bBulkPrice: 44.00, b2bBulkQty: 20,
      listingHealth: 82,
      images: [{ url: "https://placehold.co/600x600/263238/fff?text=Power+Strip", isPrimary: true }],
    },
    {
      sku: "FOOD-COFFEE-ARABICA-1KG",
      slug: "arabica-coffee-beans-1kg",
      nameEn: "Arabica Coffee Beans 1kg - Specialty Grade",
      nameAr: "حبوب القهوة العربية 1 كيلو - درجة متخصصة",
      descriptionEn: "Single-origin Yemeni Arabica coffee beans, specialty grade, medium roast.",
      descriptionAr: "حبوب قهوة عربية يمنية من مصدر واحد، درجة متخصصة، تحميص متوسط.",
      categoryId: foodCat.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.SA, moq: 1,
      stock: 4000, b2cPrice: 185.00, b2bPrice: 155.00, b2bBulkPrice: 135.00, b2bBulkQty: 20,
      listingHealth: 90,
      images: [{ url: "https://placehold.co/600x600/4E342E/fff?text=Coffee+Beans", isPrimary: true }],
    },
    {
      sku: "OFF-DESK-STAND-SIT",
      slug: "standing-desk-electric",
      nameEn: "Electric Height-Adjustable Desk",
      nameAr: "مكتب كهربائي قابل للتعديل الارتفاع",
      descriptionEn: "Electric sit-stand desk with memory settings and cable management tray.",
      descriptionAr: "مكتب كهربائي للوقوف والجلوس مع إعدادات ذاكرة وصينية إدارة كابلات.",
      categoryId: officeCat.id,
      status: ProductStatus.PENDING_REVIEW, isB2C: true, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 150, b2cPrice: 2800.00, b2bPrice: 2450.00,
      listingHealth: 60,
      images: [{ url: "https://placehold.co/600x600/37474F/fff?text=Standing+Desk", isPrimary: true }],
    },
    {
      sku: "INDUS-PIPE-GI-2IN-6M",
      slug: "gi-pipe-2inch-6m",
      nameEn: "Galvanised Iron Pipe 2\" × 6m",
      nameAr: "ماسورة حديد مجلفن 2 بوصة × 6 متر",
      descriptionEn: "BS1387 Medium grade GI pipe for water, gas, and mechanical applications.",
      descriptionAr: "ماسورة حديد مجلفن درجة متوسطة BS1387 للماء والغاز والتطبيقات الميكانيكية.",
      categoryId: buildCat.id,
      status: ProductStatus.ACTIVE, isB2C: false, isB2B: true,
      origin: Country.SA, moq: 20,
      stock: 10000, b2bPrice: 48.00, b2bBulkPrice: 42.00, b2bBulkQty: 100,
      listingHealth: 72,
      images: [{ url: "https://placehold.co/600x600/546E7A/fff?text=GI+Pipe", isPrimary: true }],
    },
    {
      sku: "SAFETY-BOOT-STEEL-42",
      slug: "steel-toe-safety-boot-size-42",
      nameEn: "Steel Toe Safety Boot - Size 42",
      nameAr: "حذاء سلامة بمقدمة فولاذية - مقاس 42",
      descriptionEn: "EN ISO 20345 S3 rated safety boot with steel toe cap and penetration-resistant midsole.",
      descriptionAr: "حذاء سلامة معتمد EN ISO 20345 S3 مع مقدمة فولاذية ونعل مقاوم للاختراق.",
      categoryId: safetyCat.id, brandId: brandHoneywell.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 2200, b2cPrice: 285.00, b2bPrice: 240.00, b2bBulkPrice: 210.00, b2bBulkQty: 20,
      listingHealth: 91,
      images: [{ url: "https://placehold.co/600x600/212121/fff?text=Safety+Boot", isPrimary: true }],
    },
    {
      sku: "ELEC-UPS-600VA",
      slug: "ups-600va-apc",
      nameEn: "UPS 600VA / 360W",
      nameAr: "مزود طاقة لا انقطاعية 600VA / 360W",
      descriptionEn: "Offline UPS 600VA for desktop computers and networking equipment.",
      descriptionAr: "مزود طاقة احتياطي 600VA للكمبيوترات المكتبية ومعدات الشبكات.",
      categoryId: elecCat.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 1800, b2cPrice: 320.00, b2bPrice: 275.00, b2bBulkPrice: 245.00, b2bBulkQty: 10,
      listingHealth: 79,
      images: [{ url: "https://placehold.co/600x600/1A237E/fff?text=UPS+600VA", isPrimary: true }],
    },
    {
      sku: "FOOD-WATER-5GAL",
      slug: "purified-water-5-gallon",
      nameEn: "Purified Water 5 Gallon Bottle",
      nameAr: "زجاجة مياه نقية 5 جالون",
      descriptionEn: "Purified drinking water, 18.9 litres. Ideal for office water dispensers.",
      descriptionAr: "مياه شرب نقية 18.9 لتر. مثالية لأجهزة صرف المياه في المكاتب.",
      categoryId: foodCat.id,
      status: ProductStatus.ACTIVE, isB2C: true, isB2B: true,
      origin: Country.AE, moq: 1,
      stock: 20000, b2cPrice: 12.00, b2bPrice: 9.50, b2bBulkPrice: 7.50, b2bBulkQty: 100,
      listingHealth: 84,
      images: [{ url: "https://placehold.co/600x600/E3F2FD/333?text=Water+Bottle", isPrimary: true }],
    },
  ];

  const createdProducts: { id: string; sku: string }[] = [];

  for (const p of productSeeds) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) { createdProducts.push({ id: existing.id, sku: existing.sku }); continue; }

    const product = await prisma.product.create({
      data: {
        sku: p.sku,
        slug: p.slug,
        nameEn: p.nameEn,
        nameAr: p.nameAr || p.nameEn,
        descriptionEn: p.descriptionEn,
        descriptionAr: p.descriptionAr,
        categoryId: p.categoryId,
        brandId: p.brandId,
        sellerId: seller.id,
        status: p.status,
        isB2CEnabled: p.isB2C,
        isB2BEnabled: p.isB2B,
        origin: p.origin,
        moq: p.moq,
        listingHealth: p.listingHealth,
        images: { create: p.images.map((img, i) => ({ ...img, sortOrder: i })) },
        prices: {
          create: [
            ...(p.b2cPrice ? [{ type: PricingType.B2C, currency: Currency.AED, minQty: 1, price: p.b2cPrice, vatRate: 5 }] : []),
            { type: PricingType.B2B, currency: Currency.AED, minQty: p.moq, maxQty: p.b2bBulkQty ? p.b2bBulkQty - 1 : null, price: p.b2bPrice, vatRate: 5 },
            ...(p.b2bBulkPrice && p.b2bBulkQty ? [{ type: PricingType.B2B, currency: Currency.AED, minQty: p.b2bBulkQty, price: p.b2bBulkPrice, vatRate: 5 }] : []),
          ].filter(pr => pr.price > 0),
        },
      },
    });

    // Inventory stock
    if (p.stock > 0) {
      await prisma.inventoryStock.create({
        data: {
          productId: product.id,
          locationId: sellerLoc.id,
          qty: p.stock,
          reorderPoint: Math.max(10, Math.round(p.stock * 0.05)),
        },
      });
    }

    createdProducts.push({ id: product.id, sku: product.sku });
  }
  console.log(`✅ Products seeded (${createdProducts.length})`);

  // Product issues for demo
  const draftProduct = await prisma.product.findUnique({ where: { sku: "DRAFT-PUMP-DIESEL" } });
  const suppProduct = await prisma.product.findUnique({ where: { sku: "SUPP-HARDHAT-RED" } });
  if (draftProduct) {
    await prisma.productIssue.createMany({
      data: [
        { productId: draftProduct.id, issueType: "MISSING_IMAGES", severity: "ERROR", message: "Product has no images. Add at least 1 image to list.", messageAr: "المنتج ليس له صور. أضف صورة واحدة على الأقل للنشر." },
        { productId: draftProduct.id, issueType: "MISSING_ARABIC_TITLE", severity: "ERROR", message: "Arabic title is missing.", messageAr: "العنوان العربي مفقود." },
        { productId: draftProduct.id, issueType: "NO_PRICE", severity: "ERROR", message: "No price set. Add at least one price tier.", messageAr: "لم يتم تحديد سعر. أضف مستوى سعر واحد على الأقل." },
        { productId: draftProduct.id, issueType: "NO_STOCK", severity: "WARNING", message: "No inventory found for this product.", messageAr: "لا يوجد مخزون لهذا المنتج." },
      ],
      skipDuplicates: true,
    });
  }
  if (suppProduct) {
    await prisma.productIssue.createMany({
      data: [
        { productId: suppProduct.id, issueType: "SUPPRESSED", severity: "ERROR", message: "Product is suppressed due to missing compliance documentation.", messageAr: "تم إيقاف المنتج بسبب نقص وثائق الامتثال." },
        { productId: suppProduct.id, issueType: "MISSING_COMPLIANCE", severity: "WARNING", message: "SASO certificate required for safety equipment sold in KSA.", messageAr: "شهادة SASO مطلوبة لمعدات السلامة المباعة في المملكة." },
      ],
      skipDuplicates: true,
    });
  }

  // Listing health snapshots
  for (const p of productSeeds) {
    const product = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (!product) continue;
    await prisma.listingHealthSnapshot.create({
      data: {
        productId: product.id,
        score: p.listingHealth,
        hasImages: p.images.length > 0,
        hasArabicTitle: !!p.nameAr && p.nameAr.length > 0,
        hasArabicDesc: !!p.descriptionAr,
        hasPrice: p.b2bPrice > 0 || (p.b2cPrice ?? 0) > 0,
        hasStock: p.stock > 0,
        hasCompliance: false,
        isApproved: p.status === ProductStatus.ACTIVE,
        hasBrand: !!p.brandId,
      },
    });
  }

  // ── ORDERS ──────────────────────────────────────────────────────────────────
  const p1 = await prisma.product.findUnique({ where: { sku: "SAFETY-HELM-ANSI-YEL" } });
  const p2 = await prisma.product.findUnique({ where: { sku: "PPE-GLOVES-NITRILE-L" } });
  const p3 = await prisma.product.findUnique({ where: { sku: "OFF-A4-PAPER-80GSM-5R" } });

  const shippingAddr = { label: "Site Office", line1: "Al Quoz Industrial Area 3", city: "Dubai", country: "AE" };

  if (p1 && p2) {
    const orderTotal = (18.5 * 50) * 1.05;
    const order1 = await prisma.order.create({
      data: {
        orderNumber: `MNZ-2026-00001`,
        userId: companyUser.id,
        companyId: company.id,
        type: OrderType.B2B,
        status: OrderStatus.DELIVERED,
        fulfillment: FulfillmentType.SELLER_FULFILLED,
        currency: Currency.AED,
        subtotal: 18.5 * 50,
        vatAmount: (18.5 * 50) * 0.05,
        total: orderTotal,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentStatus: PaymentStatus.PAID,
        shippingAddress: shippingAddr,
        items: {
          create: {
            productId: p1.id,
            sellerId: seller.id,
            sku: p1.sku,
            nameEn: p1.nameEn,
            nameAr: p1.nameAr,
            quantity: 50,
            unitPrice: 18.5,
            vatRate: 5,
            vatAmount: 18.5 * 50 * 0.05,
            total: 18.5 * 50 * 1.05,
          },
        },
        statusHistory: {
          create: [
            { status: OrderStatus.CONFIRMED, message: "Order confirmed" },
            { status: OrderStatus.PROCESSING, message: "Processing" },
            { status: OrderStatus.SHIPPED, message: "Shipped via Aramex", actorId: sellerUser.id },
            { status: OrderStatus.DELIVERED, message: "Delivered to customer" },
          ],
        },
        payments: {
          create: { method: PaymentMethod.BANK_TRANSFER, status: PaymentStatus.PAID, amount: orderTotal, currency: Currency.AED, gatewayRef: "BANK-REF-001", paidAt: new Date() },
        },
        commissions: {
          create: { sellerId: seller.id, amount: orderTotal * 0.05, rate: 5, currency: Currency.AED, settledAt: new Date() },
        },
      },
    });

    // Payout
    await prisma.sellerPayout.create({
      data: {
        sellerId: seller.id,
        amount: orderTotal * 0.95,
        currency: Currency.AED,
        status: PayoutStatus.PAID,
        reference: "PAY-2026-001",
        periodFrom: new Date("2026-01-01"),
        periodTo: new Date("2026-01-31"),
        processedAt: new Date(),
        items: {
          create: {
            orderId: order1.id,
            amount: orderTotal,
            commission: orderTotal * 0.05,
            net: orderTotal * 0.95,
          },
        },
      },
    });
  }

  if (p2) {
    await prisma.order.create({
      data: {
        orderNumber: `MNZ-2026-00002`,
        userId: buyerUser.id,
        type: OrderType.B2C,
        status: OrderStatus.PROCESSING,
        fulfillment: FulfillmentType.SELLER_FULFILLED,
        currency: Currency.AED,
        subtotal: 45.00 * 3,
        vatAmount: 45.00 * 3 * 0.05,
        total: 45.00 * 3 * 1.05,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        paymentStatus: PaymentStatus.PAID,
        shippingAddress: { label: "Home", line1: "Al Barsha 1", city: "Dubai", country: "AE" },
        items: {
          create: {
            productId: p2.id,
            sellerId: seller.id,
            sku: p2.sku,
            nameEn: p2.nameEn,
            nameAr: p2.nameAr,
            quantity: 3,
            unitPrice: 45.00,
            vatRate: 5,
            vatAmount: 45 * 3 * 0.05,
            total: 45 * 3 * 1.05,
          },
        },
        statusHistory: {
          create: [
            { status: OrderStatus.CONFIRMED, message: "Payment received" },
            { status: OrderStatus.PROCESSING, message: "Preparing your order" },
          ],
        },
        payments: {
          create: { method: PaymentMethod.CREDIT_CARD, status: PaymentStatus.PAID, amount: 45 * 3 * 1.05, currency: Currency.AED, gatewayRef: "MOCK-CC-002", paidAt: new Date() },
        },
        commissions: {
          create: { sellerId: seller.id, amount: 45 * 3 * 1.05 * 0.05, rate: 5, currency: Currency.AED },
        },
      },
    });
  }

  if (p3) {
    await prisma.order.create({
      data: {
        orderNumber: `MNZ-2026-00003`,
        userId: companyUser.id,
        companyId: company.id,
        type: OrderType.B2B,
        status: OrderStatus.PENDING_PAYMENT,
        fulfillment: FulfillmentType.SELLER_FULFILLED,
        currency: Currency.AED,
        subtotal: 49.00 * 100,
        vatAmount: 49.00 * 100 * 0.05,
        total: 49.00 * 100 * 1.05,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentStatus: PaymentStatus.UNPAID,
        shippingAddress: shippingAddr,
        items: {
          create: {
            productId: p3.id,
            sellerId: seller.id,
            sku: p3.sku,
            nameEn: p3.nameEn,
            nameAr: p3.nameAr,
            quantity: 100,
            unitPrice: 49.00,
            vatRate: 5,
            vatAmount: 49 * 100 * 0.05,
            total: 49 * 100 * 1.05,
          },
        },
        statusHistory: {
          create: [{ status: OrderStatus.PENDING_PAYMENT, message: "Awaiting bank transfer" }],
        },
      },
    });
  }
  console.log("✅ Orders seeded");

  // ── RFQs ────────────────────────────────────────────────────────────────────
  const rfqProduct = await prisma.product.findUnique({ where: { sku: "BUILD-CEMENT-OPC-50KG" } });
  await prisma.rFQRequest.create({
    data: {
      rfqNumber: "RFQ-2026-001",
      buyerId: companyUser.id,
      companyId: company.id,
      sellerId: seller.id,
      status: RFQStatus.SUBMITTED,
      currency: Currency.AED,
      notes: "Need 5000 bags for Q2 project. Delivery to Abu Dhabi.",
      requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          { nameEn: "OPC Portland Cement 50kg", productId: rfqProduct?.id, quantity: 5000 },
        ],
      },
    },
  });

  await prisma.rFQRequest.create({
    data: {
      rfqNumber: "RFQ-2026-002",
      buyerId: companyUser.id,
      companyId: company.id,
      sellerId: seller.id,
      status: RFQStatus.QUOTED,
      currency: Currency.AED,
      totalQuoted: 37500,
      notes: "Annual supply of safety equipment for 200 workers.",
      items: {
        create: [
          { nameEn: "Safety Helmets", quantity: 200 },
          { nameEn: "Hi-Vis Vests", quantity: 200, unitQuoted: 13.5 },
          { nameEn: "Safety Boots (various sizes)", quantity: 200 },
        ],
      },
    },
  });

  await prisma.rFQRequest.create({
    data: {
      rfqNumber: "RFQ-2026-003",
      buyerId: buyerUser.id,
      status: RFQStatus.DRAFT,
      currency: Currency.AED,
      notes: "Looking for bulk pricing on office supplies.",
      items: {
        create: [
          { nameEn: "A4 Paper Boxes", quantity: 500 },
          { nameEn: "Office Chairs", quantity: 30 },
        ],
      },
    },
  });
  console.log("✅ RFQs seeded");

  // ── MESSAGES ──────────────────────────────────────────────────────────────
  const thread = await prisma.messageThread.create({
    data: {
      sellerId: seller.id,
      buyerId: companyUser.id,
      subject: "RFQ-2026-002: Bulk safety equipment inquiry",
      messages: {
        create: [
          { senderId: companyUser.id, senderType: MessageSenderType.BUYER, body: "Good morning. We need safety equipment for 200 workers for our new project. Can you provide a competitive quote?" },
          { senderId: sellerUser.id, senderType: MessageSenderType.SELLER, body: "Thank you for your inquiry. We can supply all required items. I'll prepare a formal quotation and send it within 24 hours.", isRead: false },
          { senderId: companyUser.id, senderType: MessageSenderType.BUYER, body: "Please also include the SASO certificates for the safety helmets as they are required for the project approval." },
          { senderId: sellerUser.id, senderType: MessageSenderType.SELLER, body: "Understood. All our safety helmets come with SASO certification. I'll include the certificates in the quotation package.", isRead: false },
          { senderId: companyUser.id, senderType: MessageSenderType.BUYER, body: "Perfect. We look forward to receiving your quote.", isRead: false },
        ],
      },
    },
  });
  console.log("✅ Messages seeded");

  // ── SELLER CUSTOMER (CRM) ─────────────────────────────────────────────────
  await prisma.sellerCustomer.upsert({
    where: { sellerId_buyerId: { sellerId: seller.id, buyerId: companyUser.id } },
    update: {},
    create: {
      sellerId: seller.id,
      buyerId: companyUser.id,
      totalOrders: 2,
      totalSpent: 50000,
      currency: Currency.AED,
      lastOrderAt: new Date(),
      tags: ["VIP", "Wholesale", "Construction"],
      notes: "Key account - Emirates Construction Group. Handles large B2B orders.",
      activities: {
        create: [
          { buyerId: companyUser.id, type: "ORDER", orderId: undefined, metadata: { note: "Placed bulk safety equipment order" } },
          { buyerId: companyUser.id, type: "RFQ", metadata: { rfqNumber: "RFQ-2026-002" } },
          { buyerId: companyUser.id, type: "MESSAGE", metadata: { threadId: thread.id } },
        ],
      },
    },
  });
  console.log("✅ CRM seeded");

  // ── AUDIT LOG ─────────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { actorId: adminUser.id, entityType: "SellerProfile", entityId: seller.id, action: AuditAction.APPROVE, after: { status: "ACTIVE" } },
      { actorId: adminUser.id, entityType: "SellerDocument", entityId: seller.id, action: AuditAction.APPROVE },
      { actorId: sellerUser.id, sellerId: seller.id, entityType: "Product", entityId: "product", action: AuditAction.CREATE },
    ],
    skipDuplicates: true,
  });

  // ── PENDING SELLER (for admin review demo) ────────────────────────────────
  const pendingSellerUser = await prisma.user.upsert({
    where: { email: "pending-seller@avenick.test" },
    update: {},
    create: {
      email: "pending-seller@avenick.test",
      passwordHash: await HASH("Password123!"),
      firstName: "Khalid",
      lastName: "Al-Otaibi",
      firstNameAr: "خالد",
      lastNameAr: "العتيبي",
      role: UserRole.SELLER_OWNER,
      status: UserStatus.ACTIVE,
      language: Language.AR,
    },
  });

  await prisma.sellerProfile.upsert({
    where: { userId: pendingSellerUser.id },
    update: {},
    create: {
      userId: pendingSellerUser.id,
      businessNameEn: "Saudi Industrial Corp",
      businessNameAr: "شركة الصناعات السعودية",
      crNumber: "SA-CR-2024-99988",
      type: SellerType.MANUFACTURER,
      country: Country.SA,
      city: "Riyadh",
      tier: SellerTier.STANDARD,
      status: SellerStatus.PENDING_REVIEW,
      documents: {
        create: [
          { type: DocumentType.COMMERCIAL_REGISTRATION, fileUrl: "https://placehold.co/400x600?text=CR+Doc", fileName: "cr-doc.pdf", status: DocumentStatus.PENDING_REVIEW },
          { type: DocumentType.VAT_CERTIFICATE, fileUrl: "https://placehold.co/400x600?text=VAT+Doc", fileName: "vat-doc.pdf", status: DocumentStatus.PENDING_REVIEW },
        ],
      },
    },
  });
  console.log("✅ Pending seller seeded (for admin review)");

  console.log("\n🎉 Seed complete!");
  console.log("─────────────────────────────────────────────────────");
  console.log("  admin@avenick.test          / Password123!");
  console.log("  seller@avenick.test         / Password123!");
  console.log("  buyer@avenick.test          / Password123!");
  console.log("  company@avenick.test        / Password123!");
  console.log("  pending-seller@avenick.test / Password123!");
  console.log("─────────────────────────────────────────────────────");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
