import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { ProductForm } from "@/components/product-form";
import { requireSellerPermissions } from "@/lib/auth";
import { countryCommerceDefaults } from "@/lib/product-form";

export const metadata = { title: "Add Product" };

export default async function NewProductPage() {
  const { seller, membership } = await requireSellerPermissions(["catalog.manage", "pricing.manage"]);
  const categories = await db.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }], select: { id: true, nameEn: true } });
  const defaults = countryCommerceDefaults(seller.country);

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="mx-auto max-w-4xl space-y-5">
        <Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Products</Link>
        <div>
          <h1 className="text-2xl font-bold">Add product</h1>
          <p className="text-sm text-muted-foreground">Create a seller-owned listing and submit it for governed review.</p>
        </div>
        {categories.length === 0 ? (
          <div role="alert" className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">No active categories are available. Contact Avenick before creating a listing.</div>
        ) : (
          <ProductForm categories={categories} initial={{ categoryId: "", sku: "", nameEn: "", nameAr: "", descriptionEn: "", descriptionAr: "", imageUrl: "", origin: seller.country, moq: 1, currency: defaults.currency, vatRate: defaults.vatRate, b2bEnabled: true, b2cEnabled: false, b2bPrice: "", b2cPrice: "" }} />
        )}
      </div>
    </SellerLayout>
  );
}
