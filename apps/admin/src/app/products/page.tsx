import { requireAdminSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import Image from "next/image";
import Link from "next/link";

export default async function AdminProductsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminSession();
  const pendingCount = await db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } });

  const products = await db.product.findMany({
    where: {
      deletedAt: null,
      status: (searchParams.status as never) ?? "PENDING_REVIEW",
    },
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      seller: { select: { id: true, businessNameEn: true } },
      category: { select: { nameEn: true } },
    },
  });

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Products ({products.length})</h1>
          <div className="flex gap-2">
            {["PENDING_REVIEW", "ACTIVE", "REJECTED", "SUPPRESSED"].map((s) => (
              <Link key={s} href={`/products?status=${s}`} className={`text-xs px-3 py-1.5 rounded-lg border ${(searchParams.status ?? "PENDING_REVIEW") === s ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
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
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20">
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
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "ACTIVE" ? "bg-green-500/10 text-green-700 dark:text-green-400" : p.status === "PENDING_REVIEW" ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>{p.status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.status === "PENDING_REVIEW" && (
                          <>
                            <form action={`/api/admin/products/${p.id}/approve`} method="POST">
                              <button className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg">Approve</button>
                            </form>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && <div className="text-center py-12 text-muted-foreground">No products in this status.</div>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
