import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { Download, FileText, CreditCard, CheckCircle2, Clock, AlertTriangle, Building2 } from "lucide-react";

export const metadata = { title: "Billing & Invoices — Avenick for Business" };

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function BillingPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Billing & Invoices">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No company account</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in with a company account to view billing.</p>
        </div>
      </B2BShell>
    );
  }

  const terms = ctx.company.paymentTerms ?? 30;
  const invoices = await db.taxInvoice.findMany({
    where: { order: { companyId: ctx.companyId } },
    include: { order: { include: { purchaseOrder: { select: { poNumber: true } } } } },
    orderBy: { issuedAt: "desc" },
  });

  const now = new Date();
  const rows = invoices.map((inv) => {
    const due = new Date(inv.issuedAt.getTime() + terms * 86400000);
    const paid = inv.order.paymentStatus === "PAID";
    const overdue = !paid && due < now;
    const daysOverdue = overdue ? Math.floor((now.getTime() - due.getTime()) / 86400000) : 0;
    return { inv, due, paid, overdue, daysOverdue, total: Number(inv.totalAmount), vat: Number(inv.vatAmount) };
  });

  const limit = Number(ctx.company.creditLimit ?? 0);
  const outstanding = rows.filter((r) => !r.paid).reduce((s, r) => s + r.total, 0);
  const available = Math.max(0, limit - outstanding);
  const usedPct = limit > 0 ? Math.round((outstanding / limit) * 100) : 0;

  const aging = [
    { label: "Current", value: rows.filter((r) => !r.paid && !r.overdue).reduce((s, r) => s + r.total, 0), cls: "text-success" },
    { label: "1–30 days", value: rows.filter((r) => r.daysOverdue > 0 && r.daysOverdue <= 30).reduce((s, r) => s + r.total, 0), cls: "text-foreground" },
    { label: "31–60 days", value: rows.filter((r) => r.daysOverdue > 30 && r.daysOverdue <= 60).reduce((s, r) => s + r.total, 0), cls: "text-amber-600 dark:text-amber-400" },
    { label: "60+ days", value: rows.filter((r) => r.daysOverdue > 60).reduce((s, r) => s + r.total, 0), cls: "text-danger" },
  ];

  return (
    <B2BShell
      title="Billing & Invoices"
      description={`Credit terms, balance and tax invoices for ${ctx.company.nameEn}.`}
      actions={
        <button type="button" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-secondary transition-colors">
          <Download className="h-4 w-4" /> Download statement
        </button>
      }
    >
      {/* Credit + outstanding */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold mb-4"><CreditCard className="h-4 w-4 text-primary" /> Credit line · NET {terms}</div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><p className="text-xs text-muted-foreground">Limit</p><p className="text-xl font-bold font-mono">{formatCurrency(limit, "AED")}</p></div>
            <div><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-xl font-bold font-mono">{formatCurrency(outstanding, "AED")}</p></div>
            <div><p className="text-xs text-muted-foreground">Available</p><p className="text-xl font-bold font-mono text-success">{formatCurrency(available, "AED")}</p></div>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${Math.min(usedPct, 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{usedPct}% of credit utilized</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Outstanding balance</p>
          <p className="text-3xl font-bold font-mono tracking-tight mt-1">{formatCurrency(outstanding, "AED")}</p>
          <button type="button" className="mt-4 w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98] disabled:opacity-50" disabled={outstanding === 0}>Pay now</button>
        </div>
      </div>

      {/* Aging */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {aging.map((a) => (
          <div key={a.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground">{a.label}</p>
            <p className={`text-lg font-bold font-mono mt-1 ${a.cls}`}>{formatCurrency(a.value, "AED")}</p>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-muted-foreground" /> Tax invoices</div>
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No invoices yet</p>
            <p className="text-sm text-muted-foreground mt-1">Placing an approved purchase order generates a tax invoice here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  {["Invoice #", "PO", "Issued", "Due", "Amount", "VAT", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ inv, due, paid, overdue, total, vat }) => {
                  const st = paid
                    ? { label: "Paid", cls: "bg-success/15 text-success", icon: CheckCircle2 }
                    : overdue
                    ? { label: "Overdue", cls: "bg-danger/15 text-danger", icon: AlertTriangle }
                    : { label: "Due", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock };
                  return (
                    <tr key={inv.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{inv.invoiceNo}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{inv.order.purchaseOrder?.poNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmt(inv.issuedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmt(due)}</td>
                      <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">{formatCurrency(total - vat, "AED")}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">{formatCurrency(vat, "AED")}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}><st.icon className="h-3 w-3" /> {st.label}</span></td>
                      <td className="px-4 py-3 text-end"><button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" aria-label="Download invoice"><Download className="h-3.5 w-3.5" /> PDF</button></td>
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
