import Link from "next/link";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money, CurrencyLedger } from "@/components/b2b/money";
import {
  Button,
  CellGrid,
  EmptyState,
  Eyebrow,
  LedgerTable,
  Stat,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { type SupportedCurrency } from "@avenick/utils";
import { fetchB2BJson } from "@/lib/b2b";
import { approvePO, rejectPO, markOrdered, cancelPO } from "./actions";
import { FileCheck2, Clock, CheckCircle2, Truck, XCircle, FileEdit, Plus, ShoppingCart } from "lucide-react";
import { ActionBanner } from "@/components/b2b/action-banner";
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey } from "@/components/b2b/messages";
import { toneRule } from "@/components/b2b/rules";

export async function generateMetadata() {
  return b2bMetadata("po.title");
}

// Six states, four tones. The amber pair that used to be written out per theme
// (`text-amber-600 dark:text-amber-400`) is now one token that has a dark value,
// and the label is a message key rather than an English word — a status map
// holding six English strings is how an Arabic page ends up with an English
// column.
const STATUS: Record<string, { labelKey: B2BKey; tone: PillTone; icon: typeof Clock }> = {
  DRAFT: { labelKey: "po.status.draft", tone: "neutral", icon: FileEdit },
  PENDING_APPROVAL: { labelKey: "po.status.pending", tone: "warning", icon: Clock },
  APPROVED: { labelKey: "po.status.approved", tone: "primary", icon: CheckCircle2 },
  ORDERED: { labelKey: "po.status.ordered", tone: "success", icon: Truck },
  REJECTED: { labelKey: "po.status.rejected", tone: "danger", icon: XCircle },
  CANCELLED: { labelKey: "po.status.cancelled", tone: "neutral", icon: XCircle },
};

