import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getCrmOverview } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { Users, Activity, Store, Crown, Eye, ShoppingCart, FileQuestion } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, Surface, Num, Eyebrow, Dateline, StatusPill,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";

export const metadata = { title: "CRM & Accounts" };
export const dynamic = "force-dynamic";

/**
 * Three activity kinds, three neutral chips. The old map painted them slate,
 * green and purple, which read as three severities where there is only one:
 * these are all just things a buyer did.
 */
const ACTIVITY_CONFIG: Record<string, { label: string; icon: typeof Eye }> = {
  VIEW: { label: "Viewed product", icon: Eye },
  ORDER: { label: "Placed order", icon: ShoppingCart },
  RFQ: { label: "Requested quote", icon: FileQuestion },
};

// Spend is SUM(order total) per buyer as recorded in each order's own currency;
// nothing is converted, so the figure carries no currency symbol.
const amount = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 0 });

export default async function CrmPage() {
  await requireAdminSession();

  const { relationships, activities, topBuyers } = await getCrmOverview();

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="CRM"
          title="CRM & accounts"
          description="Buyer relationships, purchase history, and recent account activity — live from the order ledger."
          dateline="Buyer spend is the sum of order totals as recorded, each in its own currency · no conversion applied, so it carries no currency symbol"
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label="Buyers with purchases" value={topBuyers.length} rank="section" />
          <CountStat label="Seller–buyer relationships" value={relationships.length} />
          <CountStat label="Activities" value={activities.length} dateline="The recent window loaded below" />
          <CountStat
            label="Top buyer spend"
            value={topBuyers[0] ? amount(topBuyers[0].spent) : "—"}
            dateline="As recorded, unconverted — so it carries no currency"
          />
        </CellGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top buyers */}
          <Surface className="overflow-hidden">
            <div className="border-b-2 border-border-strong px-5 py-3">
              <h2 className="u-h3 inline-flex items-center gap-2 text-ink-1">
                {/* Brass, used as a rank mark — one of its three permitted uses. */}
                <Crown className="h-4 w-4 text-brass-ink" aria-hidden="true" /> Top buyers by lifetime spend
              </h2>
              <Dateline className="mt-0.5">Order totals as recorded, unconverted</Dateline>
            </div>
            {topBuyers.length === 0 ? (
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No order has been paid yet."
                body="A buyer appears here after their first purchase."
                icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            ) : (
              <ol>
                {topBuyers.map((b, i) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3 last:border-b-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="fig flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-neutral-soft text-micro font-medium text-ink-3">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="u-ui truncate font-medium text-ink-1">{b.name}</p>
                        <p className="u-meta truncate text-ink-3">
                          {b.email} · {b.role === "CONSUMER" ? "B2C" : "B2B"}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="fig u-ui font-medium text-ink-1">{amount(b.spent)}</p>
                      <Eyebrow>
                        {b.orders} order{b.orders === 1 ? "" : "s"}
                        {b.lastorder ? ` · last ${format(b.lastorder, "MMM d")}` : ""}
                      </Eyebrow>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Surface>

          {/* Recent activity */}
          <Surface className="overflow-hidden">
            <div className="border-b-2 border-border-strong px-5 py-3">
              <h2 className="u-h3 inline-flex items-center gap-2 text-ink-1">
                <Activity className="h-4 w-4 text-ink-3" aria-hidden="true" /> Recent buyer activity
              </h2>
            </div>
            {activities.length === 0 ? (
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No buyer activity has been tracked."
                body="Views, orders and quote requests appear here as they are recorded."
                icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            ) : (
              <ul>
                {activities.map((a) => {
                  const cfg = ACTIVITY_CONFIG[a.type] ?? { label: a.type, icon: Activity };
                  const Icon = cfg.icon;
                  return (
                    <li key={a.id} className="flex items-center gap-3 border-b border-hairline px-5 py-3 last:border-b-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-nested bg-neutral-soft text-ink-3">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="u-ui text-ink-1">
                          <span className="font-medium">{a.buyer.firstName} {a.buyer.lastName}</span>
                          <span className="text-ink-2"> · {cfg.label}</span>
                        </p>
                        <p className="u-meta text-ink-3">{formatDistanceToNow(a.createdAt, { addSuffix: true })}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Surface>
        </div>

        {/* Seller–buyer relationships */}
        <LedgerTable
          title="Seller–buyer relationships"
          dateline="Lifetime spend per pair, in the currency recorded on the relationship · no conversion applied"
          rows={relationships}
          getRowKey={(r) => r.id}
          stickyHead
          columns={[
            {
              key: "buyer",
              label: "Buyer",
              render: (r) =>
                r.buyer ? (
                  <div className="min-w-0 py-1">
                    <p className="truncate font-medium text-ink-1">{r.buyer.firstName} {r.buyer.lastName}</p>
                    <p className="u-meta truncate text-ink-3">{r.buyer.email}</p>
                  </div>
                ) : (
                  <span className="text-ink-3">Unknown buyer</span>
                ),
            },
            {
              key: "seller",
              label: "Seller",
              render: (r) => (
                <span className="inline-flex items-center gap-2 text-ink-2">
                  <Store className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" /> {r.seller.businessNameEn}
                </span>
              ),
            },
            { key: "totalOrders", label: "Orders", numeric: true, render: (r) => r.totalOrders },
            {
              key: "totalSpent",
              label: "Lifetime spend",
              numeric: true,
              render: (r) => <Num value={formatCurrency(Number(r.totalSpent), r.currency as never)} className="whitespace-nowrap" />,
            },
            {
              key: "lastOrderAt",
              label: "Last order",
              hideOnMobile: true,
              render: (r) => (
                <span className="whitespace-nowrap text-ink-2">{r.lastOrderAt ? format(r.lastOrderAt, "MMM d, yyyy") : "—"}</span>
              ),
            },
            {
              key: "tags",
              label: "Tags",
              hideOnMobile: true,
              render: (r) =>
                r.tags.length > 0 ? (
                  <span className="flex flex-wrap gap-1 py-1">
                    {r.tags.map((t) => (
                      <StatusPill key={t} tone="neutral">{t}</StatusPill>
                    ))}
                  </span>
                ) : (
                  <span className="text-ink-3">—</span>
                ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No seller–buyer relationship has been recorded."
              body="A relationship row is written the first time a buyer orders from a seller."
              icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
