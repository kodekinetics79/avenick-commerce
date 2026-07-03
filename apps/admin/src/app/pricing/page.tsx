import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { Coins, Layers, Percent, TrendingUp, Store } from "lucide-react";
import { format } from "date-fns";

export const metadata = { title: "Pricing & Commission" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requireAdminSession();

  const [priceStats, sellers, recentPriceChanges, tieredProducts] = await Promise.all([
    db.productPrice.groupBy({
      by: ["type"],
      where: { isActive: true },
      _count: { _all: true },
      _avg: { price: true },
    }),
    db.sellerProfile.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: {
        id: true,
        businessNameEn: true,
        tier: true,
        commissionRate: true,
        _count: { select: { products: { where: { deletedAt: null } }, commissions: true } },
      },
      orderBy: { commissionRate: "desc" },
    }),
    db.auditLog.findMany({
      where: { action: "PRICE_CHANGE" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { firstName: true, lastName: true } } },
    }),
    db.product.findMany({
      where: { deletedAt: null, prices: { some: { isActive: true, minQty: { gt: 1 } } } },
      select: {
        id: true,
        nameEn: true,
        sku: true,
        seller: { select: { businessNameEn: true } },
        prices: {
          where: { isActive: true },
          orderBy: [{ type: "asc" }, { minQty: "asc" }],
          select: { type: true, currency: true, minQty: true, maxQty: true, price: true },
        },
      },
      take: 10,
    }),
  ]);

  const b2cCount = priceStats.find((p) => p.type === "B2C")?._count._all ?? 0;
  const b2bCount = priceStats.find((p) => p.type === "B2B")?._count._all ?? 0;
  const avgCommission =
    sellers.length > 0
      ? Math.round((sellers.reduce((s, x) => s + Number(x.commissionRate), 0) / sellers.length) * 10) / 10
      : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pricing &amp; Commission</h1>
          <p className="text-muted-foreground text-sm">
            Live price tiers, per-seller commission rates, and the price-change audit trail.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active B2C prices", value: b2cCount, icon: Coins, color: "text-green-600", bg: "bg-green-50 border-green-200" },
            { label: "Active B2B prices", value: b2bCount, icon: Layers, color: "text-primary", bg: "bg-blue-50 border-blue-200" },
            { label: "Avg commission rate", value: `${avgCommission}%`, icon: Percent, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Volume-tiered products", value: tieredProducts.length, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
                <Icon className={`h-4 w-4 ${s.color} mb-2`} />
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Commission rates */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Commission rates by seller</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    {["Seller", "Tier", "Rate", "Products", "Commissions"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sellers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center">
                        <Store className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No active sellers.</p>
                      </td>
                    </tr>
                  )}
                  {sellers.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-medium">{s.businessNameEn}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-muted-foreground">{s.tier}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{Number(s.commissionRate)}%</td>
                      <td className="px-4 py-3 text-muted-foreground">{s._count.products}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s._count.commissions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Price change audit */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Recent price changes (audit trail)</h2>
            </div>
            {recentPriceChanges.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Coins className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No price changes recorded yet. Seller price edits appear here with before/after values.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentPriceChanges.map((c) => {
                  const before = (c.before ?? {}) as Record<string, unknown>;
                  const after = (c.after ?? {}) as Record<string, unknown>;
                  return (
                    <li key={c.id} className="px-5 py-3">
                      <p className="text-sm">
                        <span className="font-medium">{c.actor ? `${c.actor.firstName} ${c.actor.lastName}` : "System"}</span>
                        <span className="text-muted-foreground"> changed a price on </span>
                        <span className="font-mono text-xs">{c.entityId}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {before["price"] !== undefined && after["price"] !== undefined
                          ? `${before["price"]} → ${after["price"]} · `
                          : ""}
                        {format(c.createdAt, "MMM d, yyyy HH:mm")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Volume tiers */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Volume-tiered pricing</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Products offering quantity breaks (B2B bulk tiers)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Product", "Seller", "Tiers"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tieredProducts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center">
                      <Layers className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No products with volume tiers yet.</p>
                    </td>
                  </tr>
                )}
                {tieredProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.nameEn}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.seller.businessNameEn}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {p.prices.map((t, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-muted-foreground">
                            {t.type} {t.minQty}
                            {t.maxQty ? `–${t.maxQty}` : "+"}: {formatCurrency(Number(t.price), t.currency as never)}
                          </span>
                        ))}
                      </div>
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
