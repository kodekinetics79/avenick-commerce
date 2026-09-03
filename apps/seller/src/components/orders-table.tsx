"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Download, Package, Search, Truck, X } from "lucide-react";
import { formatCurrency, isSupportedCurrency, cn } from "@avenick/utils";
import {
  Button,
  Dateline,
  Divider,
  EmptyState,
  FieldWell,
  Input,
  LedgerTable,
  StatusPill,
  Surface,
  type LedgerColumn,
} from "@avenick/ui";
import { useToast } from "@/components/toast";
import { bulkUpdateOrderStatus } from "@/app/orders/actions";
import { ActionReport, type ActionReportData } from "@/components/products/action-report";
import { orderChannelTone, orderStatusMeta } from "@/components/orders/status-meta";

export type OrderRow = {
  id: string;
  orderNumber: string;
  buyer: string;
  company: string;
  date: string;
  itemCount: number;
  total: number;
  currency: string;
  type: string;
  status: string;
};

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function exportCsv(rows: OrderRow[], filename: string) {
  const headers = ["Order", "Buyer", "Company", "Date", "Items", "Total", "Currency", "Type", "Status"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.orderNumber, r.buyer, r.company, r.date, r.itemCount, r.total, r.currency, r.type, r.status].map(csvCell).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * A total is printed in the order's OWN currency and never converted. An
 * unsupported code is printed verbatim beside its figure rather than being
 * dressed in another currency's symbol — the same rule the catalog table keeps.
 */
function money(total: number, currency: string): string {
  if (isSupportedCurrency(currency)) return formatCurrency(total, currency);
  return `${currency} ${total.toFixed(2)}`;
}

const ADVANCE: Array<{ status: "PROCESSING" | "SHIPPED" | "DELIVERED"; label: string; icon: typeof Package }> = [
  { status: "PROCESSING", label: "Mark processing", icon: Package },
  { status: "SHIPPED", label: "Mark shipped", icon: Truck },
  { status: "DELIVERED", label: "Mark delivered", icon: CheckCircle },
];

/**
 * The fulfilment ledger.
 *
 * This surface was the last piece of the seller portal still written in round
 * zero: a hand-rolled `rounded-2xl border bg-card` table with its own status
 * palette (`bg-amber-500/15 text-amber-600` — a raw Tailwind hue with no dark
 * counterpart and no token behind it), money set in `font-mono font-bold`
 * (mono is reserved for SKUs, order refs and tracking IDs — never money, because
 * a system monospace differs per operating system and a column of prices then
 * aligns on nothing), 10px type, and an empty state that was a 40px icon at 30%
 * opacity over the word "No orders found". One surface written in a different
 * dialect is worse than a portal written badly throughout, because it announces
 * that the system is not actually a system.
 *
 * It is now the same object as the catalog ledger: the same <LedgerTable>, the
 * same recessed filter well, the same raised bulk bar, the same <ActionReport>
 * and the same always-present 3px commit rule that only ever changes colour.
 */
export function OrdersTable({ rows, total }: { rows: OrderRow[]; total: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  /**
   * WHICH advance is in flight, not merely that one is. Three buttons showing a
   * spinner at once cannot tell the seller whether they pressed Shipped or
   * Delivered, which is the only thing worth knowing while they wait.
   */
  const [pending, setPending] = React.useState<null | "PROCESSING" | "SHIPPED" | "DELIVERED">(null);
  const [report, setReport] = React.useState<ActionReportData | null>(null);
  /**
   * The rows this seller's last advance actually moved, so the commit rule marks
   * them in place. After pressing "Mark shipped" on twelve orders the real
   * question is not "did it work" but "which of these did it do", and a count in
   * a toast cannot answer that.
   */
  const [committedIds, setCommittedIds] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return rows;
    return rows.filter(
      (row) =>
        row.orderNumber.toLowerCase().includes(needle) ||
        row.buyer.toLowerCase().includes(needle) ||
        row.company.toLowerCase().includes(needle),
    );
  }, [rows, query]);

  // "Select all" means the rows on screen and nothing else — it never reaches
  // orders the search box is hiding.
  const visibleIds = React.useMemo(() => visible.map((row) => row.id), [visible]);
  const visibleIdSet = React.useMemo(() => new Set(visibleIds), [visibleIds]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleAllVisible = () =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });

  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedRows = rows.filter((row) => selected.has(row.id));
  /**
   * A selection survives typing in the search box, because throwing away a
   * seller's work every keystroke is worse than the problem it solves. What must
   * not survive is the SURPRISE: the action advances every selected order,
   * including ones the search is hiding, so the bar says how many of them are
   * off screen rather than letting a count of 20 quietly move rows nobody sees.
   */
  const hiddenSelectedCount = selectedRows.filter((row) => !visibleIdSet.has(row.id)).length;

  async function advance(status: "PROCESSING" | "SHIPPED" | "DELIVERED") {
    const requested = [...selected];
    setPending(status);
    let res: Awaited<ReturnType<typeof bulkUpdateOrderStatus>>;
    try {
      res = await bulkUpdateOrderStatus(requested, status);
    } catch {
      setPending(null);
      // Deliberately NOT "nothing was changed": a request that never came back
      // may still have committed on the platform, and asserting otherwise would
      // be a claim this page cannot stand behind. State what is actually known —
      // that no answer arrived — and send the seller to the record.
      toast({
        title: "No answer came back",
        description:
          "The platform did not confirm this update, so what it did is not known here. Reload the list to see your orders as they now stand.",
        variant: "error",
      });
      return;
    }
    setPending(null);
    setSelected(new Set());

    const label = orderStatusMeta(status).label.toLowerCase();
    /**
     * The action returns a COUNT and nothing else: it skips an order whose lines
     * cannot legally advance and does not report which. So the rows are marked
     * only when the count reconciles with what was asked for — otherwise the
     * commit rule would point at orders the platform may not have touched, and a
     * mark that is sometimes wrong is worse than no mark at all.
     */
    const reconciles = res.count === requested.length;
    setCommittedIds(reconciles ? new Set(requested) : new Set());

    setReport({
      tone: res.count === 0 ? "danger" : reconciles ? "success" : "warning",
      headline: `${res.count} order${res.count === 1 ? "" : "s"} moved to ${label}`,
      dateline: `Counted from the ${requested.length} order${requested.length === 1 ? "" : "s"} selected, as the platform answered`,
      lines: [],
      ...(reconciles
        ? {}
        : {
            // Named honestly, because the action does not say WHICH it refused.
            note: `${requested.length - res.count} of the ${requested.length} selected order${requested.length === 1 ? " was" : "s were"} not advanced. An order is skipped when its lines are not at a stage this move is allowed from — the platform does not report which, so none are marked in the table below. Reload to see your orders as they now stand.`,
          }),
    });

    router.refresh();
  }

  const columns: LedgerColumn<OrderRow>[] = [
    {
      key: "order",
      label: "Order",
      width: "30%",
      render: (row) => (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            aria-label={`Select order ${row.orderNumber}`}
            checked={selected.has(row.id)}
            onChange={() => toggle(row.id)}
            className="u-focus h-4 w-4 shrink-0 rounded-sm border-border accent-primary"
          />
          <div className="min-w-0">
            {/* Mono is for the reference, never for the money beside it. */}
            <Link
              href={`/orders/${row.id}`}
              className="u-mono u-focus rounded-nested text-meta font-medium text-primary-ink hover:underline"
            >
              {row.orderNumber}
            </Link>
            <p className="truncate font-medium text-ink-1">{row.buyer || "—"}</p>
            {row.company && <p className="u-meta truncate text-ink-3">{row.company}</p>}
          </div>
        </div>
      ),
    },
    { key: "date", label: "Placed", hideOnMobile: true, render: (row) => <span className="u-meta text-ink-2">{row.date}</span> },
    { key: "itemCount", label: "Lines", numeric: true, hideOnMobile: true },
    { key: "total", label: "Your share", numeric: true, render: (row) => money(row.total, row.currency) },
    {
      key: "type",
      label: "Channel",
      hideOnMobile: true,
      render: (row) => <StatusPill tone={orderChannelTone(row.type)}>{row.type}</StatusPill>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const meta = orderStatusMeta(row.status);
        return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>;
      },
    },
    {
      key: "view",
      label: "",
      align: "end",
      render: (row) => (
        <Button variant="link" size="sm" asChild>
          <Link href={`/orders/${row.id}`}>
            View<span className="sr-only"> order {row.orderNumber}</span>
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {report && (
        <ActionReport
          report={report}
          linkComponent={Link}
          onDismiss={() => {
            setReport(null);
            setCommittedIds(new Set());
          }}
        />
      )}

      {/* Recessed, because a search-and-select bar is input and context — never
          the object being read. Everything that changes what the table SHOWS is
          in here, and nothing that changes an order is. */}
      <FieldWell className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[14rem] flex-1">
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search order number, buyer or company"
              aria-label="Search these orders by order number, buyer or company"
              startIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="ms-auto"
            onClick={() =>
              exportCsv(
                selected.size > 0 ? selectedRows : visible,
                `orders-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export {selected.size > 0 ? `${selected.size} selected` : "these rows"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-ui text-ink-2">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              disabled={visibleIds.length === 0}
              className="u-focus h-4 w-4 rounded-sm border-border accent-primary"
            />
            Select all {visibleIds.length} shown
          </label>
          <Divider orientation="vertical" className="h-5" />
          <span className="u-meta text-ink-3">
            {visible.length === rows.length
              ? `${rows.length} of ${total} on this account`
              : `${visible.length} of ${rows.length} loaded rows match`}
          </span>
        </div>
      </FieldWell>

      <LedgerTable
        columns={columns}
        rows={visible}
        getRowKey={(row) => row.id}
        density="compact"
        dateline="Orders containing your lines, newest first · every total is your lines only, in the order's own currency, with no conversion applied"
        footer={
          visible.length === rows.length
            ? `${rows.length} order${rows.length === 1 ? "" : "s"} shown of ${total} on this account`
            : `${visible.length} of ${rows.length} loaded order${rows.length === 1 ? "" : "s"} match this search`
        }
        rowProps={(row) => ({
          // The rule is always present and only its colour changes, so marking a
          // row after an advance reflows nothing.
          className: cn(
            "u-commit",
            // Repeated on the selected state on purpose: the ledger row's own
            // :hover rule would otherwise out-specify the selection tint and a
            // hovered selected row would look unselected.
            selected.has(row.id) && "bg-primary-soft hover:bg-primary-soft",
          ),
          ...(committedIds.has(row.id) ? { "data-commit": "committed" } : {}),
        })}
        empty={
          rows.length === 0 ? (
            <EmptyState
              variant="certificate"
              eyebrow="Nothing recorded"
              headline="No buyer has ordered from you yet."
              body="An order appears here the moment one of your lines is bought, whichever channel it comes through. Nothing is pending review and nothing is being withheld — the ledger is simply empty."
              action={
                <Button variant="primary" size="sm" asChild>
                  <Link href="/products">Review your listings</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              eyebrow="No match"
              headline="No order on this page matches that search."
              body={`${rows.length} order${rows.length === 1 ? " is" : "s are"} loaded — clear the search to see them.`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                  Clear the search
                </Button>
              }
            />
          )
        }
      />

      {/* The bulk bar. Raised and OPAQUE rather than glass: body text and three
          commit actions live on it, and law 5 does not allow that contrast to
          depend on whatever happens to be scrolled behind it. */}
      {selected.size > 0 && (
        <Surface
          rung={4}
          role="group"
          aria-label="Actions for the selected orders"
          className="sticky bottom-4 z-sticky flex flex-wrap items-center gap-2 p-3"
        >
          <div className="min-w-0">
            <span className="u-ui font-medium text-ink-1">
              <span className="fig">{selected.size}</span> selected
            </span>
            {hiddenSelectedCount > 0 && (
              // A count larger than what is on screen has to say so BEFORE it is
              // acted on, not after.
              <p className="u-meta text-ink-2">
                <span className="fig">{hiddenSelectedCount}</span> of them{" "}
                {hiddenSelectedCount === 1 ? "is" : "are"} hidden by the current search and will still be advanced.
              </p>
            )}
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {ADVANCE.map(({ status, label, icon: Icon }) => (
              <Button
                key={status}
                variant="secondary"
                size="sm"
                disabled={pending !== null}
                loading={pending === status}
                onClick={() => advance(status)}
              >
                {pending !== status && <Icon className="h-3.5 w-3.5" aria-hidden="true" />} {label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="icon"
              disabled={pending !== null}
              onClick={() => setSelected(new Set())}
              aria-label="Clear the selection"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Dateline className="w-full">
            An advance moves only your own lines on each order; the order's overall status is derived from every
            seller on it. An order whose lines are not at a stage the move is allowed from is skipped and reported
            back rather than forced.
          </Dateline>
        </Surface>
      )}
    </div>
  );
}
