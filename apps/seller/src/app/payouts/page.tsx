import { requireSellerSession } from "@/lib/auth";
import { db, MOCK_PAYOUT_HISTORY } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import { DollarSign } from "lucide-react";

export default async function PayoutsPage() {
  const { seller } = await requireSellerSession();

  const payouts = await db.sellerPayout.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { amount: true, commission: true, net: true } } },
  });

  const pendingAmount = payouts.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = payouts.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Payouts — المدفوعات</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <p className="text-sm text-orange-700 font-medium">Pending Payout</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(pendingAmount, "AED")}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-sm text-green-700 font-medium">Total Paid Out</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalPaid, "AED")}</p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Commission Rate</p>
            <p className="text-2xl font-bold mt-1">{Number(seller.commissionRate)}%</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Period</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Gross</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Commission</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Net</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Reference</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payouts.map((p) => {
                  const gross = p.items.reduce((s, i) => s + Number(i.amount), 0);
                  const comm = p.items.reduce((s, i) => s + Number(i.commission), 0);
                  const net = p.items.reduce((s, i) => s + Number(i.net), 0);
                  return (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-sm">{format(p.periodFrom, "MMM d")} – {format(p.periodTo, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">{formatCurrency(gross || Number(p.amount), p.currency)}</td>
                      <td className="px-4 py-3 text-red-600">-{formatCurrency(comm, p.currency)}</td>
                      <td className="px-4 py-3 font-bold text-green-600">{formatCurrency(net || Number(p.amount), p.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "PAID" ? "bg-green-100 text-green-700" : p.status === "PENDING" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{p.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.processedAt ? format(p.processedAt, "MMM d, yyyy") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {payouts.length === 0 && (
              <>
                <tbody className="divide-y divide-border">
                  {MOCK_PAYOUT_HISTORY.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-sm">{p.period}</td>
                      <td className="px-4 py-3">{formatCurrency(p.grossSales, "AED")}</td>
                      <td className="px-4 py-3 text-red-600">-{formatCurrency(p.commission, "AED")}</td>
                      <td className="px-4 py-3 font-bold text-green-600">{formatCurrency(p.net, "AED")}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "PAID" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">—</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.settledAt ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
