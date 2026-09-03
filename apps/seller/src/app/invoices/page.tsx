import Link from "next/link";
import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import { formatCurrency, isSupportedCurrency } from "@avenick/utils";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  LedgerTable,
  PageHeader,
  Stat,
  StatusPill,
} from "@avenick/ui";
import { CheckCircle, Clock, Download, FileText } from "lucide-react";

export const metadata = { title: "Invoices" };

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** An unsupported code is printed verbatim rather than dressed in another currency's symbol. */
function money(amount: number, currency: string): string {
  if (isSupportedCurrency(currency)) return formatCurrency(amount, currency);
  return `${currency} ${amount.toFixed(2)}`;
}

/** Sum amounts per currency and render "AED 1,200 · SAR 300", or "—" when empty. */
function perCurrency(rows: Array<{ currency: string; amount: number }>): string {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount);
  const parts = [...totals.entries()]
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([c, v]) => money(v, c));
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default async function InvoicesPage() {
  const { seller, membership } = await requireSellerPermission("finance.view");

  const invoices = await db.taxInvoice.findMany({
    where: { order: { items: { some: { sellerId: seller.id } } } },
    include: {
      order: {
        select: {
          orderNumber: true, paymentStatus: true,
          user: { select: { firstName: true, lastName: true } },
          company: { select: { nameEn: true } },
          items: { where: { sellerId: seller.id }, select: { total: true, vatAmount: true } },
        },
      },
    },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });

  // Only what the ledger records: the invoice's own currency, this seller's
  // share of the lines, and whether the order is paid. There is no due date on
  // a TaxInvoice, so the "30 days from issue" due date and the "overdue" status
  // this page used to derive from it are gone — they were invented terms.
  const rows = invoices.map((inv) => ({
    id: inv.id,
    invoiceNo: inv.invoiceNo,
    orderNumber: inv.order.orderNumber,
    buyer: inv.order.company?.nameEn ?? `${inv.order.user.firstName} ${inv.order.user.lastName}`.trim(),
    currency: inv.currency as string,
    total: inv.order.items.reduce((sum, item) => sum + Number(item.total), 0),
    vat: inv.order.items.reduce((sum, item) => sum + Number(item.vatAmount), 0),
    issuedAt: inv.issuedAt,
    fileUrl: inv.fileUrl,
    status: inv.order.paymentStatus === "PAID" ? "PAID" : "UNPAID",
  }));

  const byStatus = (s: string) => rows.filter((r) => r.status === s);
  const paidRows = byStatus("PAID");
  const unpaidRows = byStatus("UNPAID");
  const totalPaid = perCurrency(paidRows.map((r) => ({ currency: r.currency, amount: r.total })));
  const totalUnpaid = perCurrency(unpaidRows.map((r) => ({ currency: r.currency, amount: r.total })));

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          className="mb-0"
          eyebrow="Finance"
          title="Invoices"
          description="Tax invoices issued to buyers for orders containing your lines."
          // LAW E, and it is the whole reason this page can be trusted: the
          // figures are this seller's slice of each order, in the invoice's own
          // currency, summed per currency and never converted.
          dateline="Your lines on each invoiced order, in the invoice currency · totals are summed per currency and no conversion is applied · the hundred most recently issued"
        />

        {/* Two cells in one hairline-divided panel rather than two coloured
            tiles. The amber-500 wash the unpaid tile used to carry is a raw
            palette value with no dark counterpart and no token behind it; the
            state is carried by the chip, which resolves in both themes. */}
        <CellGrid cols={{ base: 1, sm: 2 }}>
          <Stat
            label="Invoiced on paid orders"
            value={totalPaid}
            rank="section"
            icon={CheckCircle}
            chip={paidRows.length > 0 ? "success" : "neutral"}
            note={`${paidRows.length} invoice${paidRows.length === 1 ? "" : "s"} whose order is recorded as paid.`}
          />
          <Stat
            label="Invoiced on unpaid orders"
            value={totalUnpaid}
            rank="section"
            icon={Clock}
            chip={unpaidRows.length > 0 ? "warning" : "neutral"}
            note={`${unpaidRows.length} invoice${unpaidRows.length === 1 ? "" : "s"} whose order is not yet recorded as paid.`}
          />
        </CellGrid>

        <LedgerTable
          rows={rows}
          getRowKey={(row) => row.id}
          density="compact"
          dateline="Issued newest first · VAT and total are your lines only"
          footer={`${rows.length} invoice${rows.length === 1 ? "" : "s"} · amounts are your lines on each order, in the invoice currency`}
          columns={[
            {
              key: "invoiceNo",
              label: "Invoice",
              render: (row) => <span className="u-mono text-meta font-medium text-ink-1">{row.invoiceNo}</span>,
            },
            {
              key: "orderNumber",
              label: "Order",
              hideOnMobile: true,
              render: (row) => <span className="u-mono text-meta text-ink-3">{row.orderNumber}</span>,
            },
            {
              key: "buyer",
              label: "Buyer",
              render: (row) => <span className="block max-w-[16rem] truncate">{row.buyer}</span>,
            },
            {
              key: "vat",
              label: "VAT",
              numeric: true,
              hideOnMobile: true,
              render: (row) => <span className="text-ink-2">{money(row.vat, row.currency)}</span>,
            },
            {
              key: "total",
              label: "Your share",
              numeric: true,
              render: (row) => <span className="font-medium text-ink-1">{money(row.total, row.currency)}</span>,
            },
            {
              key: "issuedAt",
              label: "Issued",
              hideOnMobile: true,
              render: (row) => <span className="u-meta text-ink-2">{fmt(row.issuedAt)}</span>,
            },
            {
              key: "status",
              label: "Order payment",
              render: (row) =>
                row.status === "PAID" ? (
                  <StatusPill tone="success">
                    <CheckCircle className="h-3 w-3" aria-hidden="true" /> Paid
                  </StatusPill>
                ) : (
                  <StatusPill tone="warning">
                    <Clock className="h-3 w-3" aria-hidden="true" /> Unpaid
                  </StatusPill>
                ),
            },
            {
              key: "file",
              label: "",
              align: "end",
              render: (row) =>
                // A download only where a file was actually stored. A button that
                // does nothing is a promise, not a feature.
                row.fileUrl ? (
                  <Button variant="link" size="sm" asChild>
                    <a href={row.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-3 w-3" aria-hidden="true" /> PDF
                      <span className="sr-only"> for invoice {row.invoiceNo} (opens in a new tab)</span>
                    </a>
                  </Button>
                ) : (
                  <span className="u-meta text-ink-3">No file</span>
                ),
            },
          ]}
          empty={
            <EmptyState
              variant="certificate"
              glyph={<FileText />}
              eyebrow="Nothing recorded"
              headline="No tax invoice has been recorded against your orders."
              // Nothing issues tax invoices automatically today, so this states
              // what is recorded rather than promising when one will appear.
              body="Invoices are written by the platform against orders that contain your lines. None exists yet, and nothing on this account is waiting to be issued."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/orders">Open your orders</Link>
                </Button>
              }
            />
          }
        />

        <Dateline>
          A tax invoice carries the order's currency. Where this account has invoiced in more than one, the figures
          above are listed per currency rather than added together — a cross-currency sum is a number that exists in
          no ledger.
        </Dateline>
      </div>
    </SellerLayout>
  );
}
