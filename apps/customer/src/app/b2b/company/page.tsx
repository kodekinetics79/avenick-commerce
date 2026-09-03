import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Users, ShieldCheck } from "lucide-react";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  Num,
  Stat,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money, CurrencyLedger } from "@/components/b2b/money";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey } from "@/components/b2b/messages";
import { companyCurrencyForCountry } from "@/lib/company-currency";

export async function generateMetadata() {
  return b2bMetadata("meta.company");
}
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { labelKey: B2BKey; tone: PillTone }> = {
  ACTIVE: { labelKey: "company.status.active", tone: "success" },
  PENDING_VERIFICATION: { labelKey: "company.status.pending", tone: "warning" },
  SUSPENDED: { labelKey: "company.status.suspended", tone: "danger" },
};

const ROLE_LABEL: Record<string, B2BKey> = {
  COMPANY_ADMIN: "team.role.admin",
  COMPANY_BUYER: "team.role.buyer",
  COMPANY_APPROVER: "team.role.approver",
};

/**
 * Industry and size, in the buyer's language.
 *
 * Both used to render as `enum.replace(/_/g, " ").toLowerCase()` — "industrial
 * supplies", "enterprise" — which is an English word derived from a stored value
 * and printed on an Arabic page. These are the SAME labels the registration form
 * offers, so a company reads back exactly the phrase whoever registered it
 * picked. An unmapped value falls through to the stored enum rather than to a
 * guess.
 */
const INDUSTRY_LABEL: Record<string, B2BKey> = {
  INDUSTRIAL_SUPPLIES: "register.industry.INDUSTRIAL_SUPPLIES",
  ELECTRONICS: "register.industry.ELECTRONICS",
  OFFICE_SUPPLIES: "register.industry.OFFICE_SUPPLIES",
  SAFETY_PPE: "register.industry.SAFETY_PPE",
  FOOD_HOSPITALITY: "register.industry.FOOD_HOSPITALITY",
  BUILDING_MATERIALS: "register.industry.BUILDING_MATERIALS",
  HEALTHCARE: "register.industry.HEALTHCARE",
  RETAIL: "register.industry.RETAIL",
  MANUFACTURING: "register.industry.MANUFACTURING",
  TECHNOLOGY: "register.industry.TECHNOLOGY",
  OTHER: "register.industry.OTHER",
};

const SIZE_LABEL: Record<string, B2BKey> = {
  MICRO: "register.size.MICRO",
  SMALL: "register.size.SMALL",
  MEDIUM: "register.size.MEDIUM",
  LARGE: "register.size.LARGE",
  ENTERPRISE: "register.size.ENTERPRISE",
};

