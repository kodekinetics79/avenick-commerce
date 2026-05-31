import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_BRANDS } from "@avenick/database";
import { Award, Plus, Search, Package } from "lucide-react";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  await requireAdminSession();
  const totalProducts = MOCK_BRANDS.reduce((s, b) => s + b.productCount, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
            <p className="text-sm text-muted-foreground">{MOCK_BRANDS.length} brands · {totalProducts.toLocaleString()} products across the catalog</p>
          </div>
          <button type="button" className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Brand
          </button>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input type="text" placeholder="Search brands…" className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MOCK_BRANDS.map((b) => (
            <div key={b.id} className="bg-card rounded-2xl border border-border shadow-card p-4 hover:shadow-elevated transition-shadow">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm mb-3 ${b.color}`}>
                {b.name.charAt(0)}
              </div>
              <p className="font-semibold text-sm">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.country}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Package className="h-3 w-3" /> {b.productCount} products
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
