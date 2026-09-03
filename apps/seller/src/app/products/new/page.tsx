import { db } from "@avenick/database";
import { browserDirectUploadsEnabled } from "@avenick/utils/browser-upload-policy";
import { requireSellerPermission } from "@/lib/auth";
import { sellerHasPermission } from "@/lib/seller-permissions";
import { SellerLayout } from "@/components/layout/seller-layout";
import { platformName } from "@avenick/utils/portal-config";
import { ProductForm, type ProductFormOption, type ProductFormValues } from "@/components/products/product-form";
import { loadStatutoryVatTable } from "@/app/products/actions";

export const metadata = { title: "Add product" };

// The option lists, the capability flags and the upload availability are all
// resolved for the acting seller at request time; nothing here may be
// prerendered or shared between sellers.
export const dynamic = "force-dynamic";

type CategoryRow = { id: string; nameEn: string; parentId: string | null; isActive: boolean };

/**
 * Every ACTIVE category is offered, not just leaves.
 *
 * Category is a tree (parentId), but nothing in the schema or the write path
 * confines a product to a leaf: createProduct's assertCatalogReferences checks
 * only isActive, the seed attaches products directly to top-level categories,
 * and the pilot importer attaches them to second-level children. Storefront
 * browsing resolves the whole active subtree of a category (products.ts), so a
 * product on a parent node is a truthful browse result, not a dead end.
 * Restricting the picker to leaves would refuse a category the server accepts
 * and — on the edit page — hide the category an existing product already has.
 *
 * The label carries the ancestor path so "Gloves" under Safety is
 * distinguishable from "Gloves" under Cleaning. The path is built from the
 * full table (inactive ancestors included) so a live child still reads in
 * context; only active rows become choices.
 */
function categoryOptions(rows: readonly CategoryRow[]): ProductFormOption[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const labelFor = (row: CategoryRow, depth: number): string => {
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    // parentId is a plain nullable column with no cycle constraint; the depth
    // guard turns a corrupt cycle into a truncated label instead of a hang.
    if (!parent || depth >= 8) return row.nameEn;
    return `${labelFor(parent, depth + 1)} › ${row.nameEn}`;
  };
  return rows
    .filter((row) => row.isActive)
    .map((row) => ({ value: row.id, label: labelFor(row, 0) }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
}

/**
 * The blank form. Booleans and MOQ mirror the Product column defaults so that
 * a listing saved untouched is exactly what the database would have defaulted
 * to — the form invents no starting state of its own.
 */
const EMPTY_PRODUCT: ProductFormValues = {
  sku: "",
  nameEn: "",
  nameAr: "",
  descriptionEn: "",
  descriptionAr: "",
  categoryId: "",
  brandId: "",
  origin: "",
  isB2CEnabled: false,
  isB2BEnabled: true,
  moq: "1",
  tags: "",
  stockQty: "",
  images: [],
  prices: [],
};

export default async function NewProductPage() {
  const { seller, membership, userRole } = await requireSellerPermission("catalog.manage");

  // Categories and brands are marketplace-wide taxonomy (neither model carries
  // a sellerId or a deletedAt column), so the only filter that applies is
  // isActive. The VAT table comes from checkout's own jurisdiction resolver,
  // which is the only source a stored rate may truthfully be taken from.
  const [categories, brands, vatTable] = await Promise.all([
    db.category.findMany({ select: { id: true, nameEn: true, parentId: true, isActive: true } }),
    db.brand.findMany({ where: { isActive: true }, select: { id: true, nameEn: true }, orderBy: { nameEn: "asc" } }),
    loadStatutoryVatTable(),
  ]);

  // These flags decide only which sections the form renders. createProduct
  // re-derives the required capabilities from the payload it receives and
  // rejects a save that needs a grant the member does not hold, so a wrong
  // flag here can hide a section but never widen what can be written.
  const permissionContext = { user: { role: userRole }, membership };
  const canManagePricing = sellerHasPermission(permissionContext, "pricing.manage");
  const canManageInventory = sellerHasPermission(permissionContext, "inventory.manage");

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add product</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A new listing is saved as a draft or submitted for review. It is not shown to buyers until a {platformName()}
            approver activates it, and whether it appears on the public storefront is a separate admin decision.
          </p>
        </div>

        <ProductForm
          mode="create"
          initial={EMPTY_PRODUCT}
          categories={categoryOptions(categories)}
          brands={brands.map((brand): ProductFormOption => ({ value: brand.id, label: brand.nameEn }))}
          vatTable={vatTable}
          canManagePricing={canManagePricing}
          canManageInventory={canManageInventory}
          uploadsEnabled={browserDirectUploadsEnabled()}
        />
      </div>
    </SellerLayout>
  );
}
