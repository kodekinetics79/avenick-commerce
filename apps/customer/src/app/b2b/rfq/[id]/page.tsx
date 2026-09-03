import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle, XCircle, Clock, Store, MessageSquare } from "lucide-react";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  FieldWell,
  LedgerTable,
  Num,
  PageHeader,
  StatusPill,
  Surface,
  TierMark,
} from "@avenick/ui";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { RFQ_STATUS } from "@/components/b2b/rfq-status";
import type { RFQStatus } from "@avenick/database";
import { RECORD_ID } from "@avenick/utils";
import { platformName } from "@avenick/utils/portal-config";
import { fetchB2BJson } from "@/lib/b2b";
import { acceptRFQQuote, rejectRFQQuote } from "../actions";
import { format } from "date-fns";

export const metadata = { title: "RFQ Detail" };
export const dynamic = "force-dynamic";

/**
 * Who wrote a thread message, in the buyer's terms. The stored value is the
 * MessageSenderType enum, which read as "BUYER"/"SELLER" on the page. The
 * supplier is named when the RFQ has been routed to one; a platform message
 * is labelled with the configured platform name rather than "ADMIN", and an
 * automated one says so. Any value this page does not know is shown as a
 * neutral "Participant" instead of leaking the raw enum.
 */
function senderLabel(senderType: string, supplierName: string | null): string {
  switch (senderType) {
    case "BUYER": return "You";
    case "SELLER": return supplierName ?? "Supplier";
    case "ADMIN": return platformName();
    case "SYSTEM": return `${platformName()} (automated)`;
    default: return "Participant";
  }
}

/**
 * Seller tiers, as stored. STANDARD is deliberately absent from the brass set:
 * brass has a hard ≤2% viewport budget and exactly three permitted uses, and a
 * gold award mark on every supplier — including one carrying the baseline tier —
 * is what turns a mark of distinction into wallpaper. A standard supplier's tier
 * is still stated; it is just stated in ink rather than in brass.
 */
const TIER_LABEL: Record<string, string> = {
  STANDARD: "Standard supplier",
  VERIFIED: "Verified",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};
const BRASS_TIERS = new Set(["VERIFIED", "GOLD", "PLATINUM"]);

