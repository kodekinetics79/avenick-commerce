import Link from "next/link";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { ListChecks, RotateCcw, Plus, Zap, Star, ShoppingCart } from "lucide-react";

export const metadata = { title: "Requisition Lists — Avenick for Business" };

const LISTS = [
  { id: "l1", name: "Monthly PPE restock", items: 14, total: 8650, lastOrdered: "3 weeks ago", favorite: true, owner: "Operations" },
  { id: "l2", name: "Site B consumables", items: 22, total: 4120, lastOrdered: "1 week ago", favorite: true, owner: "Facilities" },
  { id: "l3", name: "Office supplies — HQ", items: 31, total: 2680, lastOrdered: "2 months ago", favorite: false, owner: "Admin" },
  { id: "l4", name: "Medical stockroom", items: 9, total: 19500, lastOrdered: "5 days ago", favorite: false, owner: "Medical" },
];

export default function RequisitionListsPage() {
  return (
    <B2BShell
      title="Requisition Lists"
      description="Save recurring baskets and re-order in one click, or add items fast by SKU."
      actions={
        <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">
          <Plus className="h-4 w-4" /> New list
        </button>
      }
    >
      {/* Quick order pad */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold mb-1"><Zap className="h-4 w-4 text-primary" /> Quick order</div>
        <p className="text-xs text-muted-foreground mb-4">Know your SKUs? Add them straight to cart — paste a list or type below.</p>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_auto] gap-2">
              <input placeholder="SKU or product code" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
              <input placeholder="Qty" type="number" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
              <button className="h-10 w-10 grid place-items-center rounded-xl border border-border text-muted-foreground hover:bg-secondary transition-colors" aria-label="Add row"><Plus className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"><ShoppingCart className="h-4 w-4" /> Add to cart</button>
          <button className="h-10 px-4 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">Upload CSV</button>
        </div>
      </div>

      {/* Saved lists */}
      <div className="grid sm:grid-cols-2 gap-4">
        {LISTS.map((l) => (
          <div key={l.id} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0"><ListChecks className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="font-semibold truncate flex items-center gap-1.5">{l.name}{l.favorite && <Star className="h-3.5 w-3.5 text-amber-400 fill-current shrink-0" />}</p>
                  <p className="text-xs text-muted-foreground">{l.items} items · {l.owner}</p>
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between mt-4">
              <div>
                <p className="text-lg font-bold font-mono tracking-tight">{formatCurrency(l.total, "AED")}</p>
                <p className="text-[11px] text-muted-foreground">Last ordered {l.lastOrdered}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/products" className="text-xs font-medium text-muted-foreground hover:text-foreground">View</Link>
                <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-[0.98]">
                  <RotateCcw className="h-3.5 w-3.5" /> Reorder
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </B2BShell>
  );
}
