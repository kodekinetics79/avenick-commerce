import type { ReactNode } from "react";
import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { Tag, FolderTree, CornerDownRight } from "lucide-react";
import { EmptyState, Eyebrow, PageHeader, StatusPill, Surface } from "@avenick/ui";
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

  /**
   * Flattened depth-first before rendering, because the rule BETWEEN rows is a
   * property of the list and not of a nesting wrapper. Rendered as nested divs,
   * `last:border-b-0` matched every row that happened to be the last child of
   * its own wrapper — which is every leaf, which in a flat tree is every row —
   * and the hairlines vanished. One `seen` set for the whole walk also stops a
   * malformed parent chain from recursing forever.
   */
  const walk = (nodes: CategoryRow[], depth: number, seen: Set<string>, out: Array<{ category: CategoryRow; depth: number }>) => {
    for (const node of nodes) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      out.push({ category: node, depth });
      walk(byParent.get(node.id) ?? [], depth + 1, seen, out);
    }
    return out;
  };
  const reached = new Set<string>();
  const rows = walk(topLevel, 0, reached, []);
  // A category whose parent is not in this read — a broken or cycled parentId —
  // is never reached by the walk, so it would silently vanish from a page whose
  // header claims to show the whole tree. It is appended at the root instead: a
  // console that quietly drops a record is worse than one that shows an odd one.
  for (const category of categories) {
    if (!reached.has(category.id)) rows.push({ category, depth: 0 });
  }

  const renderRow = ({ category: c, depth }: { category: CategoryRow; depth: number }): ReactNode => {
    return (
      <div
        key={c.id}
        /* flex-wrap so the edit form, when opened, takes a full line under the row.
           Depth is carried by the indent and the turn mark alone: the old version
           also tinted every child row, which made a three-level tree read as three
           different kinds of object rather than one list at three depths. */
        className="u-ledger-row flex flex-wrap items-center gap-4 border-b border-b-hairline px-4 py-3 last:border-b-0"
      >
        <div className="flex min-w-0 items-start gap-2" style={{ paddingInlineStart: `${depth * 1.5}rem` }}>
          {depth > 0 ? (
            // A direction-implying glyph, so it flips in Arabic.
            <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3 rtl:-scale-x-100" aria-hidden="true" />
          ) : (
            <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="u-ui flex items-center gap-2 font-medium text-ink-1">
              <span className="truncate">{c.nameEn}</span>
              {!c.isActive && <StatusPill tone="neutral">Inactive</StatusPill>}
            </p>
            <p className="u-meta text-ink-2" dir="rtl">{c.nameAr}</p>
            {/* A slug is a URL segment the storefront keeps forever: an identifier. */}
            <p className="u-meta u-mono text-ink-3">/{c.slug}</p>
          </div>
        </div>
        <dl className="ms-auto flex shrink-0 items-start gap-6">
          <div>
            <dt><Eyebrow>Subcategories</Eyebrow></dt>
            <dd className="u-ui tnum text-ink-2">{c._count.children}</dd>
          </div>
          <div>
            <dt><Eyebrow>Products</Eyebrow></dt>
            <dd className="u-ui tnum text-ink-1">{c._count.products}</dd>
          </div>
        </dl>
        <CategoryForm mode="edit" category={c} options={options} />
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Catalogue structure"
          title="Categories"
          description={`${topLevel.length} top-level ${topLevel.length === 1 ? "category" : "categories"}, ${categories.length} in total.`}
          dateline="The whole tree, ordered by sort order then English name · a slug is the storefront URL and does not change on its own"
        />

        {/* The create form expands to a full line when it opens, so it lives on
            its own row rather than inside the header's action slot. */}
        <div className="flex flex-wrap justify-end">
          <CategoryForm mode="create" options={options} />
        </div>

        {categories.length === 0 ? (
          <Surface rung={1}>
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No categories have been created yet."
              body="The storefront navigation and every product listing are organised by this tree, so it is the first thing to build."
              icon={<FolderTree className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          </Surface>
        ) : (
          <Surface rung={1} className="overflow-hidden">
            {rows.map(renderRow)}
          </Surface>
        )}
      </div>
    </AdminLayout>
  );
}
