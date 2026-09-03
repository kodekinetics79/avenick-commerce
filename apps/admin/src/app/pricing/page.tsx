import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { Coins, Layers, Store } from "lucide-react";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Num, Eyebrow, Dateline,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.pricing");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.pricing");

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
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label={t("stats.b2c")} value={b2cCount} />
          <CountStat label={t("stats.b2b")} value={b2bCount} />
          <CountStat
            label={t("stats.avgCommission")}
            value={`${avgCommission}%`}
            rank="section"
            dateline={t("stats.avgCommissionDateline", { count: sellers.length, value: String(sellers.length) })}
          />
          <CountStat
            label={t("stats.tiered")}
            value={tieredProducts.length}
            dateline={t("stats.tieredDateline")}
          />
        </CellGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Commission rates */}
          <LedgerTable
            title={t("commission.title")}
            dateline={t("commission.dateline")}
            rows={sellers}
            getRowKey={(s) => s.id}
            density="compact"
            columns={[
              { key: "seller", label: t("commission.columns.seller"), render: (s) => <span className="font-medium text-ink-1">{s.businessNameEn}</span> },
              { key: "tier", label: t("commission.columns.tier"), render: (s) => <StatusPill tone="neutral">{s.tier}</StatusPill> },
              { key: "rate", label: t("commission.columns.rate"), numeric: true, render: (s) => <Num value={`${Number(s.commissionRate)}%`} /> },
              { key: "products", label: t("commission.columns.products"), numeric: true, render: (s) => <span className="text-ink-3">{s._count.products}</span> },
              { key: "commissions", label: t("commission.columns.commissions"), numeric: true, render: (s) => <span className="text-ink-3">{s._count.commissions}</span> },
            ]}
            empty={
              <EmptyState
                eyebrow={t("emptyEyebrow")}
                headline={t("commission.emptyHeadline")}
                body={t("commission.emptyBody")}
                icon={<Store className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            }
          />

          {/* Price change audit */}
          <Surface className="overflow-hidden">
            <div className="border-b-2 border-border-strong px-5 py-3">
              <h2 className="u-h3 text-ink-1">{t("changes.title")}</h2>
              <Dateline className="mt-0.5">{t("changes.dateline")}</Dateline>
            </div>
            {recentPriceChanges.length === 0 ? (
              <EmptyState
                eyebrow={t("emptyEyebrow")}
                headline={t("changes.emptyHeadline")}
                body={t("changes.emptyBody")}
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
                        <span className="font-medium">{c.actor ? `${c.actor.firstName} ${c.actor.lastName}` : t("changes.system")}</span>
                        <span className="text-ink-2">{t("changes.changedPrice")}</span>
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
          title={t("tiers.title")}
          dateline={t("tiers.dateline")}
          rows={tieredProducts}
          getRowKey={(p) => p.id}
          columns={[
            {
              key: "product",
              label: t("tiers.columns.product"),
              render: (p) => (
                <div className="min-w-0 py-1">
                  <p className="truncate font-medium text-ink-1">{p.nameEn}</p>
                  <p className="u-mono u-meta text-ink-3">{p.sku}</p>
                </div>
              ),
            },
            { key: "seller", label: t("tiers.columns.seller"), render: (p) => <span className="text-ink-2">{p.seller.businessNameEn}</span> },
            {
              key: "tiers",
              label: t("tiers.columns.tiers"),
              render: (p) => (
                <div className="flex flex-wrap gap-1.5 py-1">
                  {p.prices.map((tier, i) => (
                    <span key={i} className="u-meta inline-flex items-center gap-1 rounded-nested bg-neutral-soft px-2 py-0.5 text-ink-2 ring-1 ring-neutral-rule">
                      <Eyebrow as="span">{tier.type}</Eyebrow>
                      <span className="fig">
                        {tier.minQty}
                        {tier.maxQty ? `–${tier.maxQty}` : "+"}
                      </span>
                      <span className="fig font-medium text-ink-1">{formatCurrency(Number(tier.price), tier.currency as never)}</span>
                    </span>
                  ))}
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("emptyEyebrow")}
              headline={t("tiers.emptyHeadline")}
              body={t("tiers.emptyBody")}
              icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
