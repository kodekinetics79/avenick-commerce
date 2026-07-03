import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getRetentionMetrics } from "@avenick/database";
import { Repeat, Users, Moon, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export const metadata = { title: "Retention" };
export const dynamic = "force-dynamic";

export default async function RetentionPage() {
  await requireAdminSession();

  const m = await getRetentionMetrics();
  const maxMonthly = Math.max(1, ...m.monthly.map((x) => x.newBuyers + x.returning));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Retention</h1>
          <p className="text-muted-foreground text-sm">
            Repeat purchase behaviour computed live from paid orders.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Buyers with purchases", value: m.totalBuyers, icon: Users, color: "bg-white border-border text-foreground" },
            { label: "Repeat buyers", value: m.repeatBuyers, icon: Repeat, color: "bg-green-50 border-green-200 text-green-700" },
            { label: "Repeat rate", value: `${m.repeatRate}%`, icon: TrendingUp, color: "bg-blue-50 border-blue-200 text-primary" },
            { label: "Dormant (60d+)", value: m.dormantBuyers, icon: Moon, color: "bg-amber-50 border-amber-200 text-amber-700" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`rounded-2xl border p-4 ${s.color.split(" ").slice(0, 2).join(" ")}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <Icon className={`h-4 w-4 ${s.color.split(" ")[2]}`} />
                </div>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-border p-5">
          <h2 className="font-semibold mb-4">New vs returning buyers by month</h2>
          {m.monthly.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No paid orders yet — retention curves appear once buyers start purchasing.
            </p>
          ) : (
            <div className="space-y-3">
              {m.monthly.map((row) => {
                const total = row.newBuyers + row.returning;
                return (
                  <div key={String(row.month)} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">{format(row.month, "MMM yyyy")}</span>
                    <div className="flex-1 flex h-4 rounded-full overflow-hidden bg-slate-100">
                      {row.newBuyers > 0 && (
                        <div className="bg-primary h-full" style={{ width: `${(row.newBuyers / maxMonthly) * 100}%` }} title={`${row.newBuyers} new`} />
                      )}
                      {row.returning > 0 && (
                        <div className="bg-green-500 h-full" style={{ width: `${(row.returning / maxMonthly) * 100}%` }} title={`${row.returning} returning`} />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground w-36 text-end">
                      {row.newBuyers} new · {row.returning} returning ({total})
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> New buyers</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Returning buyers</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
