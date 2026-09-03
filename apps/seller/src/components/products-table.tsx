"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Download, EyeOff, Package, Search, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, formatCurrency, isSupportedCurrency } from "@avenick/utils";
import { platformName } from "@avenick/utils/portal-config";
import {
  AvailabilityDot,
  Button,
  Dateline,
  Divider,
  EmptyState,
  FieldWell,
  ImageFrame,
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
  const t = useTranslations("sellerCatalog");
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

  // The enum keys are the platform's; only the sentences beside them are
  // translated. The platform name stays an interpolation value so it is never
  // frozen into a message.
  const SKIP_LABELS: Record<BulkStatusSkipReason, string> = {
    NOT_APPROVED_YET: t("skip.NOT_APPROVED_YET"),
    PLATFORM_SUPPRESSED: t("skip.PLATFORM_SUPPRESSED", { platform: platformName() }),
    ALREADY_IN_STATUS: t("skip.ALREADY_IN_STATUS"),
    NOT_PAUSABLE: t("skip.NOT_PAUSABLE"),
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
        title: t("bulk.noAnswer.title"),
        description: t("bulk.noAnswer.description"),
        variant: "error",
      });
      return;
    }
    setPending(null);
    setSelected(new Set());

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
      // Two keys rather than one with an interpolated verb: "resumed" and
      // "paused" inflect with the noun in Arabic, so the whole sentence has to
      // be written per outcome.
      headline: t(status === "ACTIVE" ? "bulk.report.resumed" : "bulk.report.paused", {
        count: res.count,
        n: String(res.count),
      }),
      dateline: t("bulk.report.dateline", { count: requested.length, n: String(requested.length) }),
      linesTitle: t("bulk.report.notChanged"),
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
            note: t("bulk.report.unreconciled", {
              changeCount: res.count,
              changes: String(res.count),
              listingCount: presumedChanged.length,
              listings: String(presumedChanged.length),
            }),
          }),
    });

    router.refresh();
  }

  const columns: LedgerColumn<ProductRow>[] = [
    {
      key: "product",
      label: t("table.columns.product"),
      width: "34%",
      render: (row) => (
        <div className="flex items-center gap-3">
          {canManage && (
            <input
              type="checkbox"
              aria-label={t("table.selectRow", { name: row.nameEn })}
              checked={selected.has(row.id)}
              onChange={() => toggle(row.id)}
              className="u-focus h-4 w-4 shrink-0 rounded-sm border-border accent-primary"
            />
          )}
          {/* THE FRAME. Every product image in all three portals goes through
              <ImageFrame>: contained rather than cropped, inset off its own edge,
              on the same lit plate with the same cast floor under it. This cell
              was the last `object-cover` in the seller portal — cover on a square
              crops the valve off a fitting and the label off a drum, and one
              frame with cover in a column of forty with contain announces that
              the system is not actually a system.

              It also keeps the plain-<img> decision that was here before, because
              ImageFrame renders one: next/image's optimizer throws for any host
              outside next.config remotePatterns, and one bad row would take the
              whole list down rather than just that thumbnail. The no-image state
              is now designed — the same plate and floor, with the SKU in mono —
              rather than an em dash, and it occupies the identical box so a list
              mixing presence and absence has no ragged column. */}
          <ImageFrame
            src={row.imageUrl}
            alt={row.imageUrl ? row.nameEn : ""}
            state={row.available <= 0 ? "out" : "available"}
            className="h-9 w-9 shrink-0 rounded-nested"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink-1">{row.nameEn}</p>
            {row.nameAr && <p className="truncate text-meta text-ink-3">{row.nameAr}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "sku",
      label: t("table.columns.sku"),
      hideOnMobile: true,
      render: (row) => <span className="u-mono text-meta text-ink-2">{row.sku}</span>,
    },
    {
      key: "status",
      label: t("table.columns.status"),
      render: (row) => {
        const meta = statusMeta(row.status);
        // statusMeta hands back a key, not a word: a status nobody has labelled
        // yet still shows the raw state rather than disappearing.
        return <StatusPill tone={meta.tone}>{meta.labelKey ? t(meta.labelKey) : meta.fallbackLabel}</StatusPill>;
      },
    },
    {
      key: "health",
      label: t("table.columns.health"),
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
      label: t("table.columns.available"),
      numeric: true,
      // Zero is a fact; anything above it is not called "low" here, because the
      // reorder point that would decide that lives per warehouse location and
      // this page does not read it.
      //
      // The lamp is <AvailabilityDot> — the SAME dot a buyer sees on the
      // storefront and an operator sees in the admin stock console. Colour is
      // never the only channel: the figure is the label, so a reader who cannot
      // separate the two hues still reads the number. One stock language across
      // three portals is the cheapest coherence there is.
      render: (row) => (
        <AvailabilityDot
          state={row.available <= 0 ? "OUT_OF_STOCK" : "IN_STOCK"}
          // The figure IS the label. The lamp adds the state without a second
          // string, and the accessible name a screen reader gets is the column
          // head plus the number, which is exactly what the sighted reader gets.
          label={String(row.available)}
          // The dot's own type is `u-meta text-ink-2` — correct beside a word,
          // wrong for a figure in a ledger cell, which every other numeric column
          // sets at the row's ui rank in ink-1. Left as it comes, the one number
          // a supplier scans this table FOR would be the smallest and palest
          // thing in the row. text-ui restores the cell's own rank (Tailwind's
          // utilities are emitted after the system sheet, so it wins over
          // .u-meta); the ink stays semantic.
          className={cn("text-ui", row.available <= 0 ? "text-danger-ink" : "text-ink-1")}
        />
      ),
    },
    {
      key: "price",
      label: t("table.columns.price"),
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
      label: t("table.columns.issues"),
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
              {t("table.openIssues", { count: row.issueCount, name: row.nameEn })}
            </span>
          </Link>
        ) : (
          <span className="text-ink-3">{t("table.noIssues")}</span>
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
              {t("table.edit")}<span className="sr-only"> {row.nameEn}</span>
            </Link>
          </Button>
        ) : (
          <span className="text-meta text-ink-3">{t("table.viewOnly")}</span>
        ),
    },
  ];

  const filters: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "all", label: t("filters.all"), count: rows.length },
    ...STATUS_ORDER.filter((status) => (counts.byStatus.get(status) ?? 0) > 0).map((status) => {
      const meta = statusMeta(status);
      return {
        key: status as FilterKey,
        label: meta.labelKey ? t(meta.labelKey) : meta.fallbackLabel,
        count: counts.byStatus.get(status) ?? 0,
      };
    }),
    ...(counts.attention > 0
      ? [{ key: ATTENTION as FilterKey, label: t("filters.needsAttention"), count: counts.attention }]
      : []),
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
              placeholder={t("toolbar.searchPlaceholder")}
              aria-label={t("toolbar.searchLabel")}
              startIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
          </div>
          <div className="flex items-center gap-2 ms-auto">
            {canManage && (
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-3.5 w-3.5" aria-hidden="true" /> {t("toolbar.importCsv")}
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
              {selected.size > 0
                ? t("toolbar.exportSelected", { count: selected.size, n: String(selected.size) })
                : t("toolbar.exportRows")}
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
                {t("toolbar.selectAllShown", { count: visibleIds.length, n: String(visibleIds.length) })}
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
                    // .u-state-wash is the system's oklab state layer for a
                    // surface you do NOT own — it mixes into whatever is behind
                    // it and inverts with the theme in one token, which is what
                    // the forty hand-tuned hover values it replaces never did.
                    : "u-state-wash border border-transparent text-ink-2 hover:text-ink-1",
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
        dateline={t("table.dateline")}
        footer={
          visible.length === rows.length
            ? t("table.footerAll", { count: rows.length, n: String(rows.length) })
            : t("table.footerFiltered", {
                count: rows.length,
                shown: String(visible.length),
                n: String(rows.length),
              })
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
            /* THE CERTIFICATE. The primary empty region of a page gets the
               composed plate — brass rule, ruled ground, cropped mark, one real
               action — because in a product that may not invent data an honest
               empty surface has to read as deliberate. A member who cannot manage
               the catalog has nothing to do here, so they get the plain editorial
               blank instead: the certificate variant requires an action, and an
               action they are not permitted is a dead end wearing a button. */
            canManage ? (
              <EmptyState
                variant="certificate"
                glyph={<Package />}
                eyebrow={t("empty.eyebrow")}
                headline={t("empty.headline")}
                body={t("empty.body")}
                action={
                  <Button variant="primary" size="sm" asChild>
                    <Link href="/products/new">{t("empty.action")}</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                eyebrow={t("empty.eyebrow")}
                headline={t("empty.headline")}
                body={t("empty.readOnlyBody")}
              />
            )
          ) : (
            <EmptyState
              eyebrow={t("noMatch.eyebrow")}
              headline={t("noMatch.headline")}
              body={t("noMatch.body", { count: rows.length, n: String(rows.length) })}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                >
                  {t("noMatch.action")}
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
          aria-label={t("bulk.barLabel")}
          className="sticky bottom-4 z-sticky flex flex-wrap items-center gap-2 p-3"
        >
          <div className="min-w-0">
            <span className="u-ui font-medium text-ink-1">
              {t.rich("bulk.selectedCount", {
                count: selected.size,
                n: String(selected.size),
                fig: (chunks) => <span className="fig">{chunks}</span>,
              })}
            </span>
            {hiddenSelectedCount > 0 && (
              // A count that is larger than what is on screen has to say so
              // before it is acted on, not after.
              <p className="u-meta text-ink-2">
                {t.rich("bulk.hiddenBySelection", {
                  count: hiddenSelectedCount,
                  n: String(hiddenSelectedCount),
                  fig: (chunks) => <span className="fig">{chunks}</span>,
                })}
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
              {pending !== "ACTIVE" && <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />} {t("bulk.resume")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending !== null}
              loading={pending === "INACTIVE"}
              onClick={() => bulk("INACTIVE")}
            >
              {pending !== "INACTIVE" && <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />} {t("bulk.pause")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending !== null}
              onClick={() => setSelected(new Set())}
              aria-label={t("bulk.clearSelection")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Dateline className="w-full">{t("bulk.dateline")}</Dateline>
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