export default async function RFQDetailPage({ params }: { params: { id: string } }) {
  type RFQDetail = {
    id: string;
    rfqNumber: string;
    status: RFQStatus;
    currency: string;
    notes: string | null;
    totalQuoted: string | number | null;
    quoteVersion: number;
    createdAt: string;
    requiredBy: string | null;
    seller: { businessNameEn: string; tier: string } | null;
    items: Array<{
      id: string;
      nameEn: string;
      notes: string | null;
      quantity: number;
      unitQuoted: string | number | null;
    }>;
    /** The LATEST messages on the thread, not the whole history. */
    messages: Array<{
      id: string;
      senderType: string;
      body: string;
      createdAt: string;
    }>;
    /** Count of every message on the thread; present when the API paginates. */
    messageTotal?: number;
  };
  // params.id is URL-decoded by Next, so a crafted link can deliver path
  // separators here — and fetchB2BJson forwards the caller's cookies, making an
  // unencoded value a confused-deputy primitive against other authenticated
  // routes. Validate the id shape, then encode it.
  if (!RECORD_ID.test(params.id)) notFound();

  let rfq: RFQDetail;
  try {
    rfq = await fetchB2BJson<RFQDetail>(`/api/b2b/rfqs/${encodeURIComponent(params.id)}`);
  } catch (error) {
    if (error instanceof Error && error.message === "RFQ not found") notFound();
    redirect("/b2b/register");
  }

  const cfg = RFQ_STATUS[rfq.status];
  const quoted = rfq.status === "QUOTED" || rfq.status === "NEGOTIATING";
  const quotedTotal = rfq.totalQuoted ? Number(rfq.totalQuoted) : null;

  return (
    <B2BShell>
      {/* The page used to paint its own slate ground and its own centred column
          inside the portal shell, which meant an RFQ looked like a different
          product from the list it was opened from. It is now one measure of
          reading width on the portal's own ground. */}
      <div className="max-w-3xl space-y-block">
        <PageHeader
          breadcrumbs={[{ label: "Quotes", href: "/b2b/quotes" }, { label: rfq.rfqNumber }]}
          eyebrow="Request for quotation"
          title={rfq.rfqNumber}
          dateline={
            rfq.requiredBy
              ? `Raised ${format(new Date(rfq.createdAt), "MMM d, yyyy")} · required by ${format(new Date(rfq.requiredBy), "MMM d, yyyy")}`
              : `Raised ${format(new Date(rfq.createdAt), "MMM d, yyyy")} · no required-by date set`
          }
          actions={<StatusPill tone={cfg.tone}>{cfg.label}</StatusPill>}
          linkComponent={Link}
        />

        {rfq.notes && (
          <FieldWell padded>
            <Eyebrow className="mb-1">Request notes</Eyebrow>
            <p className="u-body whitespace-pre-line text-ink-1">{rfq.notes}</p>
          </FieldWell>
        )}

        <Surface rung={2} className="flex items-center gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-neutral-soft text-ink-2">
            <Store className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {rfq.seller ? (
              <>
                <p className="u-ui font-medium text-ink-1">{rfq.seller.businessNameEn}</p>
                <p className="u-meta flex flex-wrap items-center gap-2 text-ink-3">
                  Quoting supplier
                  {/* The tier is the one the seller record actually carries —
                      brass marks a fact, it never decorates, and it only marks a
                      tier that is a distinction. The raw enum never reaches the
                      page: an unmapped value reads as its own label, not as
                      PLATINUM_PLUS. */}
                  {BRASS_TIERS.has(rfq.seller.tier) ? (
                    <TierMark tier={rfq.seller.tier} label={TIER_LABEL[rfq.seller.tier] ?? rfq.seller.tier} />
                  ) : (
                    <span>· {TIER_LABEL[rfq.seller.tier] ?? rfq.seller.tier}</span>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="u-ui font-medium text-ink-1">No supplier assigned yet</p>
                <p className="u-meta text-ink-3">An RFQ carries at most one supplier, assigned after it is submitted.</p>
              </>
            )}
          </div>
        </Surface>

        <LedgerTable
          title="Line items"
          dateline={`Quantities as requested · unit prices as quoted by the supplier, in ${rfq.currency}`}
          rows={rfq.items}
          getRowKey={(item) => item.id}
          columns={[
            {
              key: "nameEn",
              label: "Item",
              render: (item) => (
                <div className="py-1">
                  <p className="font-medium text-ink-1">{item.nameEn}</p>
                  {item.notes && <p className="u-meta text-ink-2">{item.notes}</p>}
                </div>
              ),
            },
            {
              key: "quantity",
              label: "Qty",
              numeric: true,
              render: (item) => <Num value={item.quantity} />,
            },
            {
              key: "unitQuoted",
              label: "Unit quote",
              numeric: true,
              render: (item) =>
                item.unitQuoted ? (
                  <Money amount={Number(item.unitQuoted)} currency={rfq.currency} />
                ) : (
                  <span className="u-meta text-ink-3">Not priced</span>
                ),
            },
            {
              key: "lineTotal",
              label: "Line total",
              numeric: true,
              render: (item) =>
                item.unitQuoted ? (
                  <Money amount={Number(item.unitQuoted) * item.quantity} currency={rfq.currency} />
                ) : (
                  <span className="u-meta text-ink-3">—</span>
                ),
            },
          ]}
          footer={
            quotedTotal !== null ? (
              <span className="flex items-center justify-between gap-3">
                <Eyebrow as="span">Quoted total</Eyebrow>
                <Money amount={quotedTotal} currency={rfq.currency} rank="section" />
              </span>
            ) : (
              <span>The supplier has not priced this request yet, so there is no quoted total.</span>
            )
          }
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="This request has no line items."
              body="An RFQ needs at least one item and quantity for a supplier to price."
            />
          }
        />

        {quoted && (
          /* The decision. A recessed well, because it is the terms you are
             deciding on, carrying the one raised commit action. The paragraph
             under it is not fine print: it is the difference between "accepted"
             and "ordered", and it stays exactly as written. */
          <FieldWell padded>
            <Eyebrow className="mb-3">Your decision</Eyebrow>
            <div className="flex flex-wrap items-center gap-2">
              <form action={acceptRFQQuote.bind(null, rfq.id, rfq.quoteVersion)}>
                <Button type="submit" variant="primary" size="md">
                  <CheckCircle className="h-4 w-4" aria-hidden="true" /> Accept quote
                </Button>
              </form>
              <form action={rejectRFQQuote.bind(null, rfq.id, rfq.quoteVersion)}>
                <Button type="submit" variant="ghost" size="md" className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink">
                  <XCircle className="h-4 w-4" aria-hidden="true" /> Decline
                </Button>
              </form>
            </div>
            <p className="u-meta mt-3 max-w-prose text-ink-2">
              Accepting records your acceptance of the supplier&apos;s quoted price and closes this RFQ. It does not
              message the supplier and does not create an order &mdash; confirm with them directly, then{" "}
              <Link href="/b2b/purchase-orders/new" className="u-focus rounded-nested text-primary-ink hover:underline">
                raise a purchase order
              </Link>{" "}
              separately. Purchase-order lines are re-priced from the catalog, so the quoted total above is not
              carried across for you.
            </p>
          </FieldWell>
        )}

        {!quoted && rfq.status === "SUBMITTED" && (
          <Surface rung={1} tone="accent" className="flex items-start gap-2 p-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <p className="u-ui text-ink-1">
              Waiting for supplier quotes — no alert is sent when pricing arrives, so check this page for updates.
            </p>
          </Surface>
        )}

        {rfq.messages.length > 0 && (
          <Surface rung={2} className="p-5">
            <h2 className="u-h3 inline-flex items-center gap-1.5 text-ink-1">
              <MessageSquare className="h-4 w-4 text-ink-3" aria-hidden="true" /> Messages
            </h2>
            {typeof rfq.messageTotal === "number" && rfq.messageTotal > rfq.messages.length && (
              <Dateline className="mt-0.5">
                Showing the latest {rfq.messages.length} of {rfq.messageTotal} messages
              </Dateline>
            )}
            <ul className="mt-4 space-y-2">
              {rfq.messages.map((m) => (
                <li key={m.id} className="border-s-2 border-hairline ps-3">
                  <Eyebrow className="mb-0.5">
                    {senderLabel(m.senderType, rfq.seller?.businessNameEn ?? null)} ·{" "}
                    {format(new Date(m.createdAt), "MMM d, HH:mm")}
                  </Eyebrow>
                  <p className="u-body text-ink-1">{m.body}</p>
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </div>
    </B2BShell>
  );
}
