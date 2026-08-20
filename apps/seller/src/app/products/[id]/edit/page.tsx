import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { ProductForm } from "@/components/product-form";
import { requireSellerPermissions } from "@/lib/auth";
import { countryCommerceDefaults } from "@/lib/product-form";

export const metadata = { title: "Edit Product" };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const { seller, membership } = await requireSellerPermissions(["catalog.manage", "pricing.manage"]);
  const [product, categories] = await Promise.all([
    db.product.findFirst({
      where: { id: params.id, sellerId: seller.id, deletedAt: null },
      include: { images: { where: { isPrimary: true }, take: 1 }, prices: { where: { isActive: true }, orderBy: { minQty: "asc" } } },
    }),
    db.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }], select: { id: true, nameEn: true } }),
  ]);
  if (!product) notFound();
  const defaults = countryCommerceDefaults(seller.country);
  const b2b = product.prices.find((price) => price.type === "B2B");
  const b2c = product.prices.find((price) => price.type === "B2C");
  const commercial = b2b ?? b2c;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="mx-auto max-w-4xl space-y-5">
        <Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Products</Link>
        <div>
          <h1 className="text-2xl font-bold">Edit product</h1>
          <p className="text-sm text-muted-foreground">Saving changes returns the listing to review; it is never self-activated.</p>
        </div>
        <ProductForm
          productId={product.id}
          categories={categories}
          initial={{
            categoryId: product.categoryId,
            sku: product.sku,
            nameEn: product.nameEn,
            nameAr: product.nameAr,
            descriptionEn: product.descriptionEn ?? "",
            descriptionAr: product.descriptionAr ?? "",
            imageUrl: product.images[0]?.url ?? "",
            origin: product.origin ?? "",
            moq: product.moq,
            currency: commercial?.currency ?? defaults.currency,
            vatRate: Number(commercial?.vatRate ?? defaults.vatRate),
            b2bEnabled: product.isB2BEnabled,
            b2cEnabled: product.isB2CEnabled,
            b2bPrice: b2b ? String(b2b.price) : "",
            b2cPrice: b2c ? String(b2c.price) : "",
          }}
        />
      </div>
    </SellerLayout>
  );
}
