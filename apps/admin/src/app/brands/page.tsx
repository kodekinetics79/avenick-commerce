import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { Award, Search, Package } from "lucide-react";

export const metadata = { title: "Brands" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { search?: string };
}

export default async function BrandsPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const search = searchParams.search?.trim() || undefined;
  const brands = await db.brand.findMany({
    where: search
      ? {
          OR: [
            { nameEn: { contains: search, mode: "insensitive" } },
            { nameAr: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { nameEn: "asc" },
    include: { _count: { select: { products: { where: { deletedAt: null } } } } },
  });
  const totalProducts = brands.reduce((s, b) => s + b._count.products, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
            <p className="text-sm text-muted-foreground">
              {brands.length} brand{brands.length === 1 ? "" : "s"} · {totalProducts.toLocaleString()} products across the catalog
            </p>
          </div>
        </div>

        <form method="get" action="/brands" className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search brands…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </form>

        {brands.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border px-4 py-16 text-center">
            <Award className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? "No brands match your search." : "No brands in the catalog yet. Brands are created as sellers list branded products."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {brands.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Award className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${b.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-muted-foreground"}`}>
                    {b.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="font-semibold text-sm">{b.nameEn}</p>
                {b.nameAr && <p className="text-xs text-muted-foreground">{b.nameAr}</p>}
                <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1">
                  <Package className="h-3 w-3" /> {b._count.products} product{b._count.products === 1 ? "" : "s"}
                  {b.country && <span>· {b.country}</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
