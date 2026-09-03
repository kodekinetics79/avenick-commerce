import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getCustomerSegments } from "@avenick/database";
import { PieChart, Users, Crown } from "lucide-react";
import {
  PageHeader, CellGrid, Surface, Bar, EmptyState, Eyebrow, Dateline,
} from "@avenick/ui";
import { getTranslations } from "next-intl/server";
import { CountStat } from "@/app/finance/money-figures";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.segments");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/** Buyer roles the platform models; the labels come from `segments.role`. */
const KNOWN_ROLES = new Set(["CONSUMER", "COMPANY_ADMIN", "COMPANY_BUYER", "COMPANY_APPROVER"]);

// Spend is SUM(order total) per buyer as recorded in each order's own currency;
// nothing is converted, so the figure carries no currency symbol.
const amount = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 0 });

export default async function SegmentsPage() {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.segments");

  const s = await getCustomerSegments();
  // A role the platform does not model is shown by its own code rather than
  // under an invented label.
  const roleLabel = (role: string) => (KNOWN_ROLES.has(role) ? t(`role.${role}`) : role);
  const totalUsers = s.byRole.reduce((sum, r) => sum + r.count, 0);

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
          <CountStat label={t("stats.accounts")} value={totalUsers} rank="section" />
          <CountStat label={t("stats.active")} value={s.activeLast30d} />
          <CountStat label={t("stats.highValue")} value={s.highValue.length} />
          <CountStat label={t("stats.dormant")} value={s.dormant60d} />
        </CellGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* By role */}
          <Surface className="p-5">
            <h2 className="u-h3 inline-flex items-center gap-2 border-b-2 border-border-strong pb-2 text-ink-1">
              <PieChart className="h-4 w-4 text-ink-3" aria-hidden="true" /> {t("byRole.title")}
            </h2>
            {s.byRole.length === 0 ? (
              <EmptyState
                eyebrow={t("emptyEyebrow")}
                headline={t("byRole.emptyHeadline")}
                body={t("byRole.emptyBody")}
                icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            ) : (
              <ul className="mt-4 space-y-3">
                {s.byRole.map((r, index) => (
                  <li key={r.role} className="flex items-center gap-3">
                    <span className="u-ui w-40 shrink-0 text-ink-1">{roleLabel(r.role)}</span>
                    <Bar
                      value={Math.max(3, (r.count / Math.max(1, totalUsers)) * 100)}
                      max={100}
                      index={index}
                      label={t("byRole.barLabel", { role: roleLabel(r.role), count: String(r.count), total: String(totalUsers) })}
                      className="flex-1"
                    />
                    <span className="fig u-ui w-10 shrink-0 text-end font-medium text-ink-1">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Surface>

          {/* High value buyers */}
          <Surface className="overflow-hidden">
            <div className="border-b-2 border-border-strong px-5 py-3">
              <h2 className="u-h3 inline-flex items-center gap-2 text-ink-1">
                {/* The one brass mark on this page — a tier marker, which is one
                    of its three permitted uses. */}
                <Crown className="h-4 w-4 text-brass-ink" aria-hidden="true" /> {t("highValue.title")}
              </h2>
              <Dateline className="mt-0.5">
                {t("highValue.dateline", {
                  count: s.totalWithPurchases,
                  value: String(s.totalWithPurchases),
                })}
              </Dateline>
            </div>
            {s.highValue.length === 0 ? (
              <EmptyState
                eyebrow={t("emptyEyebrow")}
                headline={t("highValue.emptyHeadline")}
                body={t("highValue.emptyBody")}
                icon={<Crown className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            ) : (
              <ul>
                {s.highValue.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="u-ui truncate font-medium text-ink-1">{b.name}</p>
                      <p className="u-meta truncate text-ink-3">{b.email}</p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="fig u-ui font-medium text-ink-1">{amount(b.spent)}</p>
                      <Eyebrow>{t("ordersCount", { count: b.orders, value: String(b.orders) })}</Eyebrow>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </div>
      </div>
    </AdminLayout>
  );
}
