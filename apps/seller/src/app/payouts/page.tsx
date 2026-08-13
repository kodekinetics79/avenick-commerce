import { requireSellerPermission } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import { DollarSign } from "lucide-react";

export default async function PayoutsPage() {
  const { seller, membership } = await requireSellerPermission("finance.view");

  const payouts = await db.sellerPayout.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { amount: true, commission: true, net: true } } },
  });

  const pendingAmount = payouts.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = payouts.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Payouts — المدفوعات</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Pending Payout</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{formatCurrency(pendingAmount, "AED")}</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Paid Out</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(totalPaid, "AED")}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Commission Rate</p>
            <p className="text-2xl font-bold mt-1">{Number(seller.commissionRate)}%</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
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
                      <td className="px-4 py-3 text-red-600 dark:text-red-400">-{formatCurrency(comm, p.currency)}</td>
                      <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">{formatCurrency(net || Number(p.amount), p.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "PAID" ? "bg-green-500/10 text-green-600 dark:text-green-400" : p.status === "PENDING" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "bg-muted text-muted-foreground"}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{p.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.processedAt ? format(p.processedAt, "MMM d, yyyy") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {payouts.length === 0 && (
              <div className="px-5 py-12 text-center text-muted-foreground">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No payouts yet</p>
                <p className="text-sm">Payouts are issued as your orders settle.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
