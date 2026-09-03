import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Plus } from "lucide-react";
import { Button, CellGrid, EmptyState, LedgerTable, Stat, StatusPill } from "@avenick/ui";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { RFQ_STATUS } from "@/components/b2b/rfq-status";
import type { RFQStatus } from "@avenick/database";
import { fetchB2BJson } from "@/lib/b2b";
import { format } from "date-fns";

export const metadata = { title: "Quotes & RFQs" };
export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  type RFQRow = {
    id: string;
    rfqNumber: string;
    status: RFQStatus;
    requiredBy: string | null;
    totalQuoted: string | number | null;
    currency: string;
    createdAt: string;
    items: Array<{ quantity: number; nameEn: string }>;
    seller: { businessNameEn: string } | null;
  };
  let rfqs: RFQRow[];
  try {
    rfqs = await fetchB2BJson<RFQRow[]>("/api/b2b/rfqs");
  } catch {
    redirect("/b2b/register");
  }

  const awaiting = rfqs.filter((r) => ["SUBMITTED", "UNDER_REVIEW"].includes(r.status)).length;
  const quoted = rfqs.filter((r) => ["QUOTED", "NEGOTIATING"].includes(r.status)).length;
  const accepted = rfqs.filter((r) => r.status === "ACCEPTED").length;

  return (
    <B2BShell
      eyebrow="Working"
      title="Quotes & RFQs"
      description="Track your requests for quotation and supplier responses."
      // getRFQsForBuyer takes the 50 most recent rows. Every count in the panel
      // below and every row in the table is drawn from that window, so no
      // figure on this page may be described as a lifetime total.
      dateline="The 50 most recent requests raised by your company, newest first"
    >
      <div className="space-y-block">
        {/* "Quotes to review" leads at section rank because it is the only one
            of the four that is a queue of work rather than a count of history. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label="Quotes to review"
            value={quoted}
            rank="section"
            chip={quoted > 0 ? "warning" : "neutral"}
          />
          <Stat label="Awaiting quotes" value={awaiting} />
          <Stat label="Accepted" value={accepted} chip={accepted > 0 ? "success" : "neutral"} />
          {/* "Listed", not "Total": this is the length of a 50-row window, and
              a company past its fiftieth RFQ would read a cap as a total. */}
          <Stat label="Requests listed" value={rfqs.length} />
        </CellGrid>

        <LedgerTable
          rows={rfqs}
          getRowKey={(r) => r.id}
          stickyHead
          dateline="Quoted totals in the currency the supplier priced in · no conversion applied"
          columns={[
            {
              key: "rfqNumber",
              label: "RFQ",
              render: (r) => (
                <div className="py-1">
                  <Link
                    href={`/b2b/rfq/${r.id}`}
                    className="u-focus u-mono rounded-nested font-medium text-primary-ink hover:underline"
                  >
                    {r.rfqNumber}
                  </Link>
                  {r.requiredBy && (
                    <p className="u-meta mt-0.5 inline-flex items-center gap-1 text-ink-3">
                      <Clock className="h-3 w-3" aria-hidden="true" /> needed{" "}
                      {format(new Date(r.requiredBy), "MMM d")}
                    </p>
                  )}
                </div>
              ),
            },
            {
              key: "items",
              label: "Items",
              hideOnMobile: true,
              render: (r) => (
                <p className="max-w-xs truncate text-ink-2">
                  {r.items.slice(0, 2).map((i) => `${i.quantity}× ${i.nameEn}`).join(", ")}
                  {r.items.length > 2 ? ` +${r.items.length - 2} more` : ""}
                </p>
              ),
            },
            {
              key: "seller",
              label: "Supplier",
              hideOnMobile: true,
              render: (r) => <span className="text-ink-2">{r.seller?.businessNameEn ?? "Not yet assigned"}</span>,
            },
            {
              key: "totalQuoted",
              label: "Quoted total",
              numeric: true,
              render: (r) =>
                r.totalQuoted ? (
                  <Money amount={Number(r.totalQuoted)} currency={r.currency} />
                ) : (
                  <span className="u-meta text-ink-3">Not quoted</span>
                ),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => {
                const cfg = RFQ_STATUS[r.status];
                return <StatusPill tone={cfg.tone}>{cfg.label}</StatusPill>;
              },
            },
            {
              key: "createdAt",
              label: "Created",
              align: "end",
              hideOnMobile: true,
              render: (r) => (
                <span className="u-meta whitespace-nowrap text-ink-3">
                  {format(new Date(r.createdAt), "MMM d, yyyy")}
                </span>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="This company has not raised a request for quotation yet."
              body="An RFQ asks a supplier to price a specific list of items and quantities. Nothing is committed by sending one."
              action={
                <Button asChild variant="primary" size="sm">
                  <Link href="/b2b/rfq/new">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Create your first RFQ
                  </Link>
                </Button>
              }
            />
          }
        />
      </div>
    </B2BShell>
  );
}
