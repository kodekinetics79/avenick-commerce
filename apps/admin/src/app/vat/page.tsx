import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getVatSummary, getTaxInvoices, Prisma, type Currency } from "@avenick/database";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { Receipt } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, Surface, Num, Dateline,
} from "@avenick/ui";
import { CountStat, MoneyStat } from "@/app/finance/money-figures";
import { Pager } from "@/components/console/chrome";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.vat");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/** Money crosses to a string here and nowhere earlier; currency is never blended. */
const money = (amount: Prisma.Decimal, currency: Currency) =>
  formatCurrency(Number(amount), currency as SupportedCurrency);

interface PageProps {
  searchParams: { page?: string; search?: string };
}

export default async function VATPage({ searchParams }: PageProps) {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.vat");

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 25;
  const search = searchParams.search?.trim() || undefined;

  const [summary, { invoices, total }] = await Promise.all([
    getVatSummary(),
    getTaxInvoices({ page, limit, search }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          linkComponent={Link}
          breadcrumbs={[{ label: t("breadcrumbFinance"), href: "/finance" }, { label: t("breadcrumbSelf") }]}
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description", { year: String(new Date().getFullYear()) })}
          dateline={t("dateline")}
        />

        {/* A filing number must not be a blend. VAT is levied at different rates
            in different jurisdictions (UAE 5%, KSA 15%) and the platform holds
            no exchange rates, so these figures are reported per currency and
            never added together — there is deliberately no headline total. */}
        <Surface tone="warning" className="p-4">
          <p className="u-ui max-w-prose text-ink-1">{t("notice")}</p>
        </Surface>

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <MoneyStat
            label={t("stats.outputVat")}
            rank="section"
            lines={summary.byCurrency.map((c) => ({ currency: c.currency, formatted: money(c.vat, c.currency) }))}
            dateline={t("stats.outputVatDateline")}
          />
          <CountStat label={t("stats.taxableOrders")} value={summary.taxableOrders} />
          <CountStat label={t("stats.currencies")} value={summary.currencyCount} />
          <CountStat label={t("stats.invoices")} value={summary.invoiceCount} />
        </CellGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* By currency */}
          <LedgerTable
            title={t("byCurrency.title")}
            rows={summary.byCurrency}
            getRowKey={(c) => c.currency}
            density="compact"
            columns={[
              { key: "currency", label: t("byCurrency.columns.currency"), render: (c) => <span className="font-medium text-ink-1">{c.currency}</span> },
              { key: "orders", label: t("byCurrency.columns.orders"), numeric: true, render: (c) => c.orders },
              { key: "gross", label: t("byCurrency.columns.gross"), numeric: true, render: (c) => <span className="text-ink-2">{money(c.gross, c.currency)}</span> },
              { key: "vat", label: t("byCurrency.columns.vat"), numeric: true, render: (c) => <Num value={money(c.vat, c.currency)} /> },
            ]}
            empty={
              <EmptyState
                eyebrow={t("emptyEyebrow")}
                headline={t("byCurrency.emptyHeadline")}
                body={t("byCurrency.emptyBody")}
              />
            }
          />

          {/* By month, per currency: one row per (month, currency) pair. */}
          <LedgerTable
            title={t("byMonth.title")}
            dateline={t("byMonth.dateline")}
            rows={summary.monthly}
            getRowKey={(m) => `${String(m.month)}-${m.currency}`}
            density="compact"
            columns={[
              { key: "month", label: t("byMonth.columns.month"), render: (m) => <span className="whitespace-nowrap font-medium text-ink-1">{format(m.month, "MMMM yyyy")}</span> },
              { key: "currency", label: t("byMonth.columns.currency"), render: (m) => <span className="text-ink-2">{m.currency}</span> },
              { key: "orders", label: t("byMonth.columns.orders"), numeric: true, render: (m) => m.orders },
              { key: "vat", label: t("byMonth.columns.vat"), numeric: true, render: (m) => <Num value={money(m.vat, m.currency)} /> },
            ]}
            empty={
              <EmptyState
                eyebrow={t("emptyEyebrow")}
                headline={t("byMonth.emptyHeadline")}
                body={t("byMonth.emptyBody")}
              />
            }
          />
        </div>

        {/* Tax invoices */}
        <LedgerTable
          title={t("invoices.title")}
          dateline={t("invoices.dateline")}
          rows={invoices}
          getRowKey={(inv) => inv.id}
          stickyHead
          columns={[
            { key: "invoiceNo", label: t("invoices.columns.invoiceNo"), render: (inv) => <span className="u-mono text-meta font-medium text-ink-1">{inv.invoiceNo}</span> },
            { key: "order", label: t("invoices.columns.order"), render: (inv) => <span className="u-mono text-meta text-ink-2">{inv.order.orderNumber}</span> },
            {
              key: "buyer",
              label: t("invoices.columns.buyer"),
              render: (inv) => inv.order.company?.nameEn ?? `${inv.order.user.firstName} ${inv.order.user.lastName}`,
            },
            {
              key: "vatNumber",
              label: t("invoices.columns.vatNumber"),
              hideOnMobile: true,
              render: (inv) => <span className="u-mono text-meta text-ink-3">{inv.order.company?.vatNumber ?? "—"}</span>,
            },
            { key: "amount", label: t("invoices.columns.amount"), numeric: true, render: (inv) => <Num value={money(inv.totalAmount, inv.currency)} /> },
            { key: "vat", label: t("invoices.columns.vat"), numeric: true, render: (inv) => <span className="text-ink-2">{money(inv.vatAmount, inv.currency)}</span> },
            {
              key: "issuedAt",
              label: t("invoices.columns.issued"),
              hideOnMobile: true,
              render: (inv) => <span className="whitespace-nowrap text-ink-2">{format(inv.issuedAt, "MMM d, yyyy")}</span>,
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("invoices.emptyEyebrow")}
              headline={t("invoices.emptyHeadline")}
              body={t("invoices.emptyBody")}
              icon={<Receipt className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(target) => `/vat?page=${target}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              summary={t.rich("invoices.footer", {
                total: String(total),
                count: total,
                n: (chunks) => <span className="fig text-ink-2">{chunks}</span>,
              })}
            />
          }
        />

        <Dateline className="max-w-prose">{t("note")}</Dateline>
      </div>
    </AdminLayout>
  );
}
