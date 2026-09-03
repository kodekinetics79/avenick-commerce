import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Check } from "lucide-react";
import { db } from "@avenick/database";
import { formatCurrency, isSupportedCurrency, type SupportedCurrency } from "@avenick/utils";
import {
  PageHeader,
  Surface,
  Divider,
  Num,
  LedgerTable,
  EmptyState,
  StatusPill,
  Eyebrow,
  Dateline,
  Button,
} from "@avenick/ui";
import { SellerLayout } from "@/components/layout/seller-layout";
import { requireSellerAnyPermission } from "@/lib/auth";
import { ORDER_PRE_RELEASE, ORDER_STAGES, orderStatusMeta } from "@/components/orders/status-meta";

export const metadata = { title: "Order detail" };

/**
 * The status vocabulary, the stage sequence and the pre-release set now live in
 * ONE module shared with the orders ledger, the fulfilment bulk actions and the
 * dashboard — components/orders/status-meta.ts. This page used to carry its own
 * exhaustive copy while the table three clicks away carried a second one written
 * in raw Tailwind hues; three maps for one enum is how the same order comes to
 * read "Out for delivery" here and "OUT FOR DELIVERY" there.
 */
const statusView = orderStatusMeta;
const STAGES = ORDER_STAGES;
const PRE_RELEASE = ORDER_PRE_RELEASE;

/**
 * formatCurrency's own fallback prints an unrecognised code verbatim rather than
 * another currency's symbol, so an unknown code is routed to it deliberately.
 * What this page used to do — `order.currency as "AED"` — asserted one specific
 * currency into the type system for a value that can legitimately be SAR or KWD.
 */
const money = (amount: number, code: string) =>
  formatCurrency(amount, isSupportedCurrency(code) ? code : (code as SupportedCurrency));

