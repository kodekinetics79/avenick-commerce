"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Download, EyeOff, Search, Upload, X } from "lucide-react";
import { formatCurrency, isSupportedCurrency } from "@avenick/utils";
import { platformName } from "@avenick/utils/portal-config";
import {
  Button,
  Dateline,
  Divider,
  EmptyState,
  FieldWell,
  Input,
  LedgerTable,
  Meter,
  StatusPill,
  Surface,
  type LedgerColumn,
} from "@avenick/ui";
import { useToast } from "@/components/toast";
import { bulkUpdateProductStatus, type BulkStatusSkipReason } from "@/app/products/actions";
import { ActionReport, type ActionReportData } from "@/components/products/action-report";
import { ImportLayer } from "@/components/products/import-layer";
import { buildProductCsv, downloadCsv } from "@/components/products/csv";
import { STATUS_ORDER, statusMeta } from "@/components/products/status-meta";

export type ProductRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  sku: string;
  status: string;
  listingHealth: number;
  available: number;
  price: number | null;
  currency: string | null;
  issueCount: number;
  imageUrl: string | null;
};

/**
 * Listing health is a 0–100 score. Colour appears only where something is worth
 * acting on: a healthy listing gets a neutral bar, because forty coloured bars
 * down a column is a rainbow that tells the supplier nothing.
 */
function healthTone(score: number): "neutral" | "warning" | "danger" {
  if (score >= 80) return "neutral";
  if (score >= 60) return "warning";
  return "danger";
}

/** "all", a ProductStatus, or the derived "needs attention" bucket. */
type FilterKey = string;

const ATTENTION = "__attention" as const;

