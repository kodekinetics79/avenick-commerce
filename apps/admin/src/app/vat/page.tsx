import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getVatSummary, getTaxInvoices } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { FileSpreadsheet, ArrowLeft, Receipt } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "VAT Summary" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { page?: string; search?: string };
}

export default async function VATPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 25;
  const search = searchParams.search?.trim() || undefined;

  const [summary, { invoices, total }] = await Promise.all([
    getVatSummary(),
    getTaxInvoices({ page, limit, search }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const totalVat = summary.byCurrency.reduce((s, c) => s + c.vat, 0);
  const totalOrders = summary.byCurrency.reduce((s, c) => s + c.orders, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/finance" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Finance
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">VAT</span>
            </div>
            <h1 className="text-2xl font-bold">VAT Summary</h1>
            <p className="text-sm text-muted-foreground">
              Output VAT collected on paid orders (UAE 5% · KSA 15%), {new Date().getFullYear()} year to date.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Output VAT (YTD)", value: formatCurrency(totalVat, "AED") },
            { label: "Taxable orders (YTD)", value: String(totalOrders) },
            { label: "Jurisdictions", value: String(summary.byCurrency.length) },
            { label: "Tax invoices issued", value: String(summary.invoiceCount) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-white p-4">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* By currency/jurisdiction */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold">VAT by currency</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Currency", "Orders", "Gross", "Output VAT"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.byCurrency.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No paid orders yet this year.
                    </td>
                  </tr>
                )}
                {summary.byCurrency.map((c) => (
                  <tr key={c.currency}>
                    <td className="px-4 py-3 font-medium">{c.currency}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.orders}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatCurrency(c.gross, c.currency as never)}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(c.vat, c.currency as never)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By month */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold">VAT by month</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Month", "Taxable orders", "Output VAT"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.monthly.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No VAT collected yet this year.
                    </td>
                  </tr>
                )}
                {summary.monthly.map((m) => (
                  <tr key={String(m.month)}>
                    <td className="px-4 py-3 font-medium">{format(m.month, "MMMM yyyy")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.orders}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(m.vat, "AED")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tax invoices */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Tax invoices</h2>
            <span className="text-xs text-muted-foreground">{total} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Invoice #", "Order", "Buyer", "VAT reg.", "Amount", "VAT", "Issued"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Receipt className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No tax invoices issued yet. Automatic tax-invoice generation is not implemented — no invoice is created by the platform today.
                      </p>
                    </td>
                  </tr>
                )}
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoiceNo}</td>
                    <td className="px-4 py-3 text-primary">{inv.order.orderNumber}</td>
                    <td className="px-4 py-3">
                      {inv.order.company?.nameEn ?? `${inv.order.user.firstName} ${inv.order.user.lastName}`}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.order.company?.vatNumber ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(Number(inv.totalAmount), inv.currency as never)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatCurrency(Number(inv.vatAmount), inv.currency as never)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(inv.issuedAt, "MMM d, yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/vat?page=${page - 1}`} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs">Previous</Link>
                )}
                {page < totalPages && (
                  <Link href={`/vat?page=${page + 1}`} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs">Next</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
