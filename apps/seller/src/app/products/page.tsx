import Link from "next/link";
import { requireSellerAnyPermission } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { Plus } from "lucide-react";
import { AiAssist } from "@/components/ai-assist";
import { ProductsTable, type ProductRow } from "@/components/products-table";
import { countryCommerceDefaults } from "@/lib/product-form";

export default async function ProductsPage({ searchParams }: { searchParams?: { submitted?: string } }) {
  const { seller, membership } = await requireSellerAnyPermission(["catalog.view", "catalog.manage"]);
  const permissions = membership.permissions ?? [];
  const canManage = permissions.includes("*") || (permissions.includes("catalog.manage") && permissions.includes("pricing.manage"));
  const marketDefaults = countryCommerceDefaults(seller.country);

  const products = await db.product.findMany({
    where: { sellerId: seller.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      prices: { where: { isActive: true }, take: 1 },
      inventory: { select: { qty: true, reservedQty: true }, take: 1 },
      category: { select: { nameEn: true } },
      issues: { where: { resolvedAt: null } },
    },
  });

  const rows: ProductRow[] = products.map((p) => {
    const stock = p.inventory[0];
    const price = p.prices[0];
    return {
      id: p.id,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      sku: p.sku,
      status: p.status,
      listingHealth: p.listingHealth,
      available: stock ? stock.qty - stock.reservedQty : 0,
      price: price ? Number(price.price) : null,
      currency: price?.currency ?? marketDefaults.currency,
      issueCount: p.issues.length,
      imageUrl: p.images[0]?.url ?? null,
    };
  });

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} issueCount={products.flatMap((p) => p.issues).length} permissions={membership.permissions}>
      <div className="space-y-4">
        {searchParams?.submitted && (
          <div role="status" className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
            Listing {searchParams.submitted === "updated" ? "changes were" : "was"} submitted for review. It will not become active until an administrator approves it.
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Products <span className="text-muted-foreground font-medium">({products.length})</span></h1>
          <div className="flex items-center gap-2">
            {canManage && <AiAssist kind="listing" label="AI listing copy" />}
            {canManage && <Link href="/products/new" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">
              <Plus className="h-4 w-4" /> Add product
            </Link>}
          </div>
        </div>

        <ProductsTable rows={rows} canManage={canManage} />
      </div>
    </SellerLayout>
  );
}
