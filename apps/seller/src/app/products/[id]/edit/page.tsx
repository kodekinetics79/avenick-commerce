import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { db, type ProductStatus } from "@avenick/database";
import { RECORD_ID } from "@avenick/utils";
import { browserDirectUploadsEnabled } from "@avenick/utils/browser-upload-policy";
import { requireSellerPermission } from "@/lib/auth";
import { sellerHasPermission } from "@/lib/seller-permissions";
import { SellerLayout } from "@/components/layout/seller-layout";
import { ProductForm, type ProductFormOption, type ProductFormValues } from "@/components/products/product-form";
import { loadStatutoryVatTable } from "@/app/products/actions";

export const metadata = { title: "Edit product" };

// Everything on this page is one seller's own row, read at request time.
export const dynamic = "force-dynamic";

/** Typed against the enum so a new status fails the build instead of rendering raw. */
const STATUS_LABEL: Record<ProductStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  PENDING_REVIEW: { label: "Pending review", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  ACTIVE: { label: "Active", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
  SUPPRESSED: { label: "Suppressed", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
  SUSPENDED: { label: "Suspended by platform", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
  REJECTED: { label: "Rejected", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
  INACTIVE: { label: "Inactive", className: "bg-muted text-muted-foreground border-border" },
};

type CategoryRow = { id: string; nameEn: string; parentId: string | null; isActive: boolean };

/**
 * Every ACTIVE category is offered, not just leaves — see the same helper in
 * products/new/page.tsx for the full reasoning. In short: the write path checks
 * only isActive, existing products sit at every depth of the tree, and
 * storefront browsing resolves whole subtrees, so a leaf-only picker would
 * refuse categories the server accepts and hide the one this product has.
 */
function categoryOptions(rows: readonly CategoryRow[]): ProductFormOption[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const labelFor = (row: CategoryRow, depth: number): string => {
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    // parentId has no cycle constraint; the depth guard turns a corrupt cycle
    // into a truncated label instead of a hang.
    if (!parent || depth >= 8) return row.nameEn;
    return `${labelFor(parent, depth + 1)} › ${row.nameEn}`;
  };
  return rows
    .filter((row) => row.isActive)
    .map((row) => ({ value: row.id, label: labelFor(row, 0) }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
}

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const { seller, membership, userRole } = await requireSellerPermission("catalog.manage");

  if (!RECORD_ID.test(params.id)) notFound();

  // Scoped by the session's sellerId, so an id belonging to another seller
  // resolves to nothing — the response is identical to an id that never
  // existed, and never confirms that the row is real.
  const product = await db.product.findFirst({
    where: { id: params.id, sellerId: seller.id, deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      // Product-level rows only, exactly the set updateProduct manages. Variant
      // prices and stock are a different identity this form does not touch, and
      // a deactivated price is history, not something to re-offer for editing.
      prices: {
        where: { variantId: null, isActive: true },
        orderBy: [{ type: "asc" }, { currency: "asc" }, { createdAt: "asc" }],
      },
      inventory: { where: { variantId: null }, select: { qty: true, reservedQty: true } },
      category: { select: { nameEn: true, isActive: true } },
      brand: { select: { nameEn: true, isActive: true } },
    },
  });
  if (!product) notFound();

  const [categories, brands, vatTable] = await Promise.all([
    db.category.findMany({ select: { id: true, nameEn: true, parentId: true, isActive: true } }),
    db.brand.findMany({ where: { isActive: true }, select: { id: true, nameEn: true }, orderBy: { nameEn: "asc" } }),
    loadStatutoryVatTable(),
  ]);

  // Flags decide only which sections render; updateProduct re-derives the
  // capabilities the payload needs and refuses a save it is not entitled to.
  const permissionContext = { user: { role: userRole }, membership };
  const canManagePricing = sellerHasPermission(permissionContext, "pricing.manage");
  const canManageInventory = sellerHasPermission(permissionContext, "inventory.manage");

  // Stock is only settable from one field when it lives in exactly one place.
  // With several rows the form has no way to say which one changes, so it
  // refuses — the same refusal updateProduct makes. There is no seller-portal
  // control that adjusts per-location stock yet, and the form says so.
  const stockIsSplit = product.inventory.length > 1;
  const reservedQty = product.inventory.reduce((sum, row) => sum + row.reservedQty, 0);
  const singleStock = product.inventory.length === 1 ? product.inventory[0] : null;

  const initial: ProductFormValues = {
    sku: product.sku,
    nameEn: product.nameEn,
    // nameAr is NOT NULL in the schema but may be the empty string; it is
    // passed through as stored, never back-filled from nameEn.
    nameAr: product.nameAr,
    descriptionEn: product.descriptionEn ?? "",
    descriptionAr: product.descriptionAr ?? "",
    categoryId: product.categoryId,
    brandId: product.brandId ?? "",
    origin: product.origin ?? "",
    isB2CEnabled: product.isB2CEnabled,
    isB2BEnabled: product.isB2BEnabled,
    moq: String(product.moq),
    tags: product.tags.join(", "),
    // The on-hand figure as stored, so the seller edits the real number. Blank
    // when there is no stock row yet or stock is split across locations.
    stockQty: singleStock ? String(singleStock.qty) : "",
    images: product.images.map((image) => ({ id: image.id, url: image.url, altEn: image.altEn })),
    prices: product.prices.map((row) => ({
      // The row id is what updateProduct matches on, so a product with several
      // quantity tiers in one channel round-trips tier by tier.
      id: row.id,
      type: row.type,
      currency: row.currency,
      // Decimal → string, never through a JS number: the column is exact and
      // the form hands the string straight back to Prisma.Decimal on save.
      price: row.price.toString(),
      minQty: String(row.minQty),
      maxQty: row.maxQty === null ? "" : String(row.maxQty),
      // The rate actually on the row. The form compares it with the statutory
      // rate and warns when they disagree, because checkout will refuse the
      // order until saving corrects it.
      storedVatRate: row.vatRate.toString(),
    })),
  };

  // A category or brand deactivated after this product was created is not in
  // the picker (the server refuses it on save), so say why the field looks
  // empty rather than leaving the seller to guess.
  const staleReferences = [
    product.category.isActive ? null : `Its category “${product.category.nameEn}” has been deactivated — choose another category before saving.`,
    product.brand && !product.brand.isActive ? `Its brand “${product.brand.nameEn}” has been deactivated — choose another brand or leave the brand blank.` : null,
  ].filter((notice): notice is string => notice !== null);

  const status = STATUS_LABEL[product.status];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>
              {status.label}
            </span>
            {product.isPubliclyDiscoverable && (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                On public storefront
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono text-xs">{product.sku}</span> · {product.nameEn}
          </p>
        </div>

        {staleReferences.length > 0 && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <ul className="space-y-1">
              {staleReferences.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </div>
        )}

        {stockIsSplit && (
          <p className="text-sm text-muted-foreground">
            Stock for this product is recorded in {product.inventory.length} locations
            {reservedQty > 0 ? `, with ${reservedQty} unit(s) reserved by open orders` : ""}. It cannot be changed from
            this form, and the seller portal has no per-location stock adjustment yet — the{" "}
            <Link href="/inventory" className="text-primary hover:underline">Inventory</Link> page shows the figures
            read-only.
          </p>
        )}

        <ProductForm
          mode="edit"
          productId={product.id}
          initial={initial}
          categories={categoryOptions(categories)}
          brands={brands.map((brand): ProductFormOption => ({ value: brand.id, label: brand.nameEn }))}
          vatTable={vatTable}
          canManagePricing={canManagePricing}
          canManageInventory={canManageInventory}
          uploadsEnabled={browserDirectUploadsEnabled()}
          currentStatus={product.status}
          reservedQty={reservedQty}
          stockIsSplit={stockIsSplit}
        />
      </div>
    </SellerLayout>
  );
}
