import Link from "next/link";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { Button, Dateline, EmptyState, Eyebrow, Meter, Surface } from "@avenick/ui";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { getB2BT, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey } from "@/components/b2b/messages";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { TrendingUp, Wallet, Clock, BarChart3 } from "lucide-react";

export async function generateMetadata() {
  return b2bMetadata("analytics.title");
}

/**
 * Month labels are message keys, not an array of English abbreviations.
 * `Intl.DateTimeFormat` would also work, but a bar chart wants a fixed short
 * label and Arabic's `short` month is the full name anyway, so the two are
 * chosen deliberately here rather than left to a formatter.
 */
const MONTH_KEYS: B2BKey[] = [
  "analytics.month.jan", "analytics.month.feb", "analytics.month.mar", "analytics.month.apr",
  "analytics.month.may", "analytics.month.jun", "analytics.month.jul", "analytics.month.aug",
  "analytics.month.sep", "analytics.month.oct", "analytics.month.nov", "analytics.month.dec",
];

export default async function SpendAnalyticsPage() {
  const t = await getB2BT();
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title={t("analytics.title")}>
        <EmptyState
          variant="certificate"
          glyph={<BarChart3 />}
          eyebrow={t("common.noCompany.eyebrow")}
          headline={t("common.noCompany.headline")}
          body={t("common.noCompany.body")}
          action={
            <Button asChild variant="primary">
              <Link href="/b2b/register">{t("common.noCompany.action")}</Link>
            </Button>
          }
        />
      </B2BShell>
    );
  }

  const [allPos, members] = await Promise.all([
    db.purchaseOrder.findMany({ where: { companyId: ctx.companyId }, select: { total: true, status: true, requesterId: true, createdAt: true, currency: true } }),
    db.companyMember.findMany({ where: { companyId: ctx.companyId }, select: { userId: true, department: true } }),
  ]);
  const unassigned = t("common.unassigned");
  const deptOf = new Map(members.map((m) => [m.userId, m.department ?? unassigned]));

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
    const d = deptOf.get(p.requesterId) ?? unassigned;
    byDept.set(d, (byDept.get(d) ?? 0) + Number(p.total));
  }
  const deptRows = [...byDept.entries()].map(([name, spend]) => ({ name, spend })).sort((a, b) => b.spend - a.spend);
  const deptMax = Math.max(1, ...deptRows.map((d) => d.spend));

  // Monthly trend (last 6 months)
  const trend: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = committed.filter((p) => p.createdAt.getMonth() === d.getMonth() && p.createdAt.getFullYear() === d.getFullYear()).reduce((s, p) => s + Number(p.total), 0);
    trend.push({ label: t(MONTH_KEYS[d.getMonth()]!), value: v });
  }
  const trendMax = Math.max(1, ...trend.map((t2) => t2.value));

  const empty = committed.length === 0;

  // The disclosure that used to be an 11px grey line above the figures. It is
  // the reason the numbers can be trusted, so it is set as provenance and
  // attached to the page rather than dropped above it.
  const excluded =
    excludedCount === 0
      ? t("analytics.excluded.none")
      : excludedCount === 1
        ? t("analytics.excluded.one")
        : t("analytics.excluded.other", { count: excludedCount });

  return (
    <B2BShell
      workspace={ctx.company.nameEn}
      eyebrow={t("analytics.eyebrow")}
      title={t("analytics.title")}
      description={t("analytics.description", { company: ctx.company.nameEn, currency })}
      dateline={t("analytics.basis", { currency, excluded })}
    >
      <div className="space-y-block">
        {/* ══ THE POSITION ══════════════════════════════════════════════════
            Committed spend is this page's subject, so it is its one hero-rank
            figure — 46px against the two supporting figures' 20px. Round one
            set all three at the same rank, which turned the page's answer into
            one of three equal numbers and left the reader to work out which was
            which from the labels. */}
        <Surface rung={1} className="overflow-hidden">
          <div className="u-drawn w-14" data-on="true" aria-hidden="true" />
          <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0">
              <Eyebrow className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> {t("analytics.committed")}
              </Eyebrow>
              <div className="mt-1.5">
                <Money amount={totalSpend} currency={currency} rank="hero" />
              </div>
              <Dateline className="mt-1">{t("analytics.committed.basis")}</Dateline>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-4">
              <div>
                <dt>
                  <Eyebrow as="span" className="inline-flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> {t("analytics.thisMonth")}
                  </Eyebrow>
                </dt>
                <dd className="mt-1.5"><Money amount={monthSpend} currency={currency} /></dd>
                {/* No prior-month figure is computed here, so none is shown. */}
                <Dateline className="mt-1">{t("analytics.thisMonth.basis")}</Dateline>
              </div>
              <div>
                <dt>
                  <Eyebrow as="span" className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t("analytics.awaiting")}
                  </Eyebrow>
                </dt>
                <dd className="mt-1.5"><Money amount={pendingValue} currency={currency} /></dd>
                <Dateline className="mt-1">{t("analytics.awaiting.basis")}</Dateline>
              </div>
            </dl>
          </div>
        </Surface>

        {empty ? (
          // The one certificate on this page.
          <EmptyState
            variant="certificate"
            glyph={<BarChart3 />}
            eyebrow={t("analytics.empty.eyebrow")}
            headline={t("analytics.empty.headline")}
            body={t("analytics.empty.body")}
            action={
              <Button asChild variant="secondary">
                <Link href="/b2b/approvals">{t("analytics.empty.action")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* By department. A recessed track with a raised fill: the reading
                is carried by depth, not by a traffic light. */}
            <Surface rung={2} className="p-5">
              <h2 className="u-h3 mb-1 text-ink-1">{t("analytics.byDept")}</h2>
              <Dateline className="mb-4">{t("analytics.byDept.basis")}</Dateline>
              <ul className="space-y-4">
                {deptRows.map((d, i) => (
                  <li key={d.name}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="u-ui font-medium text-ink-1">{d.name}</span>
                      <Money amount={d.spend} currency={currency} className="text-ink-2" />
                    </div>
                    <Meter value={d.spend} max={deptMax} index={i} label={t("analytics.meterLabel", { name: d.name })} />
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
              <h2 className="u-h3 mb-1 text-ink-1">{t("analytics.monthly")}</h2>
              <Dateline className="mb-4">{t("analytics.monthly.basis")}</Dateline>
              <ul className="space-y-4">
                {trend.map((m, i) => (
                  <li key={m.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="u-ui font-medium text-ink-1">{m.label}</span>
                      <Money amount={m.value} currency={currency} className="text-ink-2" />
                    </div>
                    <Meter value={m.value} max={trendMax} index={i} tone="accent" label={t("analytics.meterLabel", { name: m.label })} />
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
