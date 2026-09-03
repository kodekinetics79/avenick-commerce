import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getCrmOverview } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { Users, Activity, Store, Crown, Eye, ShoppingCart, FileQuestion } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, Surface, Num, Eyebrow, Dateline, StatusPill,
} from "@avenick/ui";
import { getTranslations } from "next-intl/server";
import { CountStat } from "@/app/finance/money-figures";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.crm");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/**
 * Three activity kinds, three neutral chips. The old map painted them slate,
 * green and purple, which read as three severities where there is only one:
 * these are all just things a buyer did. Only the icon lives here; the label
 * is translated under `adminCommerce.crm.activity`.
 */
const ACTIVITY_ICON: Record<string, typeof Eye> = {
  VIEW: Eye,
  ORDER: ShoppingCart,
  RFQ: FileQuestion,
};

// Spend is SUM(order total) per buyer as recorded in each order's own currency;
// nothing is converted, so the figure carries no currency symbol.
const amount = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 0 });

export default async function CrmPage() {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.crm");

  const { relationships, activities, topBuyers } = await getCrmOverview();

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
          <CountStat label={t("stats.buyers")} value={topBuyers.length} rank="section" />
          <CountStat label={t("stats.relationships")} value={relationships.length} />
          <CountStat label={t("stats.activities")} value={activities.length} dateline={t("stats.activitiesDateline")} />
          <CountStat
            label={t("stats.topSpend")}
            value={topBuyers[0] ? amount(topBuyers[0].spent) : "—"}
            dateline={t("stats.topSpendDateline")}
          />
        </CellGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top buyers */}
          <Surface className="overflow-hidden">
            <div className="border-b-2 border-border-strong px-5 py-3">
              <h2 className="u-h3 inline-flex items-center gap-2 text-ink-1">
                {/* Brass, used as a rank mark — one of its three permitted uses. */}
                <Crown className="h-4 w-4 text-brass-ink" aria-hidden="true" /> {t("topBuyers.title")}
              </h2>
              <Dateline className="mt-0.5">{t("topBuyers.dateline")}</Dateline>
            </div>
            {topBuyers.length === 0 ? (
              <EmptyState
                eyebrow={t("emptyEyebrow")}
                headline={t("topBuyers.emptyHeadline")}
                body={t("topBuyers.emptyBody")}
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
                        {t("ordersCount", { count: b.orders, value: String(b.orders) })}
                        {b.lastorder ? t("topBuyers.lastOrder", { date: format(b.lastorder, "MMM d") }) : ""}
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
                <Activity className="h-4 w-4 text-ink-3" aria-hidden="true" /> {t("activityPanel.title")}
              </h2>
            </div>
            {activities.length === 0 ? (
              <EmptyState
                eyebrow={t("emptyEyebrow")}
                headline={t("activityPanel.emptyHeadline")}
                body={t("activityPanel.emptyBody")}
                icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            ) : (
              <ul>
                {activities.map((a) => {
                  // An activity kind the platform does not model is shown by
                  // its own code rather than under an invented label.
                  const known = Object.prototype.hasOwnProperty.call(ACTIVITY_ICON, a.type);
                  const Icon = ACTIVITY_ICON[a.type] ?? Activity;
                  return (
                    <li key={a.id} className="flex items-center gap-3 border-b border-hairline px-5 py-3 last:border-b-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-nested bg-neutral-soft text-ink-3">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="u-ui text-ink-1">
                          <span className="font-medium">{a.buyer.firstName} {a.buyer.lastName}</span>
                          <span className="text-ink-2"> · {known ? t(`activity.${a.type}`) : a.type}</span>
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
          title={t("relationships.title")}
          dateline={t("relationships.dateline")}
          rows={relationships}
          getRowKey={(r) => r.id}
          stickyHead
          columns={[
            {
              key: "buyer",
              label: t("relationships.columns.buyer"),
              render: (r) =>
                r.buyer ? (
                  <div className="min-w-0 py-1">
                    <p className="truncate font-medium text-ink-1">{r.buyer.firstName} {r.buyer.lastName}</p>
                    <p className="u-meta truncate text-ink-3">{r.buyer.email}</p>
                  </div>
                ) : (
                  <span className="text-ink-3">{t("relationships.unknownBuyer")}</span>
                ),
            },
            {
              key: "seller",
              label: t("relationships.columns.seller"),
              render: (r) => (
                <span className="inline-flex items-center gap-2 text-ink-2">
                  <Store className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" /> {r.seller.businessNameEn}
                </span>
              ),
            },
            { key: "totalOrders", label: t("relationships.columns.orders"), numeric: true, render: (r) => r.totalOrders },
            {
              key: "totalSpent",
              label: t("relationships.columns.spend"),
              numeric: true,
              render: (r) => <Num value={formatCurrency(Number(r.totalSpent), r.currency as never)} className="whitespace-nowrap" />,
            },
            {
              key: "lastOrderAt",
              label: t("relationships.columns.lastOrder"),
              hideOnMobile: true,
              render: (r) => (
                <span className="whitespace-nowrap text-ink-2">{r.lastOrderAt ? format(r.lastOrderAt, "MMM d, yyyy") : "—"}</span>
              ),
            },
            {
              key: "tags",
              label: t("relationships.columns.tags"),
              hideOnMobile: true,
              render: (r) =>
                r.tags.length > 0 ? (
                  <span className="flex flex-wrap gap-1 py-1">
                    {r.tags.map((tag) => (
                      <StatusPill key={tag} tone="neutral">{tag}</StatusPill>
                    ))}
                  </span>
                ) : (
                  <span className="text-ink-3">—</span>
                ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("emptyEyebrow")}
              headline={t("relationships.emptyHeadline")}
              body={t("relationships.emptyBody")}
              icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
