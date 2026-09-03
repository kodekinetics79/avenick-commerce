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
import { Money, MoneyStack } from "@/components/b2b/money";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { format } from "date-fns";

export const metadata = { title: "Company Profile" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; tone: PillTone }> = {
  ACTIVE: { label: "Verified & active", tone: "success" },
  PENDING_VERIFICATION: { label: "Pending verification", tone: "warning" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

const ROLE_LABEL: Record<string, string> = {
  COMPANY_ADMIN: "Admin",
  COMPANY_BUYER: "Buyer",
  COMPANY_APPROVER: "Approver",
};

export default async function CompanyPage() {
  const ctx = await getB2BContext();
  if (!ctx) redirect("/b2b/register");

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

  return (
    <B2BShell
      eyebrow="Administration"
      title={company.nameEn}
      description={company.nameAr ?? undefined}
      dateline={`${company.city}, ${company.country} · company account opened ${format(company.createdAt, "MMMM yyyy")}`}
      actions={<StatusPill tone={statusCfg.tone} dot>{statusCfg.label}</StatusPill>}
    >
      <div className="space-y-block">
        {/* Registration. Recessed, because it is the reference data every other
            figure on the page is read against — and the four bordered boxes it
            replaces are now one panel divided by hairlines. */}
        <Surface rung={1} className="p-5">
          <Eyebrow className="mb-3 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Registration
          </Eyebrow>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {[
              { label: "CR number", value: company.crNumber, mono: true },
              { label: "VAT number", value: company.vatNumber, mono: true },
              { label: "Industry", value: company.industry.replace(/_/g, " ").toLowerCase(), mono: false },
              { label: "Company size", value: company.size.replace(/_/g, " ").toLowerCase(), mono: false },
            ].map((f) => (
              <div key={f.label}>
                <dt><Eyebrow as="span">{f.label}</Eyebrow></dt>
                <dd className={`u-ui mt-0.5 ${f.mono ? "u-mono" : ""} ${f.value ? "text-ink-1" : "text-ink-3"}`}>
                  {f.value ?? "Not recorded"}
                </dd>
              </div>
            ))}
          </dl>
        </Surface>

        <CellGrid cols={{ base: 2, lg: 4 }}>
          <div>
            <Eyebrow>Credit limit</Eyebrow>
            <div className="mt-1.5">
              {company.creditLimit ? (
                <Money amount={Number(company.creditLimit)} currency={companyCurrency} />
              ) : (
                <span className="u-body text-ink-2">Not set</span>
              )}
            </div>
            {/* Company.creditLimit has no currency column; it is read in the
                company's jurisdiction currency, the same assumption the billing
                page states. */}
            <Dateline className="mt-1">Recorded without a currency · read as {companyCurrency}</Dateline>
          </div>
          <Stat
            label="Payment terms"
            value={company.paymentTerms > 0 ? company.paymentTerms : "Prepaid"}
            unit={company.paymentTerms > 0 ? "days net" : undefined}
          />
          <div>
            <Eyebrow>Lifetime spend</Eyebrow>
            <div className="mt-1.5">
              {/* Grouped by currency: a sum across currencies is not a sum of
                  anything, so each one keeps its own line. */}
              <MoneyStack
                rows={lifetimeSpend}
                dateline="Paid orders only, each in its own currency · no conversion applied"
              />
            </div>
          </div>
          <div>
            <Eyebrow>Orders · POs · RFQs</Eyebrow>
            {/* <Num>, not a hand-rolled `fig` span with an inline font-weight:
                the rank sizes and the tabular figures are the primitive's job,
                and a local copy is exactly how a fourth figure style appears. */}
            <div className="mt-1.5">
              <Num value={`${company._count.orders} · ${company._count.purchaseOrders} · ${company._count.rfqRequests}`} />
            </div>
          </div>
        </CellGrid>

        <Surface rung={2} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h2 className="u-h3 inline-flex items-center gap-2 text-ink-1">
              <Users className="h-4 w-4 text-ink-3" aria-hidden="true" /> Team ({company.members.length})
            </h2>
            <Button asChild variant="link" size="sm">
              <Link href="/b2b/team">Manage team</Link>
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
                      {u ? `${u.firstName} ${u.lastName}` : "Unknown member"}
                      {m.userId === ctx.userId && <span className="u-meta ms-1.5 text-ink-3">(you)</span>}
                    </p>
                    <p className="u-meta truncate text-ink-3">
                      {u?.email ?? "No email recorded"}
                      {m.department ? ` · ${m.department}` : ""}
                    </p>
                  </div>
                  <StatusPill className="shrink-0">{ROLE_LABEL[m.role] ?? m.role}</StatusPill>
                </li>
              );
            })}
          </ul>
        </Surface>

        <Surface rung={2} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h2 className="u-h3 inline-flex items-center gap-2 text-ink-1">
              <MapPin className="h-4 w-4 text-ink-3" aria-hidden="true" /> Delivery sites ({company.addresses.length})
            </h2>
            <Button asChild variant="link" size="sm">
              <Link href="/b2b/addresses">Manage sites</Link>
            </Button>
          </div>
          {company.addresses.length === 0 ? (
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No delivery site has been added for this company."
              body="Orders are shipped to a recorded site, so at least one is needed before an order can be placed."
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
