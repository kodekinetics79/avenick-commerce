import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { Download, FileText, CreditCard, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export const metadata = { title: "Billing & Invoices — Avenick for Business" };

const CREDIT = { limit: 250000, used: 117600, terms: "NET 30" };

const AGING = [
  { label: "Current", value: 84200, cls: "text-success" },
  { label: "1–30 days", value: 23400, cls: "text-foreground" },
  { label: "31–60 days", value: 10000, cls: "text-amber-600 dark:text-amber-400" },
  { label: "60+ days", value: 0, cls: "text-danger" },
];

const INV_STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  PAID: { label: "Paid", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  DUE: { label: "Due", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  OVERDUE: { label: "Overdue", cls: "bg-danger/15 text-danger", icon: AlertTriangle },
};

const INVOICES = [
  { id: "INV-2026-1042", po: "PO-2026-0041", date: "May 28, 2026", due: "Jun 27, 2026", amount: 19500, vat: 975, status: "DUE" },
  { id: "INV-2026-1039", po: "PO-2026-0039", date: "May 24, 2026", due: "Jun 23, 2026", amount: 12750, vat: 637.5, status: "DUE" },
  { id: "INV-2026-1036", po: "PO-2026-0036", date: "May 18, 2026", due: "Jun 17, 2026", amount: 33200, vat: 1660, status: "DUE" },
  { id: "INV-2026-1021", po: "PO-2026-0028", date: "Apr 30, 2026", due: "May 30, 2026", amount: 10000, vat: 500, status: "OVERDUE" },
  { id: "INV-2026-1009", po: "PO-2026-0019", date: "Apr 12, 2026", due: "May 12, 2026", amount: 22150, vat: 1107.5, status: "PAID" },
];

export default function BillingPage() {
  const available = CREDIT.limit - CREDIT.used;
  const usedPct = Math.round((CREDIT.used / CREDIT.limit) * 100);
  const outstanding = INVOICES.filter((i) => i.status !== "PAID").reduce((s, i) => s + i.amount + i.vat, 0);

  return (
    <B2BShell
      title="Billing & Invoices"
      description="Credit terms, outstanding balance, statements and downloadable tax invoices."
      actions={
        <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-secondary transition-colors">
          <Download className="h-4 w-4" /> Download statement
        </button>
      }
    >
      {/* Credit + outstanding */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold mb-4"><CreditCard className="h-4 w-4 text-primary" /> Credit line · {CREDIT.terms}</div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><p className="text-xs text-muted-foreground">Limit</p><p className="text-xl font-bold font-mono">{formatCurrency(CREDIT.limit, "AED")}</p></div>
            <div><p className="text-xs text-muted-foreground">Used</p><p className="text-xl font-bold font-mono">{formatCurrency(CREDIT.used, "AED")}</p></div>
            <div><p className="text-xs text-muted-foreground">Available</p><p className="text-xl font-bold font-mono text-success">{formatCurrency(available, "AED")}</p></div>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${usedPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{usedPct}% of credit utilized</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Outstanding balance</p>
          <p className="text-3xl font-bold font-mono tracking-tight mt-1">{formatCurrency(outstanding, "AED")}</p>
          <button className="mt-4 w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">Pay now</button>
        </div>
      </div>

      {/* Aging */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {AGING.map((a) => (
          <div key={a.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground">{a.label}</p>
            <p className={`text-lg font-bold font-mono mt-1 ${a.cls}`}>{formatCurrency(a.value, "AED")}</p>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-muted-foreground" /> Tax invoices</div>
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
              {INVOICES.map((inv) => {
                const st = INV_STATUS[inv.status]!;
                return (
                  <tr key={inv.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{inv.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{inv.po}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{inv.date}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{inv.due}</td>
                    <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">{formatCurrency(inv.amount, "AED")}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">{formatCurrency(inv.vat, "AED")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}><st.icon className="h-3 w-3" /> {st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" aria-label="Download invoice"><Download className="h-3.5 w-3.5" /> PDF</button>
                    </td>
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
