import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getRetentionMetrics } from "@avenick/database";
import { Repeat, Users, Moon, TrendingUp, Heart } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Button, CellGrid, Dateline, EmptyState, LedgerTable, Meter, PageHeader, Stat, StatusPill,
} from "@avenick/ui";

export const metadata = { title: "Retention" };
export const dynamic = "force-dynamic";

type MonthRow = { month: Date; newBuyers: number; returning: number };

export default async function RetentionPage() {
  await requireAdminSession();

  const m = await getRetentionMetrics();
  // The scale every bar is drawn against, stated once and used for both series,
  // so a month's two bars are comparable with each other AND with every other
  // month's. Scaling each row to its own total is the classic way a chart
  // flatters a bad month.
  const maxMonthly = Math.max(1, ...m.monthly.map((x) => x.newBuyers + x.returning));

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="CRM"
          title="Retention"
          description="Repeat purchase behaviour, computed from paid orders at request time."
          actions={<StatusPill>Read only</StatusPill>}
          dateline="A buyer is anyone with at least one PAID order. Repeat means more than one. Dormant means no paid order in the last 60 days. No cohort model, no projection and no forecast is applied."
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <Stat label="Buyers with purchases" value={m.totalBuyers} icon={Users} />
          <Stat label="Repeat buyers" value={m.repeatBuyers} icon={Repeat} />
          <Stat label="Repeat rate" value={m.repeatRate} unit="%" icon={TrendingUp} />
          <Stat
            label="Dormant · 60 days"
            value={m.dormantBuyers}
            icon={Moon}
            note="No paid order in the last 60 days"
          />
        </CellGrid>

        <LedgerTable<MonthRow>
          title="New against returning buyers, by month"
          dateline="Counted by the month of each paid order · a buyer is NEW in the month of their first paid order and RETURNING in every month after it"
          rows={m.monthly}
          getRowKey={(row) => String(row.month)}
          density="compact"
          columns={[
            {
              key: "month",
              label: "Month",
              width: "104px",
              render: (row) => <span className="tnum text-ink-1">{format(row.month, "MMM yyyy")}</span>,
            },
            {
              key: "mix",
              label: "Mix",
              render: (row) => (
                // Two meters against ONE shared maximum, drawn from the inline
                // start, so the pair is correct in Arabic with no mirrored rule
                // and the numbers beside them never move.
                <div className="max-w-md space-y-1.5 py-1">
                  <Meter
                    value={row.newBuyers}
                    max={maxMonthly}
                    tone="accent"
                    size="sm"
                    label={`${format(row.month, "MMMM yyyy")}: ${row.newBuyers} new buyers`}
                  />
                  <Meter
                    value={row.returning}
                    max={maxMonthly}
                    tone="accent"
                    index={1}
                    size="sm"
                    label={`${format(row.month, "MMMM yyyy")}: ${row.returning} returning buyers`}
                  />
                </div>
              ),
            },
            { key: "newBuyers", label: "New", numeric: true, width: "80px" },
            { key: "returning", label: "Returning", numeric: true, width: "96px" },
            {
              key: "total",
              label: "Total",
              numeric: true,
              width: "80px",
              render: (row) => row.newBuyers + row.returning,
            },
          ]}
          footer={
            <Dateline>
              The upper bar in each row is new buyers, the lower is returning. Both are drawn against the same scale —
              the busiest month in the set.
            </Dateline>
          }
          empty={
            <EmptyState
              variant="certificate"
              glyph={<Heart />}
              eyebrow="Nothing recorded"
              headline="No order has been paid for yet, so there is no repeat behaviour to measure."
              body="A month appears here as soon as one paid order exists in it. Until then this register is genuinely empty rather than still loading."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/orders">Open the order register</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
