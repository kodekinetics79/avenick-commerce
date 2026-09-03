import Link from "next/link";
import { format } from "date-fns";
import { requireSellerAnyPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import { setReturnStatus } from "./actions";
import {
  PageHeader,
  Surface,
  CellGrid,
  Stat,
  LedgerTable,
  EmptyState,
  StatusPill,
  Eyebrow,
  Button,
  type PillTone,
} from "@avenick/ui";
import { RotateCcw, AlertTriangle, CheckCircle2, List } from "lucide-react";

export const metadata = { title: "Returns" };

/**
 * Every ReturnStatus in the schema, labelled as the enum reads rather than as a
 * derived instruction. "REQUESTED" used to render as "Action needed", which is
 * true of the seller's inbox but is not the state the record holds — and a badge
 * that does not map to its own enum is the fastest way to lose a support call.
 * The urgency now lives on the count above and on the action buttons, which is
 * where an instruction belongs.
 */
const STATUS: Record<string, { label: string; tone: PillTone }> = {
  REQUESTED: { label: "Requested", tone: "warning" },
  APPROVED: { label: "Approved", tone: "primary" },
  REJECTED: { label: "Rejected", tone: "danger" },
  IN_TRANSIT: { label: "In transit", tone: "primary" },
  RECEIVED: { label: "Received", tone: "accent" },
  REFUNDED: { label: "Refunded", tone: "success" },
};

const statusView = (status: string) =>
  STATUS[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as PillTone };

export default async function SellerReturnsPage({ searchParams }: { searchParams?: { returnDone?: string; returnError?: string } }) {
  const { seller, membership } = await requireSellerAnyPermission(["returns.view", "returns.manage"]);

  const returns = await db.returnRequest.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: { select: { orderNumber: true, user: { select: { firstName: true, lastName: true } }, company: { select: { nameEn: true } } } },
    },
  });

  const pending = returns.filter((r) => r.status === "REQUESTED").length;
  const refunded = returns.filter((r) => r.status === "REFUNDED").length;
  const failed = Boolean(searchParams?.returnError);
  const flash = searchParams?.returnError ?? searchParams?.returnDone;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      {flash && (
        <Surface
          rung={2}
          tone={failed ? "danger" : "success"}
          role="status"
          aria-live="polite"
          className="mb-4 flex items-start gap-2.5 p-3"
        >
          {failed ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
          )}
          <div className="min-w-0">
            {/* The tone is already carried three ways — the wash, the edge and the
                icon — so the eyebrow keeps the metadata ink rather than fighting
                <Eyebrow>'s own colour class for the same specificity. */}
            <Eyebrow>{failed ? "Action failed" : "Done"}</Eyebrow>
            {/* ink-1 on the soft wash rather than the tone's own ink: this is a
                sentence, and the tone inks are sized for labels, not prose. */}
            <p className="u-ui mt-0.5 text-ink-1">{flash}</p>
          </div>
        </Surface>
      )}

      <div className="space-y-block">
        <PageHeader
          eyebrow="Fulfilment"
          title="Returns"
          description="Return requests raised by buyers against your products."
          // LAW E. The query takes 100 rows, so the three counts below describe
          // this page rather than the account's whole return history.
          dateline={`Your ${returns.length} most recent return requests · the counts below describe this view, not your full history`}
        />

        <CellGrid cols={{ base: 3 }}>
          <Stat
            label="Awaiting your response"
            value={pending}
            // Section rank unconditionally. Rank encodes what a metric IS — this
            // is the reason a seller opens the page — and swapping it on the
            // value makes the tile change size between two loads of the same
            // screen. "0 awaiting your response" at full rank is also the calmer,
            // more useful statement than the same zero shrunk to a footnote.
            rank="section"
            chip={pending > 0 ? "warning" : "neutral"}
            icon={RotateCcw}
            // No deadline: nothing enforces a response window or ties one to the
            // score. The original page carried that as a comment beside a
            // call-out band; the band is gone, so the fact is stated in the
            // provenance line where a seller can actually read it.
            dateline="Status REQUESTED · no response deadline is enforced by the platform"
          />
          {/* Conditional: a success chip over a zero count colours an absence as
              an achievement. */}
          <Stat label="Refunded" value={refunded} chip={refunded > 0 ? "success" : "neutral"} icon={CheckCircle2} />
          {/* An icon here too, so the three eyebrows in this grid sit on one
              baseline instead of the third starting 24px to the inline start of
              its neighbours. */}
          <Stat label="Shown here" value={returns.length} icon={List} />
        </CellGrid>

        <LedgerTable
          rows={returns}
          getRowKey={(r) => r.id}
          density="compact"
          stickyHead
          dateline="Buyer-raised requests, as recorded · a refund is executed by the platform, not from this page"
          columns={[
            {
              key: "returnNumber",
              label: "Return",
              // Mono is for identifiers. Never for money.
              render: (r) => <span className="u-mono text-ink-1">{r.returnNumber}</span>,
            },
            {
              key: "order",
              label: "Order",
              hideOnMobile: true,
              render: (r) => <span className="u-mono text-ink-3">{r.order.orderNumber}</span>,
            },
            {
              key: "buyer",
              label: "Buyer",
              render: (r) => (
                <span className="block max-w-[160px] truncate">
                  {r.order.company?.nameEn ?? `${r.order.user.firstName} ${r.order.user.lastName}`.trim()}
                </span>
              ),
            },
            {
              key: "reason",
              label: "Reason",
              hideOnMobile: true,
              render: (r) => <span className="block max-w-[220px] truncate text-ink-2">{r.reason}</span>,
            },
            {
              key: "createdAt",
              label: "Requested",
              hideOnMobile: true,
              render: (r) => (
                <time dateTime={r.createdAt.toISOString()} className="text-ink-3">
                  {format(r.createdAt, "MMM d, yyyy")}
                </time>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => {
                const view = statusView(r.status);
                return <StatusPill tone={view.tone} dot>{view.label}</StatusPill>;
              },
            },
            {
              key: "actions",
              label: "Decision",
              align: "end",
              render: (r) =>
                r.status === "REQUESTED" ? (
                  // Two decisions of equal visual weight sitting a few pixels
                  // apart is how a return gets rejected by accident in a dense
                  // row. Approve is a real raised control; reject is a quiet one
                  // in the danger ink. Both name the return in their accessible
                  // label, because "Approve" alone is meaningless when a screen
                  // reader announces it forty times down a column.
                  <div className="flex items-center justify-end gap-2">
                    <form action={setReturnStatus.bind(null, r.id, "APPROVED")}>
                      <Button type="submit" variant="secondary" size="xs" aria-label={`Approve return ${r.returnNumber}`}>
                        Approve
                      </Button>
                    </form>
                    <form action={setReturnStatus.bind(null, r.id, "REJECTED")}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="xs"
                        // hover:text-danger-ink is not redundant: the ghost
                        // variant carries hover:text-ink-1, which otherwise
                        // drains the reject control of its danger colour at the
                        // exact moment the pointer is on it.
                        className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink"
                        aria-label={`Reject return ${r.returnNumber}`}
                      >
                        Reject
                      </Button>
                    </form>
                  </div>
                ) : r.status === "APPROVED" || r.status === "RECEIVED" ? (
                  <span className="u-meta text-ink-3">Awaiting platform refund</span>
                ) : (
                  <span className="u-meta text-ink-3">—</span>
                ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No buyer has raised a return against your products."
              body="A return request appears here as soon as a buyer opens one, with the decision controls on its row."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/orders">Review your orders</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </SellerLayout>
  );
}
