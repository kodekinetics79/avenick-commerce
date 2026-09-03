import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getVatSummary, getTaxInvoices, Prisma, type Currency } from "@avenick/database";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { Receipt } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, Surface, Num, Dateline,
} from "@avenick/ui";
import { CountStat, MoneyStat } from "@/app/finance/money-figures";
import { Pager } from "@/app/finance/console-chrome";

export const metadata = { title: "VAT Summary" };
export const dynamic = "force-dynamic";

/** Money crosses to a string here and nowhere earlier; currency is never blended. */
const money = (amount: Prisma.Decimal, currency: Currency) =>
  formatCurrency(Number(amount), currency as SupportedCurrency);

interface PageProps {
  searchParams: { page?: string; search?: string };
}

export default async function VATPage({ searchParams }: PageProps) {
  await requireAdminSession();

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
          breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "VAT" }]}
          eyebrow="Tax"
          title="VAT summary"
          description={`Output VAT on paid orders, net of completed refunds, ${new Date().getFullYear()} year to date.`}
          dateline="Grouped by the currency the order was billed in · never combined into one total"
        />

        {/* A filing number must not be a blend. VAT is levied at different rates
            in different jurisdictions (UAE 5%, KSA 15%) and the platform holds
            no exchange rates, so these figures are reported per currency and
            never added together — there is deliberately no headline total. */}
        <Surface tone="warning" className="p-4">
          <p className="u-ui max-w-prose text-ink-1">
            Figures are reported per currency and are never combined. VAT rates differ by jurisdiction (UAE 5%,
            KSA 15%) and the platform holds no exchange rates, so no single-currency total exists for a filing.
            These rows are grouped by the currency the order was billed in, which is a proxy for the filing jurisdiction
            and not the jurisdiction itself: the order carries a validated destination country on its shipping address,
            but no tax place-of-supply field, and nothing here is grouped by that country. Confirm the jurisdiction of
            each order before submitting a return.
          </p>
        </Surface>

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <MoneyStat
            label="Output VAT (YTD)"
            rank="section"
            lines={summary.byCurrency.map((c) => ({ currency: c.currency, formatted: money(c.vat, c.currency) }))}
            dateline="One line per currency · no single-currency total exists"
          />
          <CountStat label="Taxable orders (YTD)" value={summary.taxableOrders} />
          <CountStat label="Currencies" value={summary.currencyCount} />
          <CountStat label="Tax invoices issued" value={summary.invoiceCount} />
        </CellGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* By currency */}
          <LedgerTable
            title="VAT by currency"
            rows={summary.byCurrency}
            getRowKey={(c) => c.currency}
            density="compact"
            columns={[
              { key: "currency", label: "Currency", render: (c) => <span className="font-medium text-ink-1">{c.currency}</span> },
              { key: "orders", label: "Orders", numeric: true, render: (c) => c.orders },
              { key: "gross", label: "Gross", numeric: true, render: (c) => <span className="text-ink-2">{money(c.gross, c.currency)}</span> },
              { key: "vat", label: "Output VAT", numeric: true, render: (c) => <Num value={money(c.vat, c.currency)} /> },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No paid order has been placed this year."
                body="A currency appears here once an order billed in it reaches paid."
              />
            }
          />

          {/* By month, per currency: one row per (month, currency) pair. */}
          <LedgerTable
            title="VAT by month and currency"
            dateline="One row per month and currency pair"
            rows={summary.monthly}
            getRowKey={(m) => `${String(m.month)}-${m.currency}`}
            density="compact"
            columns={[
              { key: "month", label: "Month", render: (m) => <span className="whitespace-nowrap font-medium text-ink-1">{format(m.month, "MMMM yyyy")}</span> },
              { key: "currency", label: "Currency", render: (m) => <span className="text-ink-2">{m.currency}</span> },
              { key: "orders", label: "Taxable orders", numeric: true, render: (m) => m.orders },
              { key: "vat", label: "Output VAT", numeric: true, render: (m) => <Num value={money(m.vat, m.currency)} /> },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No VAT has been collected this year."
                body="A month appears here once an order billed with VAT in that month reaches paid."
              />
            }
          />
        </div>

        {/* Tax invoices */}
        <LedgerTable
          title="Tax invoices"
          dateline="Invoice records as issued · amounts in the currency of the order"
          rows={invoices}
          getRowKey={(inv) => inv.id}
          stickyHead
          columns={[
            { key: "invoiceNo", label: "Invoice #", render: (inv) => <span className="u-mono text-meta font-medium text-ink-1">{inv.invoiceNo}</span> },
            { key: "order", label: "Order", render: (inv) => <span className="u-mono text-meta text-ink-2">{inv.order.orderNumber}</span> },
            {
              key: "buyer",
              label: "Buyer",
              render: (inv) => inv.order.company?.nameEn ?? `${inv.order.user.firstName} ${inv.order.user.lastName}`,
            },
            {
              key: "vatNumber",
              label: "VAT reg.",
              hideOnMobile: true,
              render: (inv) => <span className="u-mono text-meta text-ink-3">{inv.order.company?.vatNumber ?? "—"}</span>,
            },
            { key: "amount", label: "Amount", numeric: true, render: (inv) => <Num value={money(inv.totalAmount, inv.currency)} /> },
            { key: "vat", label: "VAT", numeric: true, render: (inv) => <span className="text-ink-2">{money(inv.vatAmount, inv.currency)}</span> },
            {
              key: "issuedAt",
              label: "Issued",
              hideOnMobile: true,
              render: (inv) => <span className="whitespace-nowrap text-ink-2">{format(inv.issuedAt, "MMM d, yyyy")}</span>,
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Capability gap"
              headline="No tax invoice has ever been issued."
              body="Automatic tax-invoice generation is not implemented, so the platform creates no invoice today. This register populates on its own once it does."
              icon={<Receipt className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(target) => `/vat?page=${target}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              summary={
                <>
                  <span className="fig text-ink-2">{total}</span> tax invoice{total === 1 ? "" : "s"} on record
                </>
              }
            />
          }
        />

        <Dateline className="max-w-prose">
          Output VAT is taken from paid orders, net of completed refunds, in the currency each order was billed in.
        </Dateline>
      </div>
    </AdminLayout>
  );
}