export default async function SellerOrderDetailPage({ params }: { params: { id: string } }) {
  const { seller, membership } = await requireSellerAnyPermission(["orders.view", "orders.fulfill"]);
  const order = await db.order.findFirst({
    where: { id: params.id, items: { some: { sellerId: seller.id } } },
    select: {
      orderNumber: true,
      createdAt: true,
      currency: true,
      type: true,
      status: true,
      user: { select: { firstName: true, lastName: true } },
      company: { select: { nameEn: true } },
      items: {
        where: { sellerId: seller.id },
        select: {
          id: true,
          nameEn: true,
          sku: true,
          quantity: true,
          unitPrice: true,
          vatAmount: true,
          total: true,
          status: true,
        },
      },
    },
  });
  if (!order) notFound();

  const sellerSubtotal = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const sellerVat = order.items.reduce((sum, item) => sum + Number(item.vatAmount), 0);
  const sellerTotal = order.items.reduce((sum, item) => sum + Number(item.total), 0);
  const buyer = `${order.user.firstName} ${order.user.lastName}`.trim();
  const status = statusView(order.status);

  /**
   * THE RAIL'S POSITION IS THIS SELLER'S OWN LINES, not `order.status`.
   *
   * advanceSellerOrderItems derives a parent order's status from the
   * LEAST-ADVANCED line across EVERY seller, precisely so one supplier cannot
   * declare another supplier's items shipped. On a multi-seller order that makes
   * `order.status` a statement about somebody else: a supplier who had shipped
   * all of their own lines would still be shown as processing because a second
   * supplier had not moved. Every other figure on this page is this seller's
   * lines only, and after the rail read the marketplace value it was the one
   * element on the screen quietly reporting a stranger's progress as the
   * seller's own.
   *
   * So the position is the floor of this seller's own lines, computed with the
   * same least-advanced rule the platform itself uses. The order's own status
   * stays visible in the pill beside the title, where it is labelled as the
   * order's.
   */
  const stageOf = (value: string) => (STAGES as readonly string[]).indexOf(value);
  const lineStages = order.items.map((item) => stageOf(item.status));
  const noLines = lineStages.length === 0;
  const onTrack = !noLines && lineStages.every((s) => s >= 0);
  const stageIndex = onTrack ? Math.min(...lineStages) : -1;
  const preRelease = !noLines && !onTrack && order.items.every((item) => PRE_RELEASE.has(item.status));
  // Anything neither on the track nor before it — cancelled, refunded, returned,
  // or a mix of the two — is an exception, and drawing a five-step progress rail
  // for it would imply a journey these lines are no longer on.
  const offTrack = !onTrack && !preRelease;
  // Stated only when it is true: a rail can show one node, and a seller whose
  // lines are split across two stages must not read that node as "all of it".
  const splitStages = onTrack && new Set(lineStages).size > 1;
  const lineStateLabels = Array.from(new Set(order.items.map((item) => statusView(item.status).label)));

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <div>
          <Button variant="link" size="sm" asChild className="mb-2 -ms-1 px-1">
            <Link href="/orders">
              {/* The arrow is an icon that flips, not a literal "←" that cannot. */}
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" /> Back to orders
            </Link>
          </Button>

          <PageHeader
            eyebrow="Order"
            title={order.orderNumber}
            description={`${buyer}${order.company?.nameEn ? ` · ${order.company.nameEn}` : ""} · ${format(order.createdAt, "MMM d, yyyy")}`}
            actions={
              <>
                <StatusPill tone="neutral">
                  <span className="sr-only">Order type: </span>
                  {order.type}
                </StatusPill>
                {/* Named for a screen reader as the ORDER's status, because the
                    rail below deliberately reports a different thing — this
                    seller's own lines — and two unlabelled state pills a few
                    pixels apart is how the two get read as one. */}
                <StatusPill tone={status.tone} dot>
                  <span className="sr-only">Order status: </span>
                  {status.label}
                </StatusPill>
              </>
            }
          />
        </div>

        {/* THE FULFILMENT TRACK.
            Recessed, because it is context rather than an action: nothing here is
            clickable, and the rung says so before a word is read. The stages come
            from the platform's own transition list, the position comes from this
            seller's own lines, and the dateline states plainly that this is a
            position and not a history — no per-stage timestamps are queried by
            this page, so none are implied. */}
        <Surface rung={1} className="p-4">
          <Eyebrow>Your fulfilment stage</Eyebrow>

          {offTrack ? (
            <div className="mt-2">
              <p className="u-body text-ink-1">
                {noLines
                  ? "No fulfilment position is shown: this order carries no lines from your account."
                  : "No fulfilment position is shown, because your lines on this order are not all inside the fulfilment sequence."}
              </p>
              {!noLines && (
                <Dateline className="mt-1">
                  {`Your lines are recorded as ${lineStateLabels.join(", ").toLowerCase()} · the order itself is recorded as ${status.label.toLowerCase()}`}
                </Dateline>
              )}
            </div>
          ) : (
            <>
              <ol className="mt-3 flex items-start" aria-label="Fulfilment stages">
                {STAGES.map((stage, i) => {
                  const done = i < stageIndex;
                  const current = i === stageIndex;
                  const view = statusView(stage);
                  return (
                    <li
                      key={stage}
                      className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                      aria-current={current ? "step" : undefined}
                    >
                      <div className="flex w-full items-center">
                        {/* Both connectors are always rendered — transparent at the
                            two outer edges — so every node sits at the centre of
                            its own column and the labels below line up with them.
                            A segment is filled only for a stage the order has
                            actually passed, so an unfilled rail never claims
                            progress that has not happened. */}
                        <span
                          className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : done || current ? "bg-success" : "bg-border"}`}
                          aria-hidden="true"
                        />
                        <span
                          className={[
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-pill",
                            done
                              ? "bg-success text-success-fg"
                              : current
                                // Raised current position rather than a coloured
                                // bar: it survives both themes and spends none of
                                // the portal's single primary fill.
                                ? "bg-surface-2 text-ink-1 shadow-elev-3 ring-1 ring-border-strong"
                                : "bg-surface-1 text-ink-3 ring-1 ring-hairline",
                          ].join(" ")}
                        >
                          {done ? (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <span className={`h-2 w-2 rounded-pill ${current ? "bg-ink-1" : "bg-ink-3/40"}`} aria-hidden="true" />
                          )}
                        </span>
                        <span
                          className={`h-0.5 flex-1 ${i === STAGES.length - 1 ? "bg-transparent" : i < stageIndex ? "bg-success" : "bg-border"}`}
                          aria-hidden="true"
                        />
                      </div>
                      {/* The colour, the check and the raised node carry the
                          state for a sighted reader and for nobody else — every
                          one of those marks is aria-hidden, so without this the
                          rail announces five identical stage names. */}
                      <span className="sr-only">
                        {done ? "Completed: " : current ? "Current stage: " : "Not reached: "}
                      </span>
                      <Eyebrow className={`px-1 text-center ${done || current ? "text-ink-1" : "text-ink-3"}`}>
                        {view.label}
                      </Eyebrow>
                    </li>
                  );
                })}
              </ol>

              <Dateline className="mt-3">
                {preRelease
                  ? `Your lines are recorded as ${lineStateLabels.join(", ").toLowerCase()} — this order has not been released for fulfilment · position only, no stage timestamps on this view`
                  : splitStages
                    ? `Position of your own lines, not the order's · your ${order.items.length} lines are not all at the same stage, so the rail shows the least advanced of them · this view carries no stage timestamps`
                    : "Position of your own lines, not the order's · the order's own status is the pill beside the title · this view carries no stage timestamps"}
              </Dateline>
            </>
          )}
        </Surface>

        <LedgerTable
          title={`Your lines (${order.items.length})`}
          // The original page said this in 11px grey. It is the most important
          // sentence on the screen: every figure below is a slice of the order,
          // not the order.
          dateline={`Only ${seller.businessNameEn} lines and totals · other sellers' lines and platform charges are not shown`}
          rows={order.items}
          getRowKey={(item) => item.id}
          density="compact"
          columns={[
            {
              key: "item",
              label: "Item",
              render: (item) => (
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-1">{item.nameEn}</p>
                  {/* Mono is for identifiers — SKUs, order refs, tracking IDs —
                      and never for money. */}
                  <p className="u-mono u-meta truncate text-ink-3">{item.sku}</p>
                </div>
              ),
            },
            { key: "quantity", label: "Qty", numeric: true, width: "72px" },
            {
              key: "unitPrice",
              label: "Unit price",
              numeric: true,
              hideOnMobile: true,
              render: (item) => money(Number(item.unitPrice), order.currency),
            },
            {
              key: "vatAmount",
              label: "VAT",
              numeric: true,
              hideOnMobile: true,
              render: (item) => money(Number(item.vatAmount), order.currency),
            },
            {
              key: "total",
              label: "Line total",
              numeric: true,
              render: (item) => <span className="font-medium text-ink-1">{money(Number(item.total), order.currency)}</span>,
            },
            {
              key: "status",
              label: "Line status",
              render: (item) => {
                const view = statusView(item.status);
                return <StatusPill tone={view.tone}>{view.label}</StatusPill>;
              },
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="This order carries no lines from your account."
              body="You are seeing the order because it did at the time it was opened. Reload to refresh what is recorded."
            />
          }
        />

        {/* The settlement summary reads as the foot of an invoice rather than as
            three floating tiles: hairline-separated rows, labels at the inline
            start, figures at the inline end, and the one figure a seller opened
            this page for promoted to section rank above a 2px underrule.

            The currency code is carried inside every figure rather than stated
            once in a heading, because a supplier holding AED and SAR orders side
            by side must never have to remember which page they are on. */}
        <div className="ms-auto w-full max-w-sm">
          <Surface rung={2} className="overflow-hidden">
            <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
              <Eyebrow>Subtotal</Eyebrow>
              <span className="fig text-ui text-ink-2">{money(sellerSubtotal, order.currency)}</span>
            </div>
            <Divider />
            <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
              <Eyebrow>VAT</Eyebrow>
              <span className="fig text-ui text-ink-2">{money(sellerVat, order.currency)}</span>
            </div>
            <Divider tone="strong" />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
              <Eyebrow>Seller total</Eyebrow>
              <Num value={money(sellerTotal, order.currency)} rank="section" />
            </div>
          </Surface>
          <Dateline className="mt-1.5">
            Summed from your lines above, in the order's own currency · no conversion applied
          </Dateline>
        </div>
      </div>
    </SellerLayout>
  );
}
