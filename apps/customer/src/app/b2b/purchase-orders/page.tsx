import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { Plus, FileCheck2, Clock, CheckCircle2, Truck, XCircle, FileEdit } from "lucide-react";

export const metadata = { title: "Purchase Orders — Avenick for Business" };

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  DRAFT: { label: "Draft", cls: "bg-secondary text-muted-foreground", icon: FileEdit },
  PENDING_APPROVAL: { label: "Pending approval", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  APPROVED: { label: "Approved", cls: "bg-primary/15 text-primary", icon: CheckCircle2 },
  ORDERED: { label: "Ordered", cls: "bg-success/15 text-success", icon: Truck },
  REJECTED: { label: "Rejected", cls: "bg-danger/15 text-danger", icon: XCircle },
};

const POS = [
  { id: "PO-2026-0042", title: "Safety helmets EN397 × 200", requester: "Khalid Omar", dept: "Operations", items: 2, amount: 8400, status: "PENDING_APPROVAL", date: "May 30, 2026" },
  { id: "PO-2026-0041", title: "Nitrile gloves × 500 boxes", requester: "Fatima Hassan", dept: "Medical", items: 1, amount: 19500, status: "APPROVED", date: "May 28, 2026" },
  { id: "PO-2026-0039", title: "Ergonomic office chairs × 15", requester: "Omar Khalil", dept: "HR", items: 1, amount: 12750, status: "ORDERED", date: "May 24, 2026" },
  { id: "PO-2026-0037", title: "CO2 fire extinguishers 5kg × 30", requester: "Sara Al-Nouri", dept: "Facilities", items: 1, amount: 4200, status: "REJECTED", date: "May 21, 2026" },
  { id: "PO-2026-0036", title: "CNC bearing assortment", requester: "Khalid Omar", dept: "Operations", items: 6, amount: 33200, status: "ORDERED", date: "May 18, 2026" },
  { id: "PO-2026-0035", title: "Q3 office supplies restock", requester: "Maryam Ali", dept: "Admin", items: 12, amount: 2680, status: "DRAFT", date: "May 17, 2026" },
];

export default function PurchaseOrdersPage() {
  const open = POS.filter((p) => p.status !== "REJECTED" && p.status !== "ORDERED").length;
  const pending = POS.filter((p) => p.status === "PENDING_APPROVAL").length;
  const monthSpend = POS.filter((p) => p.status === "ORDERED").reduce((s, p) => s + p.amount, 0);

  const stats = [
    { label: "Open POs", value: open, icon: FileCheck2 },
    { label: "Pending approval", value: pending, icon: Clock },
    { label: "Ordered this month", value: formatCurrency(monthSpend, "AED"), icon: Truck },
    { label: "Total POs", value: POS.length, icon: FileEdit },
  ];

  return (
    <B2BShell
      title="Purchase Orders"
      description="Raise, approve and track purchase orders across your organization."
      actions={
        <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">
          <Plus className="h-4 w-4" /> Create PO
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2"><s.icon className="h-4 w-4" /><span className="text-[11px]">{s.label}</span></div>
            <p className="text-xl font-bold font-mono tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* PO table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                {["PO #", "Description", "Requester", "Items", "Amount", "Status", "Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {POS.map((po) => {
                const st = STATUS[po.status]!;
                return (
                  <tr key={po.id} className="hover:bg-secondary/40 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{po.id}</td>
                    <td className="px-4 py-3 max-w-[220px]"><p className="font-medium truncate">{po.title}</p></td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <p>{po.requester}</p>
                      <p className="text-xs">{po.dept}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{po.items}</td>
                    <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">{formatCurrency(po.amount, "AED")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>
                        <st.icon className="h-3 w-3" /> {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{po.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </B2BShell>
  );
}
