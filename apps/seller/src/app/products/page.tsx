import Link from "next/link";
import { requireSellerAnyPermission } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { Plus } from "lucide-react";
import { Button, Dateline, Eyebrow, PageHeader, Surface } from "@avenick/ui";
import { AiAssist } from "@/components/ai-assist";
import { ProductsTable, type ProductRow } from "@/components/products-table";

export default async function ProductsPage({ searchParams }: { searchParams?: { submitted?: string } }) {
  const { seller, membership } = await requireSellerAnyPermission(["catalog.view", "catalog.manage"]);
  const permissions = membership.permissions ?? [];
  const canManage = permissions.includes("*") || (permissions.includes("catalog.manage") && permissions.includes("pricing.manage"));

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
      currency: price?.currency ?? null,
      issueCount: p.issues.length,
      imageUrl: p.images[0]?.url ?? null,
    };
  });

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} issueCount={products.flatMap((p) => p.issues).length} permissions={membership.permissions}>
      <div className="space-y-4">
        <PageHeader
          eyebrow="Catalog"
          title="Products"
          linkComponent={Link}
          // LAW E. The figures in this table are one price row and one stock row
          // per listing, which is not the same thing as the whole commercial
          // record — saying so is what makes the rest of it credible.
          dateline="Every listing on this account · one active price row and one stock row for each, in its own currency and with no conversion applied — a listing priced across several channels or quantity tiers shows only the first of those rows here"
          actions={
            <>
              {canManage && <AiAssist kind="listing" label="AI listing copy" />}
              {canManage && (
                <Button variant="primary" size="sm" asChild>
                  <Link href="/products/new">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add product
                  </Link>
                </Button>
              )}
            </>
          }
        />

        {searchParams?.submitted && (
          // Recessed and toned: this is context about what just happened, not an
          // object to act on.
          <Surface rung={1} tone="success" role="status" className="p-4">
            <Eyebrow className="mb-1">Submitted</Eyebrow>
            <p className="u-body text-ink-1">
              Listing {searchParams.submitted === "updated" ? "changes were" : "was"} submitted for review.
            </p>
            <Dateline className="mt-1">
              It does not become active until an administrator approves it, and appearing on the public storefront is a
              further decision after that.
            </Dateline>
          </Surface>
        )}

        <ProductsTable rows={rows} canManage={canManage} />
      </div>
    </SellerLayout>
  );
}
