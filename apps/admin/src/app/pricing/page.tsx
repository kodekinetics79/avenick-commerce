import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { Coins, Layers, Store } from "lucide-react";
import { format } from "date-fns";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Num, Eyebrow, Dateline,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";

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
      <div className="space-y-block">
        <PageHeader
          eyebrow="Commerce"
          title="Pricing & commission"
          description="Live price tiers, per-seller commission rates, and the price-change audit trail."
          dateline="Tier prices are shown in the currency each price row was set in · no conversion applied"
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label="Active B2C prices" value={b2cCount} />
          <CountStat label="Active B2B prices" value={b2bCount} />
          <CountStat
            label="Avg commission rate"
            value={`${avgCommission}%`}
            rank="section"
            dateline={`Unweighted mean across ${sellers.length} active seller${sellers.length === 1 ? "" : "s"}`}
          />
          <CountStat
            label="Volume-tiered products"
            value={tieredProducts.length}
            dateline="Of the 10 loaded below, not the whole catalogue"
          />
        </CellGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Commission rates */}
          <LedgerTable
            title="Commission rates by seller"
            dateline="Active sellers, highest rate first"
            rows={sellers}
            getRowKey={(s) => s.id}
            density="compact"
            columns={[
              { key: "seller", label: "Seller", render: (s) => <span className="font-medium text-ink-1">{s.businessNameEn}</span> },
              { key: "tier", label: "Tier", render: (s) => <StatusPill tone="neutral">{s.tier}</StatusPill> },
              { key: "rate", label: "Rate", numeric: true, render: (s) => <Num value={`${Number(s.commissionRate)}%`} /> },
              { key: "products", label: "Products", numeric: true, render: (s) => <span className="text-ink-3">{s._count.products}</span> },
              { key: "commissions", label: "Commissions", numeric: true, render: (s) => <span className="text-ink-3">{s._count.commissions}</span> },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No seller is active."
                body="A seller appears here once their account is approved and active."
                icon={<Store className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            }
          />

          {/* Price change audit */}
          <Surface className="overflow-hidden">
            <div className="border-b-2 border-border-strong px-5 py-3">
              <h2 className="u-h3 text-ink-1">Recent price changes</h2>
              <Dateline className="mt-0.5">The audit trail, newest first · latest 10 entries</Dateline>
            </div>
            {recentPriceChanges.length === 0 ? (
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No price change has been recorded."
                body="A seller's price edit appears here with its before and after values."
                icon={<Coins className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            ) : (
              <ul>
                {recentPriceChanges.map((c) => {
                  const before = (c.before ?? {}) as Record<string, unknown>;
                  const after = (c.after ?? {}) as Record<string, unknown>;
                  return (
                    <li key={c.id} className="border-b border-hairline px-5 py-3 last:border-b-0">
                      <p className="u-ui text-ink-1">
                        <span className="font-medium">{c.actor ? `${c.actor.firstName} ${c.actor.lastName}` : "System"}</span>
                        <span className="text-ink-2"> changed a price on </span>
                        <span className="u-mono text-meta">{c.entityId}</span>
                      </p>
                      <p className="u-meta mt-0.5 text-ink-3">
                        {before["price"] !== undefined && after["price"] !== undefined ? (
                          // dir="ltr" on the pair, not on the page: prices stay
                          // in Western digits in both locales, and the arrow
                          // between them is not mirrored by the bidi algorithm,
                          // so in Arabic the before/after pair would otherwise
                          // read in the wrong order.
                          <span dir="ltr" className="fig inline-block text-ink-2">
                            {String(before["price"])} → {String(after["price"])}
                          </span>
                        ) : null}
                        {before["price"] !== undefined && after["price"] !== undefined ? " · " : ""}
                        {format(c.createdAt, "MMM d, yyyy HH:mm")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Surface>
        </div>

        {/* Volume tiers */}
        <LedgerTable
          title="Volume-tiered pricing"
          dateline="Products offering quantity breaks (B2B bulk tiers) · latest 10 loaded"
          rows={tieredProducts}
          getRowKey={(p) => p.id}
          columns={[
            {
              key: "product",
              label: "Product",
              render: (p) => (
                <div className="min-w-0 py-1">
                  <p className="truncate font-medium text-ink-1">{p.nameEn}</p>
                  <p className="u-mono u-meta text-ink-3">{p.sku}</p>
                </div>
              ),
            },
            { key: "seller", label: "Seller", render: (p) => <span className="text-ink-2">{p.seller.businessNameEn}</span> },
            {
              key: "tiers",
              label: "Tiers",
              render: (p) => (
                <div className="flex flex-wrap gap-1.5 py-1">
                  {p.prices.map((t, i) => (
                    <span key={i} className="u-meta inline-flex items-center gap-1 rounded-nested bg-neutral-soft px-2 py-0.5 text-ink-2 ring-1 ring-neutral-rule">
                      <Eyebrow as="span">{t.type}</Eyebrow>
                      <span className="fig">
                        {t.minQty}
                        {t.maxQty ? `–${t.maxQty}` : "+"}
                      </span>
                      <span className="fig font-medium text-ink-1">{formatCurrency(Number(t.price), t.currency as never)}</span>
                    </span>
                  ))}
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No product offers a volume tier."
              body="A product appears here once a seller sets a price row with a minimum quantity above one."
              icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
