import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { fetchB2BJson } from "@/lib/b2b";
import { approvePO, rejectPO, markOrdered, cancelPO } from "./actions";
import { FileCheck2, Clock, CheckCircle2, Truck, XCircle, FileEdit, Building2, Plus, ShoppingCart } from "lucide-react";
import { POActionBanner } from "@/components/b2b/po-action-banner";

export const metadata = { title: "Purchase Orders — Avenick for Business" };

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  DRAFT: { label: "Draft", cls: "bg-secondary text-muted-foreground", icon: FileEdit },
  PENDING_APPROVAL: { label: "Pending approval", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  APPROVED: { label: "Approved", cls: "bg-primary/15 text-primary", icon: CheckCircle2 },
  ORDERED: { label: "Ordered", cls: "bg-success/15 text-success", icon: Truck },
  REJECTED: { label: "Rejected", cls: "bg-danger/15 text-danger", icon: XCircle },
  CANCELLED: { label: "Cancelled", cls: "bg-secondary text-muted-foreground", icon: XCircle },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PurchaseOrdersPage({ searchParams }: { searchParams?: { poDone?: string; poError?: string } }) {
  type PurchaseOrderRow = {
    id: string;
    poNumber: string;
    requesterId: string;
    status: string;
    currency: SupportedCurrency;
    total: string | number;
    notes: string | null;
    requiredDate: string | null;
    createdAt: string;
    items: Array<{ id: string; sku: string; nameEn: string; quantity: number }>;
  };
  type PurchaseOrderData = {
    company: { nameEn: string; country: string };
    isApprover: boolean;
    purchaseOrders: PurchaseOrderRow[];
    requesters: Array<{ id: string; firstName: string; lastName: string }>;
  };

  let data: PurchaseOrderData;
  try {
    data = await fetchB2BJson<PurchaseOrderData>("/api/b2b/purchase-orders");
  } catch {
    return (
      <B2BShell title="Purchase Orders">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No active company account</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in with an active company membership to manage purchase orders.</p>
        </div>
      </B2BShell>
    );
  }

  const pos = data.purchaseOrders;
  const nameOf = new Map(data.requesters.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const isApprover = data.isApprover;
  const open = pos.filter((p) => ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(p.status)).length;
  const pending = pos.filter((p) => p.status === "PENDING_APPROVAL").length;
  const orderedByCurrency = new Map<SupportedCurrency, number>();
  for (const po of pos.filter((row) => row.status === "ORDERED")) {
    orderedByCurrency.set(po.currency, (orderedByCurrency.get(po.currency) ?? 0) + Number(po.total));
  }
  const orderedValue = orderedByCurrency.size === 0
    ? "—"
    : [...orderedByCurrency.entries()].map(([currency, amount]) => formatCurrency(amount, currency)).join(" · ");

  const stats = [
    { label: "Open POs", value: String(open), icon: FileCheck2 },
    { label: "Pending approval", value: String(pending), icon: Clock },
    { label: "Ordered value", value: orderedValue, icon: Truck },
    { label: "Total POs", value: String(pos.length), icon: FileEdit },
  ];

  return (
    <B2BShell title="Purchase Orders" description={`Raise, approve and place governed POs for ${data.company.nameEn}.`}>
      <POActionBanner done={searchParams?.poDone} error={searchParams?.poError} />
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold"><ShoppingCart className="h-4 w-4 text-primary" /> Purchase orders now come from real catalog lines</div>
          <p className="mt-1 text-xs text-muted-foreground">Add products to your cart, then create a company PO. A browser-entered total is never trusted.</p>
        </div>
        <a href="/b2b/purchase-orders/new" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Create PO from cart
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2"><s.icon className="h-4 w-4" /><span className="text-[11px]">{s.label}</span></div>
            <p className="text-lg font-bold font-mono tracking-tight break-words">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {pos.length === 0 ? (
          <div className="p-10 text-center">
            <FileCheck2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No purchase orders yet</p>
            <p className="text-sm text-muted-foreground mt-1">Build your first one from products already in the cart.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  {["PO #", "Lines", "Requester", "Approved value", "Status", "Required", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pos.map((po) => {
                  const st = STATUS[po.status] ?? STATUS.DRAFT!;
                  return (
                    <tr key={po.id} className="hover:bg-secondary/40 transition-colors align-top">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{po.poNumber}</td>
                      <td className="px-4 py-3 min-w-[220px]">
                        {po.items.length === 0 ? (
                          <span className="text-xs font-medium text-danger">Legacy header-only PO — recreate before placement</span>
                        ) : (
                          <div><p className="font-medium">{po.items.length} product line{po.items.length === 1 ? "" : "s"}</p><p className="text-xs text-muted-foreground mt-1 truncate max-w-[280px]">{po.items.slice(0, 3).map((item) => `${item.sku} × ${item.quantity}`).join(" · ")}{po.items.length > 3 ? " …" : ""}</p></div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{nameOf.get(po.requesterId) ?? "—"}</td>
                      <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">{formatCurrency(Number(po.total), po.currency)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}><st.icon className="h-3 w-3" /> {st.label}</span></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{po.requiredDate ? fmtDate(po.requiredDate) : "—"}</td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isApprover && po.status === "PENDING_APPROVAL" && (
                            <>
                              <form action={approvePO.bind(null, po.id)}><button type="submit" className="text-xs font-semibold text-success hover:underline">Approve</button></form>
                              <form action={rejectPO.bind(null, po.id)}><button type="submit" className="text-xs font-medium text-muted-foreground hover:text-danger">Reject</button></form>
                            </>
                          )}
                          {po.status === "APPROVED" && po.items.length > 0 && (
                            <form action={markOrdered.bind(null, po.id)}><button type="submit" className="text-xs font-semibold text-primary hover:underline">Place order</button></form>
                          )}
                          {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(po.status) && (
                            <form action={cancelPO.bind(null, po.id)}><button type="submit" className="text-xs font-medium text-muted-foreground hover:text-danger">Cancel</button></form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </B2BShell>
  );
}
