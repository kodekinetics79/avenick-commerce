import type { ReactNode } from "react";
import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { Tag, FolderTree, CornerDownRight } from "lucide-react";
import { CategoryForm, type CategoryOption } from "./category-form";

export const metadata = { title: "Categories" };

type CategoryRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number; children: number };
};

export default async function CategoriesPage() {
  await requireAdminSession();

  // The whole tree is small and the form needs every node to offer valid
  // parents, so one query serves both the listing and the selects.
  // No .catch(() => []): a failed read must surface as an error, not render
  // as the honest-looking "No categories yet" empty state.
  const categories: CategoryRow[] = await db.category
    .findMany({
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        slug: true,
        parentId: true,
        sortOrder: true,
        isActive: true,
        _count: { select: { products: true, children: true } },
      },
    });

  const options: CategoryOption[] = categories.map((c) => ({ id: c.id, nameEn: c.nameEn, parentId: c.parentId }));
  const byParent = new Map<string | null, CategoryRow[]>();
  for (const category of categories) {
    const list = byParent.get(category.parentId) ?? [];
    list.push(category);
    byParent.set(category.parentId, list);
  }
  const topLevel = byParent.get(null) ?? [];

  const renderRow = (c: CategoryRow, depth: number, seen: Set<string>): ReactNode => {
    if (seen.has(c.id)) return null;
    seen.add(c.id);
    const children = byParent.get(c.id) ?? [];
    return (
      <div key={c.id}>
        {/* flex-wrap so the edit form, when opened, takes a full line under the row */}
        <div className={`flex flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-secondary/40 transition-colors ${depth > 0 ? "bg-secondary/20" : ""}`}>
          <div className="flex items-center gap-3 min-w-0" style={{ paddingInlineStart: `${depth * 1.5}rem` }}>
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {depth > 0 ? <CornerDownRight className="h-4 w-4 text-primary" /> : <Tag className="h-4 w-4 text-primary" />}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm flex items-center gap-2">
                <span className="truncate">{c.nameEn}</span>
                {!c.isActive && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>}
              </p>
              <p className="text-xs text-muted-foreground" dir="rtl">{c.nameAr}</p>
              <p className="text-[11px] text-muted-foreground font-mono">/{c.slug}</p>
            </div>
          </div>
          <div className="ms-auto flex items-center gap-6 text-xs text-muted-foreground shrink-0">
            <span>{c._count.children} subcategories</span>
            <span className="font-semibold text-foreground">{c._count.products} products</span>
          </div>
          <CategoryForm mode="edit" category={c} options={options} />
        </div>
        {children.map((child) => renderRow(child, depth + 1, seen))}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
            <p className="text-sm text-muted-foreground">
              {topLevel.length} top-level {topLevel.length === 1 ? "category" : "categories"}, {categories.length} in total
            </p>
          </div>
          <div className="w-full max-w-2xl flex justify-end">
            <CategoryForm mode="create" options={options} />
          </div>
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
            {topLevel.map((c) => renderRow(c, 0, new Set()))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
