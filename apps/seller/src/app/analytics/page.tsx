import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { LISTING_TRAFFIC_WINDOW_DAYS, db, loadSellerListingTraffic } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import {
  CellGrid,
  Dateline,
  EmptyState,
  LedgerTable,
  Meter,
  PageHeader,
  SectionHeader,
  Stat,
  Surface,
} from "@avenick/ui";
import { TrendingUp, ShoppingCart, Wallet, Package, Eye } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ColumnChart } from "./column-chart";
import { StatusPill } from "@avenick/ui";

export async function generateMetadata() {
  const t = await getTranslations("sellerShell.analytics");
  return { title: t("title") };
}

/**
 * Month keys, not month names: the axis labels are read from the message tree
 * inside the page, where a translator exists. The order is the calendar's, so
 * the index from Date#getMonth still addresses it.
 */
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

export default async function AnalyticsPage() {
  const { seller, membership } = await requireSellerPermission("analytics.view");
  const t = await getTranslations("sellerShell.analytics");
  const tMonth = await getTranslations("sellerShell.months");
  const monthLabel = (index: number) => tMonth(MONTH_KEYS[index]!);
  const tTraffic = await getTranslations("sellerShell.analytics.traffic");
  /** One decimal place: conversion moves in tenths, and rounding to whole
   *  percents makes a 0.4% listing and a 1.4% listing print the same. */
  const pct = (share: number) => `${(share * 100).toFixed(1)}%`;

  // Views the storefront already records, which until now only the customer-side
  // trending ranker read. See loadSellerListingTraffic for why this is separate
  // from the currency-scoped figures below.
  //
  // Caught, not awaited bare: this is ONE section of a page whose other four
  // are computed from order lines and are fine without it. A view-signal read
  // that fails — a cold database, a timeout, an environment where the signal
  // table has not been migrated yet — must not take down the whole of a
  // seller's analytics. The same shape the admin approvals queue uses for its
  // counts: a failed read renders as a stated gap, never as a zero, because
  // "0 views" and "we could not ask" are different facts and only one of them
  // is a finding about the listing.
  const traffic = await loadSellerListingTraffic(seller.id).catch(() => null);

  const allItems = await db.orderItem.findMany({
    where: { sellerId: seller.id, order: { status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } } },
    include: {
      order: { select: { id: true, createdAt: true, currency: true } },
      product: { select: { nameEn: true, category: { select: { nameEn: true } } } },
    },
  });

  // Order lines carry the order's currency, and a GCC seller can sell in more
  // than one. Adding lines across currencies and calling the sum "AED" (what
  // this page used to do) produced a figure that exists in no ledger, so the
  // analytics are computed in the seller's most-used currency and the lines
  // left out are disclosed below the KPIs.
  const currencyCounts = new Map<string, number>();
  for (const i of allItems) currencyCounts.set(i.order.currency, (currencyCounts.get(i.order.currency) ?? 0) + 1);
  const currency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const items = currency ? allItems.filter((i) => i.order.currency === currency) : [];
  const excludedCount = allItems.length - items.length;
  const excludedCurrencies = [...currencyCounts.keys()].filter((c) => c !== currency).sort();
  const money = (n: number) => (currency ? formatCurrency(n, currency as never) : "—");

  const orderIds = new Set(items.map((i) => i.order.id));
  const totalRevenue = items.reduce((s, i) => s + Number(i.total), 0);
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const aov = orderIds.size > 0 ? totalRevenue / orderIds.size : 0;

  const now = new Date();
  const thisMonthRev = items.filter((i) => i.order.createdAt.getMonth() === now.getMonth() && i.order.createdAt.getFullYear() === now.getFullYear()).reduce((s, i) => s + Number(i.total), 0);

  // Monthly revenue trend
  const trend: { label: string; value: number }[] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const value = items.filter((i) => i.order.createdAt.getMonth() === d.getMonth() && i.order.createdAt.getFullYear() === d.getFullYear()).reduce((s, i) => s + Number(i.total), 0);
    trend.push({ label: monthLabel(d.getMonth()), value });
  }

  // Top products
  const byProduct = new Map<string, { revenue: number; units: number }>();
  for (const i of items) {
    const k = i.product?.nameEn ?? i.nameEn;
    const cur = byProduct.get(k) ?? { revenue: 0, units: 0 };
    cur.revenue += Number(i.total);
    cur.units += i.quantity;
    byProduct.set(k, cur);
  }
  const topProducts = [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const topMax = Math.max(1, ...topProducts.map((p) => p.revenue));

  // Revenue by category
  const byCat = new Map<string, number>();
  for (const i of items) {
    const k = i.product?.category?.nameEn ?? t("category.other");
    byCat.set(k, (byCat.get(k) ?? 0) + Number(i.total));
  }
  const categories = [...byCat.entries()].map(([name, revenue]) => ({ name, revenue, pct: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0 })).sort((a, b) => b.revenue - a.revenue);

  // Chart captions are abbreviated so six of them fit above six columns. The
  // exact figure travels with the column as its hover title and as the string a
  // screen reader is given, so nothing is only ever shown rounded.
  const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

  const kpis = [
    // Total revenue leads at section rank: the other three qualify it, and a
    // grid of four figures at identical weight is why nothing on this page could
    // be subordinate to anything.
    { key: "revenue", label: currency ? t("kpi.totalRevenueIn", { currency }) : t("kpi.totalRevenue"), value: money(totalRevenue), icon: Wallet, rank: "section" as const, note: t("kpi.totalRevenueNote") },
    { key: "month", label: t("kpi.thisMonth"), value: money(thisMonthRev), icon: TrendingUp, rank: "inline" as const, note: t("kpi.thisMonthNote") },
    { key: "orders", label: t("kpi.orders"), value: orderIds.size, icon: ShoppingCart, rank: "inline" as const, note: t("kpi.ordersNote") },
    { key: "aov", label: t("kpi.aov"), value: money(aov), icon: Package, rank: "inline" as const, note: t("kpi.aovNote") },
  ];

  const empty = items.length === 0;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          className="mb-0"
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={currency ? t("datelineWithCurrency", { currency }) : t("datelineEmpty")}
        />

        <CellGrid cols={{ base: 2, lg: 4 }}>
          {kpis.map((k) => (
            <Stat key={k.key} label={k.label} value={k.value} rank={k.rank} icon={k.icon} note={k.note} />
          ))}
        </CellGrid>
        {excludedCount > 0 && (
          <Dateline>
            {t("excluded", {
              count: excludedCount,
              n: String(excludedCount),
              currencies: excludedCurrencies.join(", "),
              currency: currency ?? "",
            })}
          </Dateline>
        )}

        {empty ? (
          <Surface rung={1}>
            <EmptyState
              eyebrow={t("empty.eyebrow")}
              headline={t("empty.headline")}
              body={t("empty.body")}
            />
          </Surface>
        ) : (
          <>
            {/* Revenue trend */}
            <Surface rung={2} className="p-5">
              <SectionHeader
                icon={TrendingUp}
                title={t("trend.title")}
                dateline={t("trend.dateline", { currency: currency ?? "" })}
              />
              <ColumnChart
                label={t("trend.chartLabel", { currency: currency ?? "" })}
                plotHeight="h-44"
                data={trend.map((m) => ({
                  label: m.label,
                  value: m.value,
                  caption: m.value > 0 ? compact(m.value) : "—",
                  exact: money(m.value),
                }))}
              />
            </Surface>

            <div className="grid gap-block lg:grid-cols-2">
              {/* Top products — a ledger rather than six bars, so the units and
                  the revenue can be read down their own columns. */}
              <LedgerTable
                className="min-w-0"
                title={t("top.title")}
                dateline={t("top.dateline", { currency: currency ?? "" })}
                rows={topProducts}
                getRowKey={(product) => product.name}
                columns={[
                  { key: "name", label: t("top.columns.product"), render: (product) => <span className="truncate">{product.name}</span> },
                  {
                    key: "share",
                    // The bar is scaled to the highest-revenue product, not to a
                    // share of anything: a full bar means "this is the top one",
                    // which is what makes six rows comparable at a glance. It was
                    // headed "Share of top six", and a reader would have taken a
                    // full bar to mean 100% of the six — a percentage the data
                    // does not carry. The head now says what the bar is.
                    label: t("top.columns.vsTop"),
                    width: "112px",
                    hideOnMobile: true,
                    render: (product, index) => (
                      <Meter
                        value={product.revenue}
                        max={topMax}
                        tone="accent"
                        index={index}
                        label={t("top.meterLabel", {
                          name: product.name,
                          value: money(product.revenue),
                          max: money(topMax),
                        })}
                      />
                    ),
                  },
                  { key: "units", label: t("top.columns.units"), numeric: true },
                  { key: "revenue", label: t("top.columns.revenue"), numeric: true, render: (product) => money(product.revenue) },
                ]}
                empty={
                  <EmptyState
                    eyebrow={t("top.empty.eyebrow")}
                    headline={t("top.empty.headline")}
                    body={t("top.empty.body", { currency: currency ?? "" })}
                  />
                }
              />

              {/* Revenue by category */}
              <LedgerTable
                className="min-w-0"
                title={t("category.title")}
                dateline={t("category.dateline", {
                  total: money(totalRevenue),
                  units: totalUnits.toLocaleString(),
                  count: categories.length,
                  n: String(categories.length),
                })}
                rows={categories}
                getRowKey={(category) => category.name}
                columns={[
                  { key: "name", label: t("category.columns.category"), render: (category) => <span className="truncate">{category.name}</span> },
                  {
                    key: "share",
                    label: t("category.columns.share"),
                    width: "112px",
                    hideOnMobile: true,
                    render: (category, index) => (
                      <Meter
                        value={category.pct}
                        tone="accent"
                        index={index}
                        label={t("category.meterLabel", { name: category.name, pct: String(category.pct) })}
                      />
                    ),
                  },
                  { key: "pct", label: "%", numeric: true, render: (category) => `${category.pct}%` },
                  { key: "revenue", label: t("category.columns.revenue"), numeric: true, render: (category) => money(category.revenue) },
                ]}
                empty={
                  <EmptyState
                    eyebrow={t("category.empty.eyebrow")}
                    headline={t("category.empty.headline")}
                    body={t("category.empty.body")}
                  />
                }
              />
            </div>
          </>
        )}

        {/* ── Traffic and conversion ─────────────────────────────────────────
            Revenue says what was bought. This says what was LOOKED AT and not
            bought, which is the only figure on the page that distinguishes a
            listing with a price/photo/copy problem from one with a
            discoverability problem — they are identical on every chart above
            and call for opposite work. */}
        <Surface as="section" rung={2} className="p-5">
          <SectionHeader
            icon={Eye}
            eyebrow={tTraffic("eyebrow")}
            title={tTraffic("title")}
            description={tTraffic("description", { days: String(LISTING_TRAFFIC_WINDOW_DAYS) })}
          />

          {traffic === null ? (
            <EmptyState
              eyebrow={tTraffic("unread.eyebrow")}
              headline={tTraffic("unread.headline")}
              body={tTraffic("unread.body")}
            />
          ) : traffic.rows.length === 0 ? (
            <EmptyState
              eyebrow={tTraffic("empty.eyebrow")}
              headline={tTraffic("empty.headline")}
              body={tTraffic("empty.body", { days: String(LISTING_TRAFFIC_WINDOW_DAYS) })}
            />
          ) : (
            <>
              <CellGrid className="mb-4">
                <Stat
                  label={tTraffic("kpi.views")}
                  value={traffic.totals.views.toLocaleString("en-US")}
                  rank="inline"
                  note={tTraffic("kpi.viewsNote")}
                />
                <Stat
                  label={tTraffic("kpi.units")}
                  value={traffic.totals.unitsOrdered.toLocaleString("en-US")}
                  rank="inline"
                  note={tTraffic("kpi.unitsNote")}
                />
                <Stat
                  label={tTraffic("kpi.conversion")}
                  // Never a zero for "nobody looked": that is unmeasured, and
                  // the em dash is what this portal prints for unmeasured.
                  value={traffic.totals.conversion === null ? "—" : pct(traffic.totals.conversion)}
                  rank="inline"
                  note={tTraffic("kpi.conversionNote")}
                />
              </CellGrid>

              <LedgerTable
                rows={traffic.rows}
                getRowKey={(row) => row.productId}
                dateline={tTraffic("dateline", { days: String(LISTING_TRAFFIC_WINDOW_DAYS) })}
                columns={[
                  {
                    key: "listing",
                    label: tTraffic("columns.listing"),
                    render: (row) => (
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-1">{row.nameEn}</p>
                        <p className="u-meta u-mono truncate text-ink-3">{row.sku}</p>
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    label: tTraffic("columns.status"),
                    hideOnMobile: true,
                    render: (row) => (
                      <StatusPill tone={row.status === "ACTIVE" ? "success" : "neutral"}>
                        {row.status.replace(/_/g, " ")}
                      </StatusPill>
                    ),
                  },
                  {
                    key: "views",
                    label: tTraffic("columns.views"),
                    numeric: true,
                    render: (row) => row.views.toLocaleString("en-US"),
                  },
                  {
                    key: "units",
                    label: tTraffic("columns.units"),
                    numeric: true,
                    render: (row) => row.unitsOrdered.toLocaleString("en-US"),
                  },
                  {
                    key: "conversion",
                    label: tTraffic("columns.conversion"),
                    numeric: true,
                    render: (row) =>
                      row.conversion === null ? (
                        <span className="text-ink-3" title={tTraffic("noViewsTitle")}>—</span>
                      ) : (
                        pct(row.conversion)
                      ),
                  },
                  {
                    key: "sales",
                    label: tTraffic("columns.sales"),
                    numeric: true,
                    hideOnMobile: true,
                    render: (row) => (row.orderedProductSales === null ? "—" : money(row.orderedProductSales)),
                  },
                ]}
                // Unreachable: the branch above renders the empty state instead
                // of the table. LedgerTable requires the prop, and repeating the
                // same blank here keeps the two from ever disagreeing.
                empty={
                  <EmptyState
                    eyebrow={tTraffic("empty.eyebrow")}
                    headline={tTraffic("empty.headline")}
                    body={tTraffic("empty.body", { days: String(LISTING_TRAFFIC_WINDOW_DAYS) })}
                  />
                }
              />

              <Dateline className="mt-3">
                {tTraffic("provenance")}
                {traffic.excludedLineCount > 0 && (
                  <>
                    {" "}
                    {tTraffic("excluded", {
                      count: traffic.excludedLineCount,
                      n: String(traffic.excludedLineCount),
                      currencies: traffic.excludedCurrencies.join(", "),
                    })}
                  </>
                )}
              </Dateline>
            </>
          )}
        </Surface>
      </div>
    </SellerLayout>
  );
}
