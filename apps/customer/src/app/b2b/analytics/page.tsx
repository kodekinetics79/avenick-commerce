import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { CellGrid, Dateline, EmptyState, Eyebrow, Meter, Surface } from "@avenick/ui";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { platformName } from "@avenick/utils/portal-config";
import { TrendingUp, Wallet, Clock } from "lucide-react";

export const metadata = { title: `Spend Analytics — ${platformName()} for Business` };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function SpendAnalyticsPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Spend Analytics">
        <Surface rung={2}>
          <EmptyState
            eyebrow="No company context"
            headline="This session is not attached to a company account."
            body="Spend is measured across a company's purchase orders. Sign in with a company account to see it."
          />
        </Surface>
      </B2BShell>
    );
  }

  const [allPos, members] = await Promise.all([
    db.purchaseOrder.findMany({ where: { companyId: ctx.companyId }, select: { total: true, status: true, requesterId: true, createdAt: true, currency: true } }),
    db.companyMember.findMany({ where: { companyId: ctx.companyId }, select: { userId: true, department: true } }),
  ]);
  const deptOf = new Map(members.map((m) => [m.userId, m.department ?? "Unassigned"]));

  // Purchase orders are stored in the currency they were raised in. Totals
  // across currencies are not a sum of anything, so every figure on this page
  // is in the company's jurisdiction currency and POs in any other currency
  // are counted and disclosed rather than silently folded in.
  const currency = companyCurrencyForCountry(ctx.company.country);
  const pos = allPos.filter((p) => p.currency === currency);
  const excludedCount = allPos.length - pos.length;

  const committed = pos.filter((p) => p.status === "ORDERED" || p.status === "APPROVED");
  const totalSpend = committed.reduce((s, p) => s + Number(p.total), 0);
  const pendingValue = pos.filter((p) => p.status === "PENDING_APPROVAL").reduce((s, p) => s + Number(p.total), 0);

  const now = new Date();
  const monthSpend = committed.filter((p) => p.createdAt.getMonth() === now.getMonth() && p.createdAt.getFullYear() === now.getFullYear()).reduce((s, p) => s + Number(p.total), 0);

  // Spend by department
  const byDept = new Map<string, number>();
  for (const p of committed) {
    const d = deptOf.get(p.requesterId) ?? "Unassigned";
    byDept.set(d, (byDept.get(d) ?? 0) + Number(p.total));
  }
  const deptRows = [...byDept.entries()].map(([name, spend]) => ({ name, spend })).sort((a, b) => b.spend - a.spend);
  const deptMax = Math.max(1, ...deptRows.map((d) => d.spend));

  // Monthly trend (last 6 months)
  const trend: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = committed.filter((p) => p.createdAt.getMonth() === d.getMonth() && p.createdAt.getFullYear() === d.getFullYear()).reduce((s, p) => s + Number(p.total), 0);
    trend.push({ label: MONTHS[d.getMonth()]!, value: v });
  }
  const trendMax = Math.max(1, ...trend.map((t) => t.value));

  const empty = committed.length === 0;

  // The disclosure that used to be an 11px grey line above the figures. It is
  // the reason the numbers can be trusted, so it is set as provenance and
  // attached to the page rather than dropped above it.
  const excluded =
    excludedCount > 0
      ? `${excludedCount} purchase order${excludedCount === 1 ? "" : "s"} raised in other currencies ${excludedCount === 1 ? "is" : "are"} not included`
      : "All of this company's purchase orders are raised in this currency";

  return (
    <B2BShell
      eyebrow="Money"
      title="Spend Analytics"
      description={`Approved & ordered purchasing across ${ctx.company.nameEn}, in ${currency}.`}
      dateline={`Approved and ordered purchase orders, in ${currency} · ${excluded}`}
    >
      <div className="space-y-block">
        <CellGrid cols={{ base: 1, sm: 3 }}>
          <div>
            <Eyebrow className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Committed spend
            </Eyebrow>
            <div className="mt-1.5">
              <Money amount={totalSpend} currency={currency} rank="section" />
            </div>
          </div>
          <div>
            <Eyebrow className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> This month
            </Eyebrow>
            <div className="mt-1.5">
              <Money amount={monthSpend} currency={currency} />
            </div>
            {/* No prior-month figure is computed here, so none is shown. */}
            <Dateline className="mt-1">Calendar month to date</Dateline>
          </div>
          <div>
            <Eyebrow className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Awaiting approval
            </Eyebrow>
            <div className="mt-1.5">
              <Money amount={pendingValue} currency={currency} />
            </div>
            <Dateline className="mt-1">Not yet committed</Dateline>
          </div>
        </CellGrid>

        {empty ? (
          <Surface rung={2}>
            <EmptyState
              eyebrow="Nothing committed"
              headline="No purchase order has been approved or placed yet."
              body="Spend is measured from approved and ordered POs, so this page fills in as your first approvals go through."
            />
          </Surface>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* By department. A recessed track with a raised fill: the reading
                is carried by depth, not by a traffic light. */}
            <Surface rung={2} className="p-5">
              <h2 className="u-h3 mb-1 text-ink-1">Spend by department</h2>
              <Dateline className="mb-4">Department is taken from each requester&apos;s company membership</Dateline>
              <ul className="space-y-4">
                {deptRows.map((d, i) => (
                  <li key={d.name}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="u-ui font-medium text-ink-1">{d.name}</span>
                      <Money amount={d.spend} currency={currency} className="text-ink-2" />
                    </div>
                    <Meter value={d.spend} max={deptMax} index={i} label={`${d.name} committed spend`} />
                  </li>
                ))}
              </ul>
            </Surface>

            {/* Monthly trend. The vertical gradient columns this replaces were
                unreadable without hovering — the amount lived in a `title`
                attribute, which no keyboard or screen reader surfaces — and
                cropped every value to a height. Each month now prints its own
                figure next to its own bar. */}
            <Surface rung={2} className="p-5">
              <h2 className="u-h3 mb-1 text-ink-1">Monthly spend</h2>
              <Dateline className="mb-4">Last six calendar months, by the date each PO was raised</Dateline>
              <ul className="space-y-4">
                {trend.map((m, i) => (
                  <li key={m.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="u-ui font-medium text-ink-1">{m.label}</span>
                      <Money amount={m.value} currency={currency} className="text-ink-2" />
                    </div>
                    <Meter value={m.value} max={trendMax} index={i} tone="accent" label={`${m.label} committed spend`} />
                  </li>
                ))}
              </ul>
            </Surface>
          </div>
        )}
      </div>
    </B2BShell>
  );
}
