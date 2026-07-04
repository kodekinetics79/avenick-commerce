import Link from "next/link";
import { RotateCcw, Package, Clock, CheckCircle, XCircle, Truck, Banknote, LogIn } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { auth } from "@/lib/auth-instance";
import { formatCurrency } from "@avenick/utils";
import { ReturnForm } from "./return-form";
import { format } from "date-fns";
import { cookies } from "next/headers";
import { cookieHeaderFromStore, fetchBackendJsonWithCookies } from "@/lib/backend";

export const metadata = { title: "Returns" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  REQUESTED: { label: "Under review", color: "bg-blue-100 text-primary", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-amber-100 text-amber-700", icon: CheckCircle },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700", icon: XCircle },
  IN_TRANSIT: { label: "In transit", color: "bg-purple-100 text-purple-700", icon: Truck },
  RECEIVED: { label: "Received", color: "bg-indigo-100 text-indigo-700", icon: Package },
  REFUNDED: { label: "Refunded", color: "bg-green-100 text-green-700", icon: Banknote },
};

export default async function ReturnsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <MainLayout>
        <div className="bg-slate-50 min-h-screen">
          <div className="max-w-lg mx-auto px-4 py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="h-8 w-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Returns & Refunds</h1>
            <p className="text-muted-foreground mb-6">Sign in to request a return for a delivered order or track an existing return.</p>
            <Link
              href="/login?callbackUrl=/returns"
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieHeaderFromStore(cookieStore);
  const { eligibleOrders, myReturns } = await fetchBackendJsonWithCookies<{ eligibleOrders: any[]; myReturns: any[] }>(
    "/api/returns",
    undefined,
    cookieHeader,
  );

  return (
    <MainLayout>
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Returns & Refunds</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Request a return for a delivered order. Most returns are reviewed within 1–2 business days.
            </p>
          </div>

          {/* Existing returns */}
          {myReturns.length > 0 && (
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold">Your return requests</h2>
              </div>
              <ul className="divide-y divide-border">
                {myReturns.map((r) => {
                  const cfg = STATUS_CONFIG[r.status];
                  const Icon = cfg.icon;
                  return (
                    <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {r.returnNumber} · {r.order.orderNumber}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.reason} · {format(r.createdAt, "MMM d, yyyy")}
                        </p>
                        {r.resolution && <p className="text-xs text-muted-foreground/80 truncate">↳ {r.resolution}</p>}
                      </div>
                      <div className="text-end shrink-0">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                          <Icon className="h-3 w-3" /> {cfg.label}
                        </span>
                        {r.refundAmount && (
                          <p className="text-xs font-semibold mt-1">
                            {formatCurrency(Number(r.refundAmount), r.order.currency as never)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* New return */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <h2 className="font-semibold mb-1">Start a new return</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {eligibleOrders.length > 0
                ? "Choose a delivered order and tell us what went wrong."
                : "You have no delivered orders eligible for return right now."}
            </p>
            {eligibleOrders.length > 0 ? (
              <ReturnForm
                orders={eligibleOrders.map((o) => ({
                  id: o.id,
                  orderNumber: o.orderNumber,
                  total: Number(o.total),
                  currency: o.currency,
                  createdAt: o.createdAt.toISOString(),
                  summary: o.items.map((i: { quantity: number; nameEn: string }) => `${i.quantity}× ${i.nameEn}`).join(", "),
                }))}
              />
            ) : (
              <Link href="/account/orders" className="text-sm text-primary hover:underline">
                View your orders →
              </Link>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
