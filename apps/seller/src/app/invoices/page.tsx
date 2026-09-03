import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { FileText, CheckCircle, Clock, Download } from "lucide-react";

export const metadata = { title: "Invoices" };

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Sum amounts per currency and render "AED 1,200 · SAR 300", or "—" when empty. */
function perCurrency(rows: Array<{ currency: string; amount: number }>): string {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount);
  const parts = [...totals.entries()].filter(([, v]) => v > 0).sort(([a], [b]) => a.localeCompare(b)).map(([c, v]) => formatCurrency(v, c as never));
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default async function InvoicesPage() {
  const { seller, membership } = await requireSellerPermission("finance.view");

  const invoices = await db.taxInvoice.findMany({
    where: { order: { items: { some: { sellerId: seller.id } } } },
    include: {
      order: {
        select: {
          orderNumber: true, paymentStatus: true,
          user: { select: { firstName: true, lastName: true } },
          company: { select: { nameEn: true } },
          items: { where: { sellerId: seller.id }, select: { total: true, vatAmount: true } },
        },
      },
    },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });

  // Only what the ledger records: the invoice's own currency, this seller's
  // share of the lines, and whether the order is paid. There is no due date on
  // a TaxInvoice, so the "30 days from issue" due date and the "overdue" status
  // this page used to derive from it are gone — they were invented terms.
  const rows = invoices.map((inv) => ({
    id: inv.id,
    invoiceNo: inv.invoiceNo,
    orderNumber: inv.order.orderNumber,
    buyer: inv.order.company?.nameEn ?? `${inv.order.user.firstName} ${inv.order.user.lastName}`.trim(),
    currency: inv.currency as string,
    total: inv.order.items.reduce((sum, item) => sum + Number(item.total), 0),
    vat: inv.order.items.reduce((sum, item) => sum + Number(item.vatAmount), 0),
    issuedAt: inv.issuedAt,
    fileUrl: inv.fileUrl,
    status: inv.order.paymentStatus === "PAID" ? "PAID" : "UNPAID",
  }));

  const byStatus = (s: string) => rows.filter((r) => r.status === s);
  const totalPaid = perCurrency(byStatus("PAID").map((r) => ({ currency: r.currency, amount: r.total })));
  const totalUnpaid = perCurrency(byStatus("UNPAID").map((r) => ({ currency: r.currency, amount: r.total })));

  const STATUS: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
    PAID: { label: "Paid", cls: "bg-success/15 text-success", icon: CheckCircle },
    UNPAID: { label: "Unpaid", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  };

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Tax invoices issued to buyers for your orders</p>
        </div>

        {/* Stats — per currency, because invoices are issued in the order's currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-success/5 border border-success/20 rounded-2xl p-4">
            <CheckCircle className="h-4 w-4 text-success mb-2" />
            <p className="text-2xl font-bold font-mono text-success">{totalPaid}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{byStatus("PAID").length} invoices on paid orders</p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mb-2" />
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{totalUnpaid}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{byStatus("UNPAID").length} invoices on unpaid orders</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold">No invoices yet</p>
              {/* Nothing issues tax invoices automatically today, so the empty state
                  states what is recorded rather than promising when one appears. */}
              <p className="text-sm text-muted-foreground mt-1">No tax invoice has been recorded against your orders.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 border-b border-border">
                    <tr>
                      {["Invoice #", "Order #", "Buyer", "VAT", "Total", "Issued", "Status", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((inv) => {
                      const st = STATUS[inv.status]!;
                      return (
                        <tr key={inv.id} className="hover:bg-secondary/40 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{inv.invoiceNo}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{inv.orderNumber}</td>
                          <td className="px-4 py-3 font-medium max-w-[150px] truncate">{inv.buyer}</td>
                          <td className="px-4 py-3 text-muted-foreground font-mono">{formatCurrency(inv.vat, inv.currency as never)}</td>
                          <td className="px-4 py-3 font-bold font-mono">{formatCurrency(inv.total, inv.currency as never)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(inv.issuedAt)}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${st.cls}`}><st.icon className="h-3 w-3" />{st.label}</span></td>
                          <td className="px-4 py-3">
                            {/* A download only where a file was actually stored; a button that did nothing is not a download. */}
                            {inv.fileUrl ? (
                              <a href={inv.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"><Download className="h-3 w-3" /> PDF</a>
                            ) : (
                              <span className="text-xs text-muted-foreground">No file</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border bg-secondary/30">
                <p className="text-xs text-muted-foreground">{rows.length} invoice{rows.length === 1 ? "" : "s"} · amounts are your lines on each order, in the invoice currency</p>
              </div>
            </>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