export default async function PurchaseOrdersPage({ searchParams }: { searchParams?: { poDone?: string; poError?: string } }) {
  type PurchaseOrderRow = {
    id: string;
    poNumber: string;
    requesterId: string;
    status: string;
    currency: SupportedCurrency;
    total: string | number;
    notes: string | null;
    requiredDate: string | null;
    createdAt: string;
    items: Array<{ id: string; sku: string; nameEn: string; quantity: number }>;
  };
  type PurchaseOrderData = {
    company: { nameEn: string; country: string };
    isApprover: boolean;
    purchaseOrders: PurchaseOrderRow[];
    requesters: Array<{ id: string; firstName: string; lastName: string }>;
  };

  const { t, f } = await getB2B();

  let data: PurchaseOrderData;
  try {
    data = await fetchB2BJson<PurchaseOrderData>("/api/b2b/purchase-orders");
  } catch {
    return (
      <B2BShell title={t("po.title")}>
        <EmptyState
          variant="certificate"
          glyph={<FileCheck2 />}
          eyebrow={t("common.noCompany.eyebrow")}
          headline={t("common.noCompany.headline")}
          body={t("common.noCompany.body")}
          action={
            <Button asChild variant="primary">
              <Link href="/b2b/register">{t("common.noCompany.action")}</Link>
            </Button>
          }
        />
      </B2BShell>
    );
  }

  const pos = data.purchaseOrders;
  const nameOf = new Map(data.requesters.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const isApprover = data.isApprover;
  const open = pos.filter((p) => ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(p.status)).length;
  const pending = pos.filter((p) => p.status === "PENDING_APPROVAL").length;
  const orderedByCurrency = new Map<SupportedCurrency, number>();
  for (const po of pos.filter((row) => row.status === "ORDERED")) {
    orderedByCurrency.set(po.currency, (orderedByCurrency.get(po.currency) ?? 0) + Number(po.total));
  }
  // One row per currency, never a blended total: the platform holds no
  // exchange rates, so a sum across currencies is not a sum of anything.
  const orderedValue = [...orderedByCurrency.entries()].map(([currency, total]) => ({ currency, total }));

  return (
    <B2BShell
      workspace={data.company.nameEn}
      eyebrow={t("po.eyebrow")}
      title={t("po.title")}
      description={t("po.description", { company: data.company.nameEn })}
      // /api/b2b/purchase-orders returns the 100 most recent POs, and every
      // count and money figure on this page is computed from that array. The
      // window is stated so no figure here can be mistaken for a lifetime one.
      dateline={t("po.basis")}
    >
      <div className="space-y-block">
        <ActionBanner done={searchParams?.poDone} error={searchParams?.poError} />

        {/* Recessed, because it is context about how a PO is built — with the
            one action it leads to raised on top of it. The brass rule across
            its top edge is the same mark the masthead and the currency ledger
            carry: this band is the head of a procedure. */}
        <Surface rung={1} className="overflow-hidden">
          <div className="u-drawn w-14" data-on="true" aria-hidden="true" />
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="u-ui inline-flex items-center gap-2 font-medium text-ink-1">
                <ShoppingCart className="h-4 w-4 text-ink-3" aria-hidden="true" />
                {t("po.fromCart.title")}
              </p>
              <p className="u-meta mt-1 max-w-prose text-ink-2">{t("po.fromCart.body")}</p>
            </div>
            <Button asChild variant="primary" size="sm" className="shrink-0">
              <Link href="/b2b/purchase-orders/new">
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("po.fromCart.action")}
              </Link>
            </Button>
          </div>
        </Surface>

        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label={t("po.stat.pending")}
            value={pending}
            rank="section"
            chip={pending > 0 ? "warning" : "neutral"}
            icon={Clock}
          />
          <Stat label={t("po.stat.open")} value={open} icon={FileCheck2} note={t("po.stat.open.note")} />
          <div>
            <Eyebrow>{t("po.stat.orderedValue")}</Eyebrow>
            <div className="mt-1.5">
              <CurrencyLedger
                rows={orderedValue}
                label={t("money.byCurrency")}
                single={t("po.stat.orderedValue.basis")}
                multi={t("money.noConversion")}
                emptyLabel={t("money.nothingRecorded")}
              />
            </div>
          </div>
          {/* "Listed", not "Total": pos.length is the size of a 100-row window. */}
          <Stat label={t("po.stat.listed")} value={pos.length} icon={FileEdit} />
        </CellGrid>

        <LedgerTable
          rows={pos}
          getRowKey={(po) => po.id}
          stickyHead
          // Not "snapshotted at approval": this column carries `total` for every
          // row, including drafts and POs still awaiting a decision, which have
          // never been through an approval to be snapshotted at.
          dateline={t("po.table.basis")}
          // The same three pixels as the approval queue and the quotes list, so
          // a buyer scanning a hundred rows can see whose move each one is
          // before reading a single word of it.
          rowProps={(po) => ({ className: toneRule((STATUS[po.status] ?? STATUS.DRAFT!).tone) })}
          columns={[
            {
              key: "poNumber",
              label: t("po.col.number"),
              render: (po) => <span className="u-mono font-medium text-primary-ink">{po.poNumber}</span>,
            },
            {
              key: "lines",
              label: t("po.col.lines"),
              width: "260px",
              render: (po) =>
                po.items.length === 0 ? (
                  // Kept verbatim in meaning: a header-only PO predates line
                  // snapshotting and cannot be placed, and saying so is the
                  // whole point.
                  <span className="u-meta font-medium text-danger-ink">{t("po.lines.legacy")}</span>
                ) : (
                  <div className="py-1">
                    <p className="font-medium text-ink-1">
                      {t(po.items.length === 1 ? "po.lines.count.one" : "po.lines.count.other", {
                        count: po.items.length,
                      })}
                    </p>
                    <p className="u-meta mt-0.5 truncate text-ink-3">
                      <span className="u-mono">
                        {po.items.slice(0, 3).map((item) => `${item.sku} × ${item.quantity}`).join(" · ")}
                      </span>
                      {po.items.length > 3 ? " …" : ""}
                    </p>
                  </div>
                ),
            },
            {
              key: "requester",
              label: t("po.col.requester"),
              hideOnMobile: true,
              render: (po) => <span className="text-ink-2">{nameOf.get(po.requesterId) ?? t("common.unknown")}</span>,
            },
            {
              key: "total",
              label: t("po.col.value"),
              numeric: true,
              render: (po) => <Money amount={Number(po.total)} currency={po.currency} />,
            },
            {
              key: "status",
              label: t("common.status"),
              render: (po) => {
                const st = STATUS[po.status] ?? STATUS.DRAFT!;
                return (
                  <StatusPill tone={st.tone} className="whitespace-nowrap">
                    <st.icon className="h-3 w-3" aria-hidden="true" /> {t(st.labelKey)}
                  </StatusPill>
                );
              },
            },
            {
              key: "requiredDate",
              label: t("po.col.required"),
              hideOnMobile: true,
              render: (po) => (
                <span className="u-meta whitespace-nowrap text-ink-3">
                  {po.requiredDate ? f.date(po.requiredDate) : t("po.noDate")}
                </span>
              ),
            },
            {
              key: "actions",
              label: t("common.actions"),
              align: "end",
              render: (po) => (
                <div className="flex items-center justify-end gap-1">
                  {isApprover && po.status === "PENDING_APPROVAL" && (
                    <>
                      <form action={approvePO.bind(null, po.id)}>
                        <Button type="submit" variant="ghost" size="xs" className="text-success-ink hover:bg-success-soft hover:text-success-ink">
                          {t("common.approve")}
                        </Button>
                      </form>
                      <form action={rejectPO.bind(null, po.id)}>
                        <Button type="submit" variant="ghost" size="xs" className="hover:text-danger-ink">
                          {t("common.reject")}
                        </Button>
                      </form>
                    </>
                  )}
                  {po.status === "APPROVED" && po.items.length > 0 && (
                    <form action={markOrdered.bind(null, po.id)}>
                      <Button type="submit" variant="ghost" size="xs" className="text-primary-ink hover:bg-primary-soft hover:text-primary-ink">
                        {t("po.place")}
                      </Button>
                    </form>
                  )}
                  {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(po.status) && (
                    <form action={cancelPO.bind(null, po.id)}>
                      <Button type="submit" variant="ghost" size="xs" className="hover:text-danger-ink">
                        {t("common.cancel")}
                      </Button>
                    </form>
                  )}
                </div>
              ),
            },
          ]}
          // The one certificate on this page.
          empty={
            <EmptyState
              variant="certificate"
              glyph={<FileCheck2 />}
              eyebrow={t("po.empty.eyebrow")}
              headline={t("po.empty.headline")}
              body={t("po.empty.body")}
              action={
                <Button asChild variant="primary">
                  <Link href="/products?b2b=true">{t("po.empty.action")}</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </B2BShell>
  );
}
