import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getCrmOverview } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { Users, Activity, Store, Crown, Eye, ShoppingCart, FileQuestion } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export const metadata = { title: "CRM & Accounts" };
export const dynamic = "force-dynamic";

const ACTIVITY_CONFIG: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  VIEW: { label: "Viewed product", icon: Eye, color: "bg-slate-100 text-muted-foreground" },
  ORDER: { label: "Placed order", icon: ShoppingCart, color: "bg-green-100 text-green-700" },
  RFQ: { label: "Requested quote", icon: FileQuestion, color: "bg-purple-100 text-purple-700" },
};

export default async function CrmPage() {
  await requireAdminSession();

  const { relationships, activities, topBuyers } = await getCrmOverview();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">CRM & Accounts</h1>
          <p className="text-muted-foreground text-sm">
            Buyer relationships, purchase history, and recent account activity — live from the order ledger.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Buyers with purchases", value: topBuyers.length },
            { label: "Seller–buyer relationships", value: relationships.length },
            { label: "Activities (recent)", value: activities.length },
            { label: "Top buyer spend", value: topBuyers[0] ? formatCurrency(topBuyers[0].spent, "AED") : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-white p-4">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top buyers */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold">Top buyers by lifetime spend</h2>
            </div>
            {topBuyers.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No paid orders yet — buyers appear here after their first purchase.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {topBuyers.map((b, i) => (
                  <li key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {b.email} · {b.role === "CONSUMER" ? "B2C" : "B2B"}
                        </p>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(b.spent, "AED")}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {b.orders} order{b.orders === 1 ? "" : "s"}
                        {b.lastorder ? ` · last ${format(b.lastorder, "MMM d")}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Recent buyer activity</h2>
            </div>
            {activities.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No tracked activity yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {activities.map((a) => {
                  const cfg = ACTIVITY_CONFIG[a.type] ?? { label: a.type, icon: Activity, color: "bg-slate-100 text-muted-foreground" };
                  const Icon = cfg.icon;
                  return (
                    <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                      <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{a.buyer.firstName} {a.buyer.lastName}</span>
                          <span className="text-muted-foreground"> · {cfg.label}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(a.createdAt, { addSuffix: true })}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Seller–buyer relationships */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Store className="h-4 w-4 text-orange-600" />
            <h2 className="font-semibold">Seller–buyer relationships</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Buyer", "Seller", "Orders", "Lifetime spend", "Last order", "Tags"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {relationships.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No seller–buyer relationships recorded yet.</p>
                    </td>
                  </tr>
                )}
                {relationships.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      {r.buyer ? (
                        <>
                          <p className="font-medium">{r.buyer.firstName} {r.buyer.lastName}</p>
                          <p className="text-xs text-muted-foreground">{r.buyer.email}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unknown buyer</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.seller.businessNameEn}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.totalOrders}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(Number(r.totalSpent), r.currency as never)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {r.lastOrderAt ? format(r.lastOrderAt, "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.tags.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {r.tags.map((t) => (
                            <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-muted-foreground">{t}</span>
                          ))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
