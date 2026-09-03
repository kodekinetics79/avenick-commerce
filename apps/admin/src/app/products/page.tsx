import { requireAdminSession } from "@/lib/auth";
import { db, ProductStatus } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import Image from "next/image";
import Link from "next/link";
import { ProductControls } from "./product-controls";

/** Queues an operator works, in the order they are worked. */
const STATUS_TABS: ProductStatus[] = ["PENDING_REVIEW", "ACTIVE", "INACTIVE", "SUPPRESSED", "REJECTED"];

const STATUS_CHIP: Record<ProductStatus, string> = {
  ACTIVE: "bg-green-500/10 text-green-700 dark:text-green-400",
  PENDING_REVIEW: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  INACTIVE: "bg-muted text-muted-foreground",
  DRAFT: "bg-muted text-muted-foreground",
  SUPPRESSED: "bg-red-500/10 text-red-700 dark:text-red-400",
  SUSPENDED: "bg-red-500/10 text-red-700 dark:text-red-400",
  REJECTED: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const PAGE_SIZE = 50;

function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ProductStatus, value);
}

export default async function AdminProductsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminSession();
  // An unknown status is a stale link, not a query to run: fall back to the queue.
  const status: ProductStatus = isProductStatus(searchParams.status) ? searchParams.status : "PENDING_REVIEW";
  const pendingCount = await db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } });

  const where = { deletedAt: null, status } as const;
  const totalInStatus = await db.product.count({ where });
  const products = await db.product.findMany({
    where,
    take: PAGE_SIZE,
    orderBy: { createdAt: "desc" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      seller: { select: { id: true, businessNameEn: true } },
      category: { select: { nameEn: true } },
      // The open suppression reason, so the operator restoring a listing can
      // see why it was taken down without opening the audit trail.
      issues: status === "SUPPRESSED"
        ? { where: { issueType: "SUPPRESSED", resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { message: true, createdAt: true } }
        : false,
    },
  });

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Products ({totalInStatus.toLocaleString()})</h1>
            {totalInStatus > products.length && (
              <p className="text-xs text-muted-foreground">Showing the newest {products.length} of {totalInStatus.toLocaleString()} in this status</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((s) => (
              <Link key={s} href={`/products?status=${s}`} className={`text-xs px-3 py-1.5 rounded-lg border ${status === s ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
                {s.replace(/_/g, " ")}
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Product</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Seller</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Category</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Health</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => {
                  const suppression = Array.isArray(p.issues) ? p.issues[0] : undefined;
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {p.images[0] ? <Image src={p.images[0].url} alt="" width={32} height={32} className="rounded object-cover shrink-0" /> : <div className="w-8 h-8 bg-muted rounded shrink-0" />}
                          <div>
                            <p className="font-medium text-sm">{p.nameEn}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link href={`/sellers/${p.seller.id}`} className="text-primary hover:underline">{p.seller.businessNameEn}</Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.category.nameEn}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="flex gap-0.5 w-12 h-1.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div key={i} className={`flex-1 rounded-full ${i < Math.round(p.listingHealth / 20) ? (p.listingHealth >= 80 ? "bg-green-500" : p.listingHealth >= 60 ? "bg-yellow-500" : "bg-red-500") : "bg-muted"}`} />
                            ))}
                          </div>
                          <span className="text-xs">{p.listingHealth}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CHIP[p.status]}`}>{p.status.replace(/_/g, " ")}</span>
                        {suppression && (
                          <p className="mt-1 max-w-xs text-[11px] text-muted-foreground" title={suppression.message}>
                            Reason: {suppression.message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ProductControls productId={p.id} status={p.status} restoreTarget={p.status === "SUPPRESSED" ? (p.publishedAt ? "ACTIVE" : "DRAFT") : undefined} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {products.length === 0 && <div className="text-center py-12 text-muted-foreground">No products in this status.</div>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
