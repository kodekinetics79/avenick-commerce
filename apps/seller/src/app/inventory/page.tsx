import { requireSellerAnyPermission } from "@/lib/auth";
import { getSellerInventory } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";

export default async function InventoryPage() {
  const { seller, membership } = await requireSellerAnyPermission(["inventory.view", "inventory.manage"]);
  const stocks = await getSellerInventory(seller.id, { limit: 100 });

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Inventory — المخزون</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />OK</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" />Low</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Out</span>
          </div>
        </div>

        {stocks.filter((s) => s.isLow || s.isOut).length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
                {stocks.filter((s) => s.isOut).length > 0 && `${stocks.filter((s) => s.isOut).length} product(s) out of stock. `}
                {stocks.filter((s) => s.isLow && !s.isOut).length > 0 && `${stocks.filter((s) => s.isLow && !s.isOut).length} product(s) below reorder point.`}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Replenish stock to avoid missed orders and listing suppression.</p>
            </div>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Product</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Warehouse</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">On Hand</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Reserved</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Available</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Reorder</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stocks.map((s) => (
                  <tr key={s.id} className={`hover:bg-muted/20 ${s.isOut ? "bg-red-500/10" : s.isLow ? "bg-yellow-500/10" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.product?.images[0] && (
                          <Image src={s.product.images[0].url} alt="" width={32} height={32} className="rounded object-cover shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{s.product?.nameEn}</p>
                          <p className="text-xs text-muted-foreground font-mono">{s.product?.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.location.warehouse.nameEn}
                      <span className="ms-1 text-xs bg-muted px-1.5 py-0.5 rounded">{s.location.code}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{s.qty}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.reservedQty}</td>
                    <td className="px-4 py-3 font-bold">{s.available}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.reorderPoint}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.isOut ? "bg-red-500/10 text-red-600 dark:text-red-400" : s.isLow ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "bg-green-500/10 text-green-600 dark:text-green-400"}`}>
                        {s.isOut ? "Out of Stock" : s.isLow ? "Low Stock" : "OK"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stocks.length === 0 && <div className="text-center py-12 text-muted-foreground">No inventory records found.</div>}
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
