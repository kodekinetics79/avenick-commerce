import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getCustomerSegments } from "@avenick/database";
import { PieChart, Users, Crown, Moon, Zap } from "lucide-react";

export const metadata = { title: "Customer Segments" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  CONSUMER: "B2C consumers",
  COMPANY_ADMIN: "Company admins",
  COMPANY_BUYER: "Company buyers",
  COMPANY_APPROVER: "Company approvers",
};

// Spend is SUM(order total) per buyer as recorded in each order's own currency;
// nothing is converted, so the figure carries no currency symbol.
const amount = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 0 });

export default async function SegmentsPage() {
  await requireAdminSession();

  const s = await getCustomerSegments();
  const totalUsers = s.byRole.reduce((sum, r) => sum + r.count, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Customer Segments</h1>
          <p className="text-muted-foreground text-sm">
            Segments computed live from user roles and purchase behaviour — no manual lists to maintain.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Buyer accounts", value: totalUsers, icon: Users, color: "bg-white border-border text-muted-foreground" },
            { label: "Active (30d)", value: s.activeLast30d, icon: Zap, color: "bg-green-50 border-green-200 text-green-700" },
            { label: "High value (top 20%)", value: s.highValue.length, icon: Crown, color: "bg-amber-50 border-amber-200 text-amber-700" },
            { label: "Dormant (60d+)", value: s.dormant60d, icon: Moon, color: "bg-slate-50 border-border text-muted-foreground" },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`rounded-2xl border p-4 ${k.color.split(" ").slice(0, 2).join(" ")}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{k.label}</span>
                  <Icon className={`h-4 w-4 ${k.color.split(" ")[2]}`} />
                </div>
                <p className="text-2xl font-bold mt-1">{k.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* By role */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <h2 className="font-semibold mb-4 inline-flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" /> Buyer accounts by role
            </h2>
            {s.byRole.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No buyer accounts yet.</p>
            ) : (
              <ul className="space-y-3">
                {s.byRole.map((r) => (
                  <li key={r.role} className="flex items-center gap-3">
                    <span className="text-sm w-40 shrink-0">{ROLE_LABEL[r.role] ?? r.role}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.max(3, (r.count / Math.max(1, totalUsers)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-10 text-end">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* High value buyers */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold inline-flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" /> High-value buyers
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Top 20% by lifetime spend ({s.totalWithPurchases} buyers with purchases)
              </p>
            </div>
            {s.highValue.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Crown className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No purchases yet — high-value buyers appear after first orders.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {s.highValue.map((b) => (
                  <li key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{b.email}</p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-semibold">{amount(b.spent)}</p>
                      <p className="text-[11px] text-muted-foreground">{b.orders} order{b.orders === 1 ? "" : "s"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
