import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { createPO, approvePO, rejectPO, markOrdered, cancelPO } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { FileCheck2, Clock, CheckCircle2, Truck, XCircle, FileEdit, Building2, Plus } from "lucide-react";

export const metadata = { title: "Purchase Orders — Avenick for Business" };

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  DRAFT: { label: "Draft", cls: "bg-secondary text-muted-foreground", icon: FileEdit },
  PENDING_APPROVAL: { label: "Pending approval", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  APPROVED: { label: "Approved", cls: "bg-primary/15 text-primary", icon: CheckCircle2 },
  ORDERED: { label: "Ordered", cls: "bg-success/15 text-success", icon: Truck },
  REJECTED: { label: "Rejected", cls: "bg-danger/15 text-danger", icon: XCircle },
  CANCELLED: { label: "Cancelled", cls: "bg-secondary text-muted-foreground", icon: XCircle },
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PurchaseOrdersPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Purchase Orders">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No company account</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in with a company account to manage purchase orders.</p>
        </div>
      </B2BShell>
    );
  }

  const pos = await db.purchaseOrder.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const reqIds = [...new Set(pos.map((p) => p.requesterId))];
  const users = await db.user.findMany({ where: { id: { in: reqIds } }, select: { id: true, firstName: true, lastName: true } });
  const nameOf = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const isApprover = ["COMPANY_ADMIN", "COMPANY_APPROVER"].includes(ctx.member.role);

  const open = pos.filter((p) => ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(p.status)).length;
  const pending = pos.filter((p) => p.status === "PENDING_APPROVAL").length;
  const ordered = pos.filter((p) => p.status === "ORDERED").reduce((s, p) => s + Number(p.total), 0);
  const stats = [
    { label: "Open POs", value: open, icon: FileCheck2 },
    { label: "Pending approval", value: pending, icon: Clock },
    { label: "Ordered value", value: formatCurrency(ordered, "AED"), icon: Truck },
    { label: "Total POs", value: pos.length, icon: FileEdit },
  ];

  return (
    <B2BShell title="Purchase Orders" description={`Raise, approve and track POs for ${ctx.company.nameEn}.`}>
      {/* Create */}
      <ValidatedForm action={createPO} className="rounded-2xl border border-border bg-card p-5 mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold mb-4"><Plus className="h-4 w-4 text-primary" /> Raise a purchase order</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input name="description" required placeholder="Description (e.g. Safety helmets × 200)" className="lg:col-span-2 h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <input name="total" type="number" required placeholder="Total (AED)" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex gap-2">
            <input name="requiredDate" type="date" aria-label="Required by" className="flex-1 h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring" />
            <button type="submit" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">Create</button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">POs above an active approval-policy threshold route to approval automatically.</p>
      </ValidatedForm>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2"><s.icon className="h-4 w-4" /><span className="text-[11px]">{s.label}</span></div>
            <p className="text-xl font-bold font-mono tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {pos.length === 0 ? (
          <div className="p-10 text-center">
            <FileCheck2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No purchase orders yet</p>
            <p className="text-sm text-muted-foreground mt-1">Raise your first PO with the form above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  {["PO #", "Description", "Requester", "Total", "Status", "Required", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pos.map((po) => {
                  const st = STATUS[po.status] ?? STATUS.DRAFT!;
                  return (
                    <tr key={po.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{po.poNumber}</td>
                      <td className="px-4 py-3 max-w-[220px]"><p className="font-medium truncate">{po.notes ?? "—"}</p></td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{nameOf.get(po.requesterId) ?? "—"}</td>
                      <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">{formatCurrency(Number(po.total), "AED")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}><st.icon className="h-3 w-3" /> {st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{po.requiredDate ? fmtDate(po.requiredDate) : "—"}</td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isApprover && po.status === "PENDING_APPROVAL" && (
                            <>
                              <form action={approvePO.bind(null, po.id)}><button type="submit" className="text-xs font-semibold text-success hover:underline">Approve</button></form>
                              <form action={rejectPO.bind(null, po.id)}><button type="submit" className="text-xs font-medium text-muted-foreground hover:text-danger">Reject</button></form>
                            </>
                          )}
                          {po.status === "APPROVED" && (
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
