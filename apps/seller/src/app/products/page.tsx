import Link from "next/link";
import Image from "next/image";
import { requireSellerSession } from "@/lib/auth";
import { db } from "@manzil/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { Badge } from "@manzil/ui";
import { formatCurrency } from "@manzil/utils";
import { Plus, AlertTriangle } from "lucide-react";

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : score >= 40 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5 w-16 h-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`flex-1 rounded-full ${i < Math.floor(score / 10) ? color : "bg-gray-200"}`} />
        ))}
      </div>
      <span className="text-xs font-semibold">{score}</span>
    </div>
  );
}

function StatusBadgeLocal({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    DRAFT: "bg-gray-100 text-gray-600",
    PENDING_REVIEW: "bg-blue-100 text-blue-700",
    SUPPRESSED: "bg-red-100 text-red-700",
    REJECTED: "bg-red-100 text-red-700",
    INACTIVE: "bg-gray-100 text-gray-500",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{status.replace(/_/g, " ")}</span>;
}

export default async function ProductsPage() {
  const { seller } = await requireSellerSession();

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

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} issueCount={products.flatMap((p) => p.issues).length}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Products — المنتجات ({products.length})</h1>
          <Link href="/products/new" className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors">
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold text-muted-foreground text-xs uppercase tracking-wide">Product</th>
                  <th className="px-4 py-3 text-start font-semibold text-muted-foreground text-xs uppercase tracking-wide">SKU</th>
                  <th className="px-4 py-3 text-start font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-start font-semibold text-muted-foreground text-xs uppercase tracking-wide">Health</th>
                  <th className="px-4 py-3 text-start font-semibold text-muted-foreground text-xs uppercase tracking-wide">Stock</th>
                  <th className="px-4 py-3 text-start font-semibold text-muted-foreground text-xs uppercase tracking-wide">Price</th>
                  <th className="px-4 py-3 text-start font-semibold text-muted-foreground text-xs uppercase tracking-wide">Issues</th>
                  <th className="px-4 py-3 text-start font-semibold text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => {
                  const stock = p.inventory[0];
                  const available = stock ? stock.qty - stock.reservedQty : 0;
                  const price = p.prices[0];
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-muted">
                            {p.images[0] ? (
                              <Image src={p.images[0].url} alt={p.nameEn} width={40} height={40} className="object-cover w-full h-full" />
                            ) : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">?</div>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[180px]">{p.nameEn}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.nameAr}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.sku}</td>
                      <td className="px-4 py-3"><StatusBadgeLocal status={p.status} /></td>
                      <td className="px-4 py-3"><HealthBar score={p.listingHealth} /></td>
                      <td className="px-4 py-3">
                        <span className={available <= 0 ? "text-red-600 font-semibold" : available <= 10 ? "text-amber-600" : "text-foreground"}>
                          {available}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{price ? formatCurrency(Number(price.price), "AED") : "—"}</td>
                      <td className="px-4 py-3">
                        {p.issues.length > 0 ? (
                          <Link href={`/issues`} className="flex items-center gap-1 text-red-600 hover:underline text-xs">
                            <AlertTriangle className="h-3.5 w-3.5" />{p.issues.length}
                          </Link>
                        ) : <span className="text-green-600 text-xs">✓</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/products/${p.id}/edit`} className="text-xs text-orange-600 hover:underline">Edit</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {products.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No products yet.</p>
                <Link href="/products/new" className="text-orange-600 hover:underline text-sm mt-2 block">Add your first product →</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