export default async function CompanyPage() {
  const ctx = await getB2BContext();
  if (!ctx) redirect("/b2b/register");
  const { t, f } = await getB2B();

  const [company, orderAgg] = await Promise.all([
    db.company.findUnique({
      where: { id: ctx.companyId },
      include: {
        members: { orderBy: { joinedAt: "asc" } },
        addresses: true,
        _count: { select: { orders: true, purchaseOrders: true, rfqRequests: true } },
      },
    }),
    // Grouped by currency: a sum across currencies is not a sum of anything.
    db.order.groupBy({
      by: ["currency"],
      where: { companyId: ctx.companyId, paymentStatus: "PAID" },
      _sum: { total: true },
    }),
  ]);
  if (!company) redirect("/b2b/register");

  // Company.creditLimit has no currency column; it is read in the company's
  // jurisdiction currency, the same assumption the billing page states.
  const companyCurrency = companyCurrencyForCountry(company.country);
  const lifetimeSpend = orderAgg
    .filter((row) => Number(row._sum.total ?? 0) > 0)
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((row) => ({ currency: row.currency as string, total: Number(row._sum.total ?? 0) }));

  const memberUsers = await db.user.findMany({
    where: { id: { in: company.members.map((m) => m.userId) } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const userOf = (id: string) => memberUsers.find((u) => u.id === id);

  const statusCfg = STATUS_CONFIG[company.status] ?? STATUS_CONFIG["PENDING_VERIFICATION"]!;

  const registration: Array<{ label: B2BKey; value: string | null; mono: boolean }> = [
    { label: "company.cr", value: company.crNumber, mono: true },
    { label: "company.vat", value: company.vatNumber, mono: true },
    {
      label: "company.industry",
      value: INDUSTRY_LABEL[company.industry] ? t(INDUSTRY_LABEL[company.industry]!) : company.industry,
      mono: false,
    },
    {
      label: "company.size",
      value: SIZE_LABEL[company.size] ? t(SIZE_LABEL[company.size]!) : company.size,
      mono: false,
    },
  ];

  return (
    <B2BShell
      workspace={company.nameEn}
      eyebrow={t("company.eyebrow")}
      title={company.nameEn}
      description={company.nameAr ?? undefined}
      dateline={t("company.basis", {
        city: company.city,
        country: company.country,
        opened: f.month(company.createdAt),
      })}
      actions={<StatusPill tone={statusCfg.tone} dot>{t(statusCfg.labelKey)}</StatusPill>}
    >
      <div className="space-y-block">
        {/* Registration. Recessed, because it is the reference data every other
            figure on the page is read against — and the four bordered boxes it
            replaces are now one panel divided by hairlines. The brass rule
            across the top is the same mark the masthead carries: this is the
            head of the record. */}
        <Surface rung={1} className="overflow-hidden">
          <div className="u-drawn w-14" data-on="true" aria-hidden="true" />
          <div className="p-5">
            <Eyebrow className="mb-3 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t("company.registration")}
            </Eyebrow>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {registration.map((field) => (
                <div key={field.label}>
                  <dt><Eyebrow as="span">{t(field.label)}</Eyebrow></dt>
                  <dd className={`u-ui mt-0.5 ${field.mono ? "u-mono" : ""} ${field.value ? "text-ink-1" : "text-ink-3"}`}>
                    {field.value ?? t("common.notRecorded")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Surface>

        <CellGrid cols={{ base: 2, lg: 4 }}>
          <div>
            <Eyebrow>{t("dash.creditLimit")}</Eyebrow>
            <div className="mt-1.5">
              {company.creditLimit ? (
                <Money amount={Number(company.creditLimit)} currency={companyCurrency} />
              ) : (
                <span className="u-body text-ink-2">{t("common.notSet")}</span>
              )}
            </div>
            {/* Company.creditLimit has no currency column; it is read in the
                company's jurisdiction currency, the same assumption the billing
                page states. */}
            <Dateline className="mt-1">{t("money.readAs", { currency: companyCurrency })}</Dateline>
          </div>
          <Stat
            label={t("company.paymentTerms")}
            value={company.paymentTerms > 0 ? company.paymentTerms : t("company.paymentTerms.prepaid")}
            unit={company.paymentTerms > 0 ? t("company.paymentTerms.unit") : undefined}
          />
          <div>
            <Eyebrow>{t("company.lifetimeSpend")}</Eyebrow>
            <div className="mt-1.5">
              {/* Grouped by currency: a sum across currencies is not a sum of
                  anything, so each one keeps its own line. */}
              <CurrencyLedger
                rows={lifetimeSpend}
                label={t("money.byCurrency")}
                single={t("company.lifetimeSpend.basis")}
                multi={t("money.noConversion")}
                emptyLabel={t("money.nothingRecorded")}
              />
            </div>
          </div>
          <div>
            <Eyebrow>{t("company.counts")}</Eyebrow>
            {/* <Num>, not a hand-rolled `fig` span with an inline font-weight:
                the rank sizes and the tabular figures are the primitive's job,
                and a local copy is exactly how a fourth figure style appears. */}
            <div className="mt-1.5">
              <Num value={`${company._count.orders} · ${company._count.purchaseOrders} · ${company._count.rfqRequests}`} />
            </div>
            <Dateline className="mt-1">{t("company.counts.basis")}</Dateline>
          </div>
        </CellGrid>

        <Surface rung={2} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h2 className="u-h3 inline-flex items-center gap-2 text-ink-1">
              <Users className="h-4 w-4 text-ink-3" aria-hidden="true" /> {t("company.team")} ({company.members.length})
            </h2>
            <Button asChild variant="link" size="sm">
              <Link href="/b2b/team">{t("company.team.manage")}</Link>
            </Button>
          </div>
          <ul className="border-t border-hairline">
            {company.members.map((m) => {
              const u = userOf(m.userId);
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="u-ui font-medium text-ink-1">
                      {u ? `${u.firstName} ${u.lastName}` : t("company.team.unknown")}
                      {m.userId === ctx.userId && <span className="u-meta ms-1.5 text-ink-3">{t("common.you")}</span>}
                    </p>
                    <p className="u-meta truncate text-ink-3">
                      {u?.email ?? t("company.team.noEmail")}
                      {m.department ? ` · ${m.department}` : ""}
                    </p>
                  </div>
                  <StatusPill className="shrink-0">
                    {ROLE_LABEL[m.role] ? t(ROLE_LABEL[m.role]!) : m.role}
                  </StatusPill>
                </li>
              );
            })}
          </ul>
        </Surface>

        <Surface rung={2} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h2 className="u-h3 inline-flex items-center gap-2 text-ink-1">
              <MapPin className="h-4 w-4 text-ink-3" aria-hidden="true" /> {t("company.sites")} ({company.addresses.length})
            </h2>
            <Button asChild variant="link" size="sm">
              <Link href="/b2b/addresses">{t("company.sites.manage")}</Link>
            </Button>
          </div>
          {company.addresses.length === 0 ? (
            <EmptyState
              eyebrow={t("company.sites.empty.eyebrow")}
              headline={t("company.sites.empty.headline")}
              body={t("company.sites.empty.body")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/b2b/addresses">{t("company.sites.empty.action")}</Link>
                </Button>
              }
            />
          ) : (
            <ul className="border-t border-hairline">
              {company.addresses.map((a) => (
                <li key={a.id} className="border-b border-hairline px-5 py-3 last:border-b-0">
                  <p className="u-ui font-medium text-ink-1">{a.label}</p>
                  <p className="u-meta text-ink-3">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.country}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </B2BShell>
  );
}
