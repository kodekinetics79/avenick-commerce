import { requireSellerAnyPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { setReturnStatus } from "./actions";
import { RotateCcw, Clock, CheckCircle, XCircle, Package, DollarSign } from "lucide-react";

export const metadata = { title: "Returns" };

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  REQUESTED: { label: "Action needed", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  APPROVED: { label: "Approved", cls: "bg-primary/15 text-primary", icon: CheckCircle },
  REJECTED: { label: "Rejected", cls: "bg-danger/15 text-danger", icon: XCircle },
  IN_TRANSIT: { label: "In transit", cls: "bg-primary/15 text-primary", icon: Package },
  RECEIVED: { label: "Received", cls: "bg-primary/15 text-primary", icon: Package },
  REFUNDED: { label: "Refunded", cls: "bg-success/15 text-success", icon: DollarSign },
};

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function SellerReturnsPage({ searchParams }: { searchParams?: { returnDone?: string; returnError?: string } }) {
  const { seller, membership } = await requireSellerAnyPermission(["returns.view", "returns.manage"]);

  const returns = await db.returnRequest.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: { select: { orderNumber: true, user: { select: { firstName: true, lastName: true } }, company: { select: { nameEn: true } } } },
    },
  });

  const pending = returns.filter((r) => r.status === "REQUESTED").length;
  const stats = [
    { label: "Action needed", value: pending, color: pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground", bg: pending > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-card border-border" },
    { label: "Total returns", value: returns.length, color: "text-foreground", bg: "bg-card border-border" },
    { label: "Refunded", value: returns.filter((r) => r.status === "REFUNDED").length, color: "text-success", bg: "bg-success/5 border-success/20" },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      {(searchParams?.returnDone || searchParams?.returnError) && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            searchParams?.returnError
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-success/30 bg-success/10 text-success"
          }`}
        >
          <span className="font-semibold">
            {searchParams?.returnError ? "Action failed. " : "Done. "}
          </span>
          {searchParams?.returnError ?? searchParams?.returnDone}
        </div>
      )}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
          <p className="text-sm text-muted-foreground">Return requests for your products</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {pending > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="font-semibold text-sm">{pending} return{pending !== 1 ? "s" : ""} awaiting your response — respond within 48h to protect your performance score.</p>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {returns.length === 0 ? (
            <div className="p-10 text-center">
              <RotateCcw className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold">No returns</p>
              <p className="text-sm text-muted-foreground mt-1">Return requests from buyers will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>{["Return #", "Order", "Buyer", "Reason", "Requested", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {returns.map((r) => {
                    const st = STATUS[r.status]!;
                    const buyer = r.order.company?.nameEn ?? `${r.order.user.firstName} ${r.order.user.lastName}`.trim();
                    return (
                      <tr key={r.id} className="hover:bg-secondary/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{r.returnNumber}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{r.order.orderNumber}</td>
                        <td className="px-4 py-3 font-medium max-w-[140px] truncate">{buyer}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{r.reason}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(r.createdAt)}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${st.cls}`}><st.icon className="h-3 w-3" />{st.label}</span></td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {r.status === "REQUESTED" && (
                              <>
                                <form action={setReturnStatus.bind(null, r.id, "APPROVED")}><button type="submit" className="text-xs font-semibold text-success hover:underline">Approve</button></form>
                                <form action={setReturnStatus.bind(null, r.id, "REJECTED")}><button type="submit" className="text-xs font-medium text-muted-foreground hover:text-danger">Reject</button></form>
                              </>
                            )}
                            {(r.status === "APPROVED" || r.status === "RECEIVED") && (
                              <span className="text-xs text-muted-foreground">Awaiting platform refund execution</span>
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
      </div>
    </SellerLayout>
  );
}
