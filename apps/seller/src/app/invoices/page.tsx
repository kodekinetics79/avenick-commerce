import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { FileText, CheckCircle, Clock, AlertTriangle, Download } from "lucide-react";

export const metadata = { title: "Invoices" };

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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

  const now = new Date();
  const rows = invoices.map((inv) => {
    const due = new Date(inv.issuedAt.getTime() + 30 * 86400000);
    const paid = inv.order.paymentStatus === "PAID";
    const overdue = !paid && due < now;
    return {
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      orderNumber: inv.order.orderNumber,
      buyer: inv.order.company?.nameEn ?? `${inv.order.user.firstName} ${inv.order.user.lastName}`.trim(),
      total: inv.order.items.reduce((sum, item) => sum + Number(item.total), 0),
      vat: inv.order.items.reduce((sum, item) => sum + Number(item.vatAmount), 0),
      issuedAt: inv.issuedAt,
      due,
      status: paid ? "PAID" : overdue ? "OVERDUE" : "PENDING",
    };
  });

  const sum = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + r.total, 0);
  const cnt = (s: string) => rows.filter((r) => r.status === s).length;
  const totalPaid = sum("PAID"), totalPending = sum("PENDING"), totalOverdue = sum("OVERDUE");

  const STATUS: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
    PAID: { label: "Paid", cls: "bg-success/15 text-success", icon: CheckCircle },
    PENDING: { label: "Pending", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
    OVERDUE: { label: "Overdue", cls: "bg-danger/15 text-danger", icon: AlertTriangle },
  };

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Tax invoices issued to buyers for your orders</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-success/5 border border-success/20 rounded-2xl p-4">
            <CheckCircle className="h-4 w-4 text-success mb-2" />
            <p className="text-2xl font-bold font-mono text-success">{formatCurrency(totalPaid, "AED")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{cnt("PAID")} invoices paid</p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mb-2" />
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{formatCurrency(totalPending, "AED")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{cnt("PENDING")} invoices pending</p>
          </div>
          <div className={`rounded-2xl p-4 border ${totalOverdue > 0 ? "bg-danger/5 border-danger/20" : "bg-card border-border"}`}>
            <AlertTriangle className={`h-4 w-4 mb-2 ${totalOverdue > 0 ? "text-danger" : "text-muted-foreground"}`} />
            <p className={`text-2xl font-bold font-mono ${totalOverdue > 0 ? "text-danger" : "text-foreground"}`}>{formatCurrency(totalOverdue, "AED")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{cnt("OVERDUE")} overdue</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold">No invoices yet</p>
              <p className="text-sm text-muted-foreground mt-1">Tax invoices are generated as your orders are placed.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 border-b border-border">
                    <tr>
                      {["Invoice #", "Order #", "Buyer", "VAT", "Total", "Issued", "Due", "Status", ""].map((h) => (
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
                          <td className="px-4 py-3 text-muted-foreground font-mono">{formatCurrency(inv.vat, "AED")}</td>
                          <td className="px-4 py-3 font-bold font-mono">{formatCurrency(inv.total, "AED")}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(inv.issuedAt)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(inv.due)}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${st.cls}`}><st.icon className="h-3 w-3" />{st.label}</span></td>
                          <td className="px-4 py-3"><button type="button" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"><Download className="h-3 w-3" /> PDF</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border bg-secondary/30">
                <p className="text-xs text-muted-foreground">{rows.length} invoices · VAT invoices compliant with UAE FTA requirements</p>
              </div>
            </>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
