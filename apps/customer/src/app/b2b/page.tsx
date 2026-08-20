import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  CreditCard,
  FileText,
  ArrowRight,
  Plus,
  RotateCcw,
  ClipboardList,
  CheckSquare,
  Clock,
} from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { fetchB2BJson } from "@/lib/b2b";
import { format } from "date-fns";

export const metadata = { title: "B2B Dashboard" };
export const dynamic = "force-dynamic";

type DashboardData = {
  company: {
    nameEn: string;
    creditLimit: string | number | null;
    _count: { members: number; orders: number; purchaseOrders: number };
  };
  companyCurrency: string;
  lifetimeSpend: number;
  pendingApprovals: number;
  openRFQs: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: string | number;
    currency: string;
    createdAt: string;
  }>;
  reorderItems: Array<{
    id: string;
    nameEn: string;
    quantity: number;
    sku: string;
    product: { slug: string; status: string } | null;
  }>;
};

export default async function B2BDashboardPage() {
  let data: DashboardData;
  try {
    data = await fetchB2BJson<DashboardData>("/api/b2b/dashboard");
  } catch {
    redirect("/b2b/register");
  }

  const { company, companyCurrency, lifetimeSpend, pendingApprovals, openRFQs, recentOrders, reorderItems } = data;
  const creditLimit = company.creditLimit ? Number(company.creditLimit) : null;

  return (
    <B2BShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {company.nameEn}</h1>
            <p className="text-muted-foreground text-sm">
              {company._count.members} team member{company._count.members === 1 ? "" : "s"} · {company._count.orders} orders to date
            </p>
          </div>
          <Link
            href="/b2b/rfq/new"
            className="inline-flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> New RFQ
          </Link>
        </div>

        {pendingApprovals > 0 && (
          <Link
            href="/b2b/approvals"
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:border-amber-300 transition-colors"
          >
            <CheckSquare className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="font-semibold text-amber-800 text-sm flex-1">
              {pendingApprovals} purchase order{pendingApprovals === 1 ? "" : "s"} awaiting approval
            </p>
            <ArrowRight className="h-4 w-4 text-amber-600" />
          </Link>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Lifetime spend", value: formatCurrency(lifetimeSpend, companyCurrency as never), icon: CreditCard, href: "/b2b/analytics" },
            { label: "Credit limit", value: creditLimit ? formatCurrency(creditLimit, companyCurrency as never) : "Not set", icon: Building2, href: "/b2b/billing" },
            { label: "Open RFQs", value: openRFQs, icon: FileText, href: "/b2b/quotes" },
            { label: "Pending approvals", value: pendingApprovals, icon: CheckSquare, href: "/b2b/approvals" },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <Link key={k.label} href={k.href} className="bg-white rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors">
                <Icon className="h-4 w-4 text-muted-foreground mb-2" />
                <p className="text-xl font-bold">{k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent orders */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">Recent orders</h2>
              <Link href="/account/orders" className="text-xs text-primary hover:underline">All orders →</Link>
            </div>
            {recentOrders.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No orders yet — browse the catalog or raise an RFQ to get started.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentOrders.map((o) => (
                  <li key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <Link href={`/orders/${o.id}`} className="min-w-0">
                      <p className="text-sm font-medium hover:text-primary">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(o.createdAt), "MMM d, yyyy")} · {o.status.replace(/_/g, " ").toLowerCase()}
                      </p>
                    </Link>
                    <span className="text-sm font-semibold shrink-0">{formatCurrency(Number(o.total), o.currency as never)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Reorder */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Buy again</h2>
            </div>
            {reorderItems.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <RotateCcw className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Products you order will appear here for quick reordering.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {reorderItems.map((item) => (
                  <li key={item.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.nameEn}</p>
                      <p className="text-xs text-muted-foreground">Last ordered ×{item.quantity} · SKU {item.sku}</p>
                    </div>
                    {item.product && item.product.status === "ACTIVE" ? (
                      <Link
                        href={`/products/${item.product.slug}`}
                        className="text-xs font-semibold text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors shrink-0"
                      >
                        Reorder
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">Unavailable</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/b2b/quotes", label: "Quotes & RFQs", icon: FileText },
            { href: "/b2b/purchase-orders", label: "Purchase orders", icon: ClipboardList },
            { href: "/b2b/lists", label: "Requisition lists", icon: ClipboardList },
            { href: "/b2b/company", label: "Company profile", icon: Building2 },
          ].map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="group bg-white rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-muted-foreground" /> {l.label}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>
    </B2BShell>
  );
}
