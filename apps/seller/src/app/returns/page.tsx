import Link from "next/link";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
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

// generateMetadata rather than a static object: a document title is a
// user-visible string, and a literal here read English at an Arabic desk.
export async function generateMetadata() {
  const t = await getTranslations("sellerOps");
  return { title: t("returns.metaTitle") };
}

/**
 * Every ReturnStatus in the schema, mapped to the tone it carries.
 *
 * The LABEL half lives in the message tree at sellerOps.returns.status.<ENUM>,
 * shared with returns/actions.ts so the flash message and the pill can never
 * name the same state two different ways. It is labelled as the enum READS
 * rather than as a derived instruction: "REQUESTED" used to render as "Action
 * needed", which is true of the seller's inbox but is not the state the record
 * holds — and a badge that does not map to its own enum is the fastest way to
 * lose a support call. The urgency lives on the count above and on the action
 * buttons, which is where an instruction belongs.
 */
const STATUS_TONE: Record<string, PillTone> = {
  REQUESTED: "warning",
  APPROVED: "primary",
  REJECTED: "danger",
  IN_TRANSIT: "primary",
  RECEIVED: "accent",
  REFUNDED: "success",
};

export default async function SellerReturnsPage({ searchParams }: { searchParams?: { returnDone?: string; returnError?: string } }) {
  const t = await getTranslations("sellerOps");
  const { seller, membership } = await requireSellerAnyPermission(["returns.view", "returns.manage"]);

  // A status nobody has named yet is still a fact about the record, so it is
  // shown as it reads rather than dropped or relabelled.
  const statusView = (status: string) => ({
    label: t.has(`returns.status.${status}`) ? t(`returns.status.${status}`) : status.replace(/_/g, " "),
    tone: STATUS_TONE[status] ?? ("neutral" as PillTone),
  });

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
            <Eyebrow>{failed ? t("returns.flash.failed") : t("returns.flash.done")}</Eyebrow>
            {/* ink-1 on the soft wash rather than the tone's own ink: this is a
                sentence, and the tone inks are sized for labels, not prose. */}
            <p className="u-ui mt-0.5 text-ink-1">{flash}</p>
          </div>
        </Surface>
      )}

      <div className="space-y-block">
        <PageHeader
          eyebrow={t("returns.eyebrow")}
          title={t("returns.title")}
          description={t("returns.description")}
          // LAW E. The query takes 100 rows, so the three counts below describe
          // this page rather than the account's whole return history.
          // `n` is the same figure as `count`, passed as a STRING: `count` picks
          // the plural form, and a bare number would render in the locale's own
          // numeral system where this product uses Western digits throughout.
          dateline={t("returns.dateline", { count: returns.length, n: String(returns.length) })}
        />

        <CellGrid cols={{ base: 3 }}>
          <Stat
            label={t("returns.stats.pending")}
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
            dateline={t("returns.stats.pendingDateline")}
          />
          {/* Conditional: a success chip over a zero count colours an absence as
              an achievement. */}
          <Stat label={t("returns.stats.refunded")} value={refunded} chip={refunded > 0 ? "success" : "neutral"} icon={CheckCircle2} />
          {/* An icon here too, so the three eyebrows in this grid sit on one
              baseline instead of the third starting 24px to the inline start of
              its neighbours. */}
          <Stat label={t("returns.stats.shownHere")} value={returns.length} icon={List} />
        </CellGrid>

        <LedgerTable
          rows={returns}
          getRowKey={(r) => r.id}
          density="compact"
          stickyHead
          dateline={t("returns.tableDateline")}
          columns={[
            {
              key: "returnNumber",
              label: t("returns.col.returnNumber"),
              // Mono is for identifiers. Never for money.
              render: (r) => <span className="u-mono text-ink-1">{r.returnNumber}</span>,
            },
            {
              key: "order",
              label: t("returns.col.order"),
              hideOnMobile: true,
              render: (r) => <span className="u-mono text-ink-3">{r.order.orderNumber}</span>,
            },
            {
              key: "buyer",
              label: t("returns.col.buyer"),
              render: (r) => (
                <span className="block max-w-[160px] truncate">
                  {r.order.company?.nameEn ?? `${r.order.user.firstName} ${r.order.user.lastName}`.trim()}
                </span>
              ),
            },
            {
              key: "reason",
              label: t("returns.col.reason"),
              hideOnMobile: true,
              render: (r) => <span className="block max-w-[220px] truncate text-ink-2">{r.reason}</span>,
            },
            {
              key: "createdAt",
              label: t("returns.col.requested"),
              hideOnMobile: true,
              render: (r) => (
                <time dateTime={r.createdAt.toISOString()} className="text-ink-3">
                  {format(r.createdAt, "MMM d, yyyy")}
                </time>
              ),
            },
            {
              key: "status",
              label: t("returns.col.status"),
              render: (r) => {
                const view = statusView(r.status);
                return <StatusPill tone={view.tone} dot>{view.label}</StatusPill>;
              },
            },
            {
              key: "actions",
              label: t("returns.col.decision"),
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
                      <Button
                        type="submit"
                        variant="secondary"
                        size="xs"
                        aria-label={t("returns.approveAria", { number: r.returnNumber })}
                      >
                        {t("returns.approve")}
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
                        aria-label={t("returns.rejectAria", { number: r.returnNumber })}
                      >
                        {t("returns.reject")}
                      </Button>
                    </form>
                  </div>
                ) : r.status === "APPROVED" || r.status === "RECEIVED" ? (
                  <span className="u-meta text-ink-3">{t("returns.awaitingRefund")}</span>
                ) : (
                  <span className="u-meta text-ink-3">—</span>
                ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("returns.empty.eyebrow")}
              headline={t("returns.empty.headline")}
              body={t("returns.empty.body")}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/orders">{t("returns.empty.action")}</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </SellerLayout>
  );
}