export function ProductsTable({ rows, canManage }: { rows: ProductRow[]; canManage: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  /**
   * Which bulk move is in flight, not merely that one is. Both buttons showing a
   * spinner at once cannot tell the seller whether they pressed Resume or Pause,
   * which is the only thing worth knowing while they wait.
   */
  const [pending, setPending] = React.useState<null | "ACTIVE" | "INACTIVE">(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [report, setReport] = React.useState<ActionReportData | null>(null);
  /**
   * The rows this seller's last bulk action actually moved, so the commit rule
   * marks them in place. In a long list the real question after clicking Pause
   * is not "did it work" but "which of these did it do", and a count in a toast
   * cannot answer that.
   */
  const [committedIds, setCommittedIds] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");

  const needsAttention = React.useCallback(
    (row: ProductRow) => row.issueCount > 0 || row.available <= 0,
    [],
  );

  // Counts are read off the rows the page loaded, so a chip can never claim a
  // total the table cannot show.
  const counts = React.useMemo(() => {
    const byStatus = new Map<string, number>();
    let attention = 0;
    for (const row of rows) {
      byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
      if (needsAttention(row)) attention++;
    }
    return { byStatus, attention };
  }, [rows, needsAttention]);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === ATTENTION ? !needsAttention(row) : filter !== "all" && row.status !== filter) return false;
      if (needle === "") return true;
      return (
        row.nameEn.toLowerCase().includes(needle) ||
        row.nameAr.toLowerCase().includes(needle) ||
        row.sku.toLowerCase().includes(needle)
      );
    });
  }, [rows, query, filter, needsAttention]);

  // "Select all" means all the rows on screen and nothing else — it never
  // reaches listings the current filter is hiding.
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
   * A selection survives a change of filter, because throwing away a seller's
   * work every time they type in the search box would be worse than the problem
   * it solves. What must not survive is the SURPRISE: a bulk action acts on
   * every selected listing, including ones the current filter is hiding, so the
   * bar below says how many of them are off screen rather than letting a count
   * of 20 quietly move rows the seller cannot see.
   */
  const hiddenSelectedCount = selectedRows.filter((row) => !visibleIdSet.has(row.id)).length;

  const SKIP_LABELS: Record<BulkStatusSkipReason, string> = {
    NOT_APPROVED_YET: "not yet approved — submit it for review from the product form",
    PLATFORM_SUPPRESSED: `suppressed or suspended by ${platformName()} — contact support`,
    ALREADY_IN_STATUS: "already in that status",
    NOT_PAUSABLE: "not live, so there is nothing to pause",
  };

  async function bulk(status: "ACTIVE" | "INACTIVE") {
    const requested = [...selected];
    setPending(status);
    let res: Awaited<ReturnType<typeof bulkUpdateProductStatus>>;
    try {
      res = await bulkUpdateProductStatus(requested, status);
    } catch {
      setPending(null);
      // Deliberately not "nothing was changed": a request that never came back
      // may still have committed on the platform, and asserting otherwise would
      // be a claim this page cannot stand behind. Say what is actually known —
      // that no answer arrived — and send the seller to the record.
      toast({
        title: "No answer came back",
        description: "The platform did not confirm this update, so what it did is not known here. Reload the list to see the catalog as it now stands.",
        variant: "error",
      });
      return;
    }
    setPending(null);
    setSelected(new Set());

    const verb = status === "ACTIVE" ? "resumed" : "paused";
    const skippedIds = new Set(res.skipped.map((entry) => entry.id));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const presumedChanged = requested.filter((id) => !skippedIds.has(id));

    /**
     * The action reports how many rows it changed and which it refused, but not
     * which ones it changed: an id that no longer belongs to this seller is
     * dropped before either tally. The rows are only marked when those two
     * numbers reconcile, so the commit rule can never point at a listing the
     * platform did not actually touch.
     */
    const reconciles = res.count === presumedChanged.length;
    setCommittedIds(reconciles ? new Set(presumedChanged) : new Set());

    setReport({
      tone: res.count === 0 ? "danger" : res.skipped.length > 0 ? "warning" : "success",
      headline: `${res.count} listing${res.count === 1 ? "" : "s"} ${verb}`,
      dateline: `Counted from the ${requested.length} listing${requested.length === 1 ? "" : "s"} selected, as the platform answered`,
      linesTitle: "Not changed",
      lines: res.skipped.map((entry) => {
        const row = byId.get(entry.id);
        return {
          key: entry.id,
          label: row?.sku ?? entry.id,
          detail: `${row ? `${row.nameEn} — ` : ""}${SKIP_LABELS[entry.reason]}`,
          ...(canManage ? { href: `/products/${entry.id}/edit` } : {}),
        };
      }),
      ...(reconciles
        ? {}
        : {
            note: `The platform reported ${res.count} change${res.count === 1 ? "" : "s"} for ${presumedChanged.length} listing${presumedChanged.length === 1 ? "" : "s"} it did not refuse, so none are marked in the table below. Refresh to see the catalog as it now stands.`,
          }),
    });

    router.refresh();
  }

  const columns: LedgerColumn<ProductRow>[] = [
    {
      key: "product",
      label: "Product",
      width: "34%",
      render: (row) => (
        <div className="flex items-center gap-3">
          {canManage && (
            <input
              type="checkbox"
              aria-label={`Select ${row.nameEn}`}
              checked={selected.has(row.id)}
              onChange={() => toggle(row.id)}
              className="u-focus h-4 w-4 shrink-0 rounded-sm border-border accent-primary"
            />
          )}
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-nested bg-surface-1">
            {row.imageUrl ? (
              // Plain <img>, not next/image: the optimizer throws for any host outside
              // next.config remotePatterns, and uploaded product images live on the object-
              // storage host, which is not listed there. One such row would take the whole
              // list down instead of just that thumbnail.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.imageUrl} alt="" width={36} height={36} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              // Decorative: the listing's missing image is already reported as an
              // issue, so this placeholder says nothing a screen reader needs.
              <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-meta text-ink-3">
                —
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink-1">{row.nameEn}</p>
            {row.nameAr && <p className="truncate text-meta text-ink-3">{row.nameAr}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "sku",
      label: "SKU",
      hideOnMobile: true,
      render: (row) => <span className="u-mono text-meta text-ink-2">{row.sku}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const meta = statusMeta(row.status);
        return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>;
      },
    },
    {
      key: "health",
      label: "Listing health",
      width: "140px",
      hideOnMobile: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          {/* The bar is the same fact as the figure beside it, drawn. Announcing
              both would read the score twice on every one of forty rows, so the
              graphic is hidden and the number — which the column head already
              names — is what assistive technology gets. */}
          <Meter
            aria-hidden="true"
            value={row.listingHealth}
            tone={healthTone(row.listingHealth)}
            size="sm"
            className="w-16"
          />
          <span className="fig text-meta text-ink-2">{row.listingHealth}</span>
        </div>
      ),
    },
    {
      key: "available",
      label: "Available",
      numeric: true,
      render: (row) =>
        // Zero is a fact; anything above it is not called "low" here, because
        // the reorder point that would decide that lives per warehouse location
        // and this page does not read it.
        row.available <= 0 ? (
          <span className="text-danger-ink">{row.available}</span>
        ) : (
          <span>{row.available}</span>
        ),
    },
    {
      key: "price",
      label: "Price",
      numeric: true,
      render: (row) =>
        row.price != null && row.currency && isSupportedCurrency(row.currency) ? (
          formatCurrency(row.price, row.currency)
        ) : row.price != null && row.currency ? (
          // A currency with no formatting config is shown with its raw code
          // rather than another currency's symbol.
          `${row.currency} ${row.price}`
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: "issues",
      label: "Issues",
      numeric: true,
      render: (row) =>
        row.issueCount > 0 ? (
          <Link
            href="/issues"
            className="u-focus inline-flex items-center gap-1 rounded-nested text-danger-ink hover:underline"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {row.issueCount}
            <span className="sr-only">
              open issue{row.issueCount === 1 ? "" : "s"} on {row.nameEn}
            </span>
          </Link>
        ) : (
          <span className="text-ink-3">None</span>
        ),
    },
    {
      key: "edit",
      label: "",
      align: "end",
      render: (row) =>
        canManage ? (
          <Button variant="link" size="sm" asChild>
            <Link href={`/products/${row.id}/edit`}>
              Edit<span className="sr-only"> {row.nameEn}</span>
            </Link>
          </Button>
        ) : (
          <span className="text-meta text-ink-3">View only</span>
        ),
    },
  ];

  const filters: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "all", label: "All", count: rows.length },
    ...STATUS_ORDER.filter((status) => (counts.byStatus.get(status) ?? 0) > 0).map((status) => ({
      key: status as FilterKey,
      label: statusMeta(status).label,
      count: counts.byStatus.get(status) ?? 0,
    })),
    ...(counts.attention > 0 ? [{ key: ATTENTION as FilterKey, label: "Needs attention", count: counts.attention }] : []),
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

      {/* Recessed, because a filter bar is input and context — never the object
          being read. Everything that changes what the table shows is in here,
          and nothing that changes a listing is. */}
      <FieldWell className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[14rem] flex-1">
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or SKU"
              aria-label="Search this catalog by product name or SKU"
              startIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
          </div>
          <div className="flex items-center gap-2 ms-auto">
            {canManage && (
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-3.5 w-3.5" aria-hidden="true" /> Import CSV
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadCsv(
                  buildProductCsv(selected.size > 0 ? selectedRows : visible),
                  `products-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export {selected.size > 0 ? `${selected.size} selected` : "these rows"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
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
            </>
          )}
          {filters.map((entry) => {
            const active = filter === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(entry.key)}
                // The selected filter is the one that is RAISED. Depth carries
                // the state, so the row of chips needs no colour at all.
                className={[
                  "u-focus inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-meta",
                  "transition-[background-color,border-color,color,box-shadow] duration-hover ease-standard",
                  active
                    ? "border border-border-strong bg-surface-2 text-ink-1 shadow-elev-2"
                    : "border border-transparent text-ink-2 hover:text-ink-1",
                ].join(" ")}
              >
                {entry.label}
                <span className="fig text-ink-3">{entry.count}</span>
              </button>
            );
          })}
        </div>
      </FieldWell>

      <LedgerTable
        columns={columns}
        rows={visible}
        getRowKey={(row) => row.id}
        density="compact"
        dateline="Your listings as recorded, most recently updated first · a deleted listing is not shown"
        footer={
          visible.length === rows.length
            ? `${rows.length} listing${rows.length === 1 ? "" : "s"}`
            : `${visible.length} of ${rows.length} listing${rows.length === 1 ? "" : "s"} shown`
        }
        rowProps={(row) => ({
          // The rule is always present and only its colour changes, so marking a
          // row after an action reflows nothing.
          className: [
            "u-commit",
            // The hover wash is repeated on the selected state on purpose: the
            // ledger row's own :hover rule would otherwise out-specify the
            // selection tint and a hovered selected row would look unselected.
            selected.has(row.id) ? "bg-primary-soft hover:bg-primary-soft" : "",
          ].filter(Boolean).join(" "),
          ...(committedIds.has(row.id) ? { "data-commit": "committed" } : {}),
        })}
        empty={
          rows.length === 0 ? (
            <EmptyState
              eyebrow="Nothing recorded"
              headline="This catalog has no listings yet."
              body="A listing you add here is saved as a draft until it has been through review."
              action={
                canManage ? (
                  <Button variant="primary" size="sm" asChild>
                    <Link href="/products/new">Add your first product</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              eyebrow="No match"
              headline="No listing in this catalog matches the current filter."
              body={`${rows.length} listing${rows.length === 1 ? " is" : "s are"} recorded — clear the filter to see them.`}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                >
                  Clear the filter
                </Button>
              }
            />
          )
        }
      />

      {/* The bulk bar. Raised and opaque rather than glass: body text and two
          commit actions live on it, and law 5 does not allow that contrast to
          depend on whatever happens to be scrolled behind it. */}
      {canManage && selected.size > 0 && (
        <Surface
          rung={4}
          role="group"
          aria-label="Actions for the selected listings"
          className="sticky bottom-4 z-sticky flex flex-wrap items-center gap-2 p-3"
        >
          <div className="min-w-0">
            <span className="u-ui font-medium text-ink-1">
              <span className="fig">{selected.size}</span> selected
            </span>
            {hiddenSelectedCount > 0 && (
              // A count that is larger than what is on screen has to say so
              // before it is acted on, not after.
              <p className="u-meta text-ink-2">
                <span className="fig">{hiddenSelectedCount}</span> of them{" "}
                {hiddenSelectedCount === 1 ? "is" : "are"} hidden by the current filter and will still be changed.
              </p>
            )}
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pending !== null}
              loading={pending === "ACTIVE"}
              onClick={() => bulk("ACTIVE")}
            >
              {pending !== "ACTIVE" && <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />} Resume
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending !== null}
              loading={pending === "INACTIVE"}
              onClick={() => bulk("INACTIVE")}
            >
              {pending !== "INACTIVE" && <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />} Pause
            </Button>
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
            Resuming and pausing obey the same rule as review: a listing the platform stopped, or one that has never been
            approved, is reported back rather than moved.
          </Dateline>
        </Surface>
      )}

      {canManage && (
        <ImportLayer
          open={importOpen}
          onOpenChange={setImportOpen}
          onComplete={(next) => {
            setReport(next);
            setCommittedIds(new Set());
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
