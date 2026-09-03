import { B2BShell } from "@/components/b2b/b2b-shell";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { createList, deleteList, addItem, removeItem } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { ReorderButton } from "@/components/b2b/reorder-button";
import { ListChecks, Plus, Trash2, X, Building2 } from "lucide-react";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = { title: `Requisition Lists — ${platformName()} for Business` };

export default async function RequisitionListsPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Requisition Lists">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No company account</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in with a company account to manage requisition lists.</p>
        </div>
      </B2BShell>
    );
  }

  const lists = await db.requisitionList.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: { select: { sellerId: true } } }, orderBy: { createdAt: "asc" } } },
  });

  return (
    <B2BShell title="Requisition Lists" description="Save recurring baskets and re-order them in one click.">
      {/* Create list */}
      <ValidatedForm action={createList} className="rounded-2xl border border-border bg-card p-5 mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold mb-4"><Plus className="h-4 w-4 text-primary" /> New list</div>
        <div className="flex gap-2 max-w-md">
          <input name="name" required placeholder="List name (e.g. Monthly PPE restock)" className="flex-1 h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <button type="submit" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">Create</button>
        </div>
      </ValidatedForm>

      {lists.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <ListChecks className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No lists yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create a list above, then add items by SKU to re-order them later.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {lists.map((l) => {
            const reorderItems = l.items.filter((it) => it.productId != null).map((it) => ({
              productId: it.productId!,
              sku: it.sku,
              nameEn: it.nameEn,
              qty: it.qty,
            }));
            return (
              <div key={l.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0"><ListChecks className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.items.length} item{l.items.length !== 1 ? "s" : ""} · repriced when reordered</p>
                    </div>
                  </div>
                  <form action={deleteList.bind(null, l.id)}>
                    <button type="submit" className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-danger transition-colors" aria-label="Delete list"><Trash2 className="h-4 w-4" /></button>
                  </form>
                </div>

                {/* Items */}
                {l.items.length > 0 && (
                  <ul className="divide-y divide-border border-y border-border mb-3">
                    {l.items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{it.nameEn}</p>
                          <p className="text-xs text-muted-foreground font-mono">{it.sku} · ×{it.qty}</p>
                        </div>
                        <form action={removeItem.bind(null, it.id)}>
                          <button type="submit" className="p-1 rounded-md text-muted-foreground hover:text-danger transition-colors" aria-label="Remove item"><X className="h-3.5 w-3.5" /></button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add item */}
                <form action={addItem.bind(null, l.id)} className="grid grid-cols-[1fr_70px_auto] gap-2 mb-3">
                  <input name="sku" required placeholder="Add by SKU" className="h-9 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                  <input name="qty" type="number" min={1} defaultValue={1} aria-label="Quantity" className="h-9 px-2 text-sm rounded-xl bg-secondary/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring" />
                  <button type="submit" className="h-9 w-9 grid place-items-center rounded-xl border border-border text-muted-foreground hover:bg-secondary transition-colors" aria-label="Add item"><Plus className="h-4 w-4" /></button>
                </form>

                <div className="flex justify-end">
                  <ReorderButton items={reorderItems} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </B2BShell>
  );
}
