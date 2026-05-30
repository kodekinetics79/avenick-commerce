import { db } from "../index";
import type { Product, ProductImage, ProductPrice, InventoryStock, ProductComplianceDocument, ProductStatus } from "@prisma/client";

type ProductWithRelations = Product & {
  images: ProductImage[];
  prices: ProductPrice[];
  inventory: InventoryStock[];
  compliance: ProductComplianceDocument[];
};

interface HealthResult {
  score: number;
  hasImages: boolean;
  hasArabicTitle: boolean;
  hasArabicDesc: boolean;
  hasPrice: boolean;
  hasStock: boolean;
  hasCompliance: boolean;
  isApproved: boolean;
  hasBrand: boolean;
}

export function calculateListingHealth(product: ProductWithRelations): HealthResult {
  const hasImages = product.images.length > 0;
  const hasArabicTitle = !!product.nameAr && product.nameAr.trim().length > 2;
  const hasArabicDesc = !!product.descriptionAr && product.descriptionAr.trim().length > 10;
  const hasPrice = product.prices.some((p) => p.isActive && Number(p.price) > 0);
  const hasStock = product.inventory.some((i) => i.qty - i.reservedQty > 0);
  const hasCompliance = product.compliance.some((c) => c.status === "APPROVED");
  const isApproved = (product.status as ProductStatus) === "ACTIVE";
  const hasBrand = !!product.brandId;
  const hasEnglishDesc = !!product.descriptionEn && product.descriptionEn.trim().length > 10;

  // Weighted scoring
  let score = 0;
  if (hasImages) score += 20;
  if (hasArabicTitle) score += 15;
  if (hasArabicDesc) score += 10;
  if (hasEnglishDesc) score += 5;
  if (hasPrice) score += 20;
  if (hasStock) score += 15;
  if (isApproved) score += 10;
  if (hasBrand) score += 3;
  if (hasCompliance) score += 2;

  return { score: Math.min(score, 100), hasImages, hasArabicTitle, hasArabicDesc, hasPrice, hasStock, hasCompliance, isApproved, hasBrand };
}

export async function refreshProductHealth(productId: string): Promise<number> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { images: true, prices: true, inventory: true, compliance: true },
  });
  if (!product) return 0;

  const health = calculateListingHealth(product);

  await db.$transaction([
    db.product.update({ where: { id: productId }, data: { listingHealth: health.score } }),
    db.listingHealthSnapshot.create({ data: { productId, ...health } }),
  ]);

  return health.score;
}

export async function generateProductIssues(productId: string): Promise<void> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { images: true, prices: true, inventory: true, compliance: true },
  });
  if (!product) return;

  // Clear existing unresolved issues
  await db.productIssue.deleteMany({ where: { productId, resolvedAt: null } });

  type IssueCreate = { productId: string; issueType: string; severity: string; message: string; messageAr?: string };
  const issues: IssueCreate[] = [];

  if (product.images.length === 0) {
    issues.push({ productId, issueType: "MISSING_IMAGES", severity: "ERROR", message: "No product images. Add at least 1 image to activate.", messageAr: "لا توجد صور للمنتج. أضف صورة واحدة على الأقل للتفعيل." });
  }
  if (!product.nameAr || product.nameAr.trim().length < 3) {
    issues.push({ productId, issueType: "MISSING_ARABIC_TITLE", severity: "ERROR", message: "Arabic title is missing or too short.", messageAr: "العنوان العربي مفقود أو قصير جدًا." });
  }
  if (!product.descriptionAr || product.descriptionAr.trim().length < 10) {
    issues.push({ productId, issueType: "MISSING_ARABIC_DESCRIPTION", severity: "WARNING", message: "Arabic description is missing.", messageAr: "الوصف العربي مفقود." });
  }
  if (!product.prices.some((p) => p.isActive && Number(p.price) > 0)) {
    issues.push({ productId, issueType: "NO_PRICE", severity: "ERROR", message: "No price set. Add at least one price tier.", messageAr: "لم يتم تحديد سعر. أضف مستوى سعر واحد على الأقل." });
  }
  if (!product.inventory.some((i) => i.qty - i.reservedQty > 0)) {
    issues.push({ productId, issueType: "NO_STOCK", severity: "WARNING", message: "No available inventory. Update stock to start selling.", messageAr: "لا يوجد مخزون متاح. حدّث المخزون لبدء البيع." });
  }

  if (issues.length > 0) {
    await db.productIssue.createMany({ data: issues as NonNullable<Parameters<typeof db.productIssue.createMany>[0]>["data"], skipDuplicates: true });
  }
}
