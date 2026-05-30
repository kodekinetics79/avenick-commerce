import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@manzil/database";
import { Tag, Plus, FolderTree } from "lucide-react";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireAdminSession();

  const categories = await db.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true, children: true } } },
  }).catch(() => []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
            <p className="text-sm text-muted-foreground">{categories.length} top-level categories in the marketplace taxonomy</p>
          </div>
          <button type="button" className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Category
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border shadow-card p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <FolderTree className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold">No categories yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first category to organize the catalog.</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden divide-y divide-border">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Tag className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{c.nameEn}</p>
                    <p className="text-xs text-muted-foreground" dir="rtl">{c.nameAr}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <span>{c._count.children} subcategories</span>
                  <span className="font-semibold text-foreground">{c._count.products} products</span>
                  <button type="button" className="text-primary hover:underline font-medium">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
