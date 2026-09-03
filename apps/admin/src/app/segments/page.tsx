import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getCustomerSegments } from "@avenick/database";
import { PieChart, Users, Crown } from "lucide-react";
import {
  PageHeader, CellGrid, Surface, Bar, EmptyState, Eyebrow, Dateline,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";

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
      <div className="space-y-block">
        <PageHeader
          eyebrow="CRM"
          title="Customer segments"
          description="Segments computed live from user roles and purchase behaviour — no manual lists to maintain."
          dateline="Spend is the sum of order totals as recorded, each in its own currency · no conversion applied, so it carries no currency symbol"
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label="Buyer accounts" value={totalUsers} rank="section" />
          <CountStat label="Active (30d)" value={s.activeLast30d} />
          <CountStat label="High value (top 20%)" value={s.highValue.length} />
          <CountStat label="Dormant (60d+)" value={s.dormant60d} />
        </CellGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* By role */}
          <Surface className="p-5">
            <h2 className="u-h3 inline-flex items-center gap-2 border-b-2 border-border-strong pb-2 text-ink-1">
              <PieChart className="h-4 w-4 text-ink-3" aria-hidden="true" /> Buyer accounts by role
            </h2>
            {s.byRole.length === 0 ? (
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No buyer account exists yet."
                body="A role appears here as soon as one account carries it."
                icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            ) : (
              <ul className="mt-4 space-y-3">
                {s.byRole.map((r, index) => (
                  <li key={r.role} className="flex items-center gap-3">
                    <span className="u-ui w-40 shrink-0 text-ink-1">{ROLE_LABEL[r.role] ?? r.role}</span>
                    <Bar
                      value={Math.max(3, (r.count / Math.max(1, totalUsers)) * 100)}
                      max={100}
                      index={index}
                      label={`${ROLE_LABEL[r.role] ?? r.role}: ${r.count} of ${totalUsers} accounts`}
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
                <Crown className="h-4 w-4 text-brass-ink" aria-hidden="true" /> High-value buyers
              </h2>
              <Dateline className="mt-0.5">
                Top 20% by lifetime spend · {s.totalWithPurchases} buyer{s.totalWithPurchases === 1 ? "" : "s"} with purchases
              </Dateline>
            </div>
            {s.highValue.length === 0 ? (
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No purchase has been made yet."
                body="A high-value buyer appears here once orders exist to rank."
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
                      <Eyebrow>{b.orders} order{b.orders === 1 ? "" : "s"}</Eyebrow>
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
