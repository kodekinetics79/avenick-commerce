import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSellerAnyPermission } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { Plus } from "lucide-react";
import { Button, Dateline, Eyebrow, PageHeader, Surface } from "@avenick/ui";
import { AiAssist } from "@/components/ai-assist";
import { ProductsTable, type ProductRow } from "@/components/products-table";

export default async function ProductsPage({ searchParams }: { searchParams?: { submitted?: string } }) {
  const t = await getTranslations("sellerCatalog");
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
          eyebrow={t("list.eyebrow")}
          title={t("list.title")}
          linkComponent={Link}
          // LAW E. The figures in this table are one price row and one stock row
          // per listing, which is not the same thing as the whole commercial
          // record — saying so is what makes the rest of it credible. The whole
          // disclosure travels into `list.dateline`, in both languages.
          dateline={t("list.dateline")}
          actions={
            <>
              {canManage && <AiAssist kind="listing" label={t("list.aiListingCopy")} />}
              {canManage && (
                <Button variant="primary" size="sm" asChild>
                  <Link href="/products/new">
                    <Plus className="h-4 w-4" aria-hidden="true" /> {t("list.addProduct")}
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
            <Eyebrow className="mb-1">{t("submitted.eyebrow")}</Eyebrow>
            <p className="u-body text-ink-1">
              {/* Two whole sentences rather than one with a swapped verb phrase:
                  the clause that changes does not survive being spliced. */}
              {searchParams.submitted === "updated" ? t("submitted.changes") : t("submitted.listing")}
            </p>
            <Dateline className="mt-1">{t("submitted.dateline")}</Dateline>
          </Surface>
        )}

        <ProductsTable rows={rows} canManage={canManage} />
      </div>
    </SellerLayout>
  );
}
