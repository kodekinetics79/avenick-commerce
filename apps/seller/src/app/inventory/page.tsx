import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSellerAnyPermission } from "@/lib/auth";
import { getSellerInventory } from "@avenick/database";
import { cn } from "@avenick/utils";
import { SellerLayout } from "@/components/layout/seller-layout";
import {
  AvailabilityDot,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  ImageFrame,
  LedgerTable,
  PageHeader,
  Stat,
  StatusPill,
  Surface,
  type LedgerColumn,
} from "@avenick/ui";

const PAGE_LIMIT = 100;

type StockRow = Awaited<ReturnType<typeof getSellerInventory>>[number];

export default async function InventoryPage() {
  const t = await getTranslations("sellerCatalog");
  const { seller, membership } = await requireSellerAnyPermission(["inventory.view", "inventory.manage"]);
  const stocks = await getSellerInventory(seller.id, { limit: PAGE_LIMIT });

  const outCount = stocks.filter((s) => s.isOut).length;
  // isLow is inclusive of isOut, so the two figures below are made disjoint —
  // otherwise the same row would be counted twice in one band.
  const lowCount = stocks.filter((s) => s.isLow && !s.isOut).length;

  const columns: LedgerColumn<StockRow>[] = [
    {
      key: "product",
      label: t("inventory.columns.product"),
      width: "32%",
      render: (row) => (
        <div className="flex items-center gap-3">
          {/* THE FRAME. Every product image in all three portals goes through
              <ImageFrame>: contained rather than cropped (cover crops the valve
              off a fitting and the label off a drum), inset off its own edge, on
              the same lit plate with the same cast floor under it. It keeps the
              plain-<img> decision this cell already carried — ImageFrame renders
              one, because next/image's optimizer throws for any host outside
              next.config's remotePatterns and one bad row would take the whole
              page down rather than one thumbnail — and it replaces the em dash
              with the system's designed no-image state, which occupies the
              identical box so a column mixing presence and absence stays
              straight. */}
          <ImageFrame
            src={row.product?.images[0]?.url ?? null}
            alt={row.product?.images[0] ? (row.product?.nameEn ?? "") : ""}
            state={row.isOut ? "out" : "available"}
            className="h-9 w-9 shrink-0 rounded-nested"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink-1">{row.product?.nameEn}</p>
            <p className="truncate u-mono text-meta text-ink-3">{row.product?.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: "location",
      label: t("inventory.columns.warehouse"),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-ink-2">
          {row.location.warehouse.nameEn}
          <span className="u-mono ms-1.5 text-meta text-ink-3">{row.location.code}</span>
        </span>
      ),
    },
    { key: "qty", label: t("inventory.columns.onHand"), numeric: true },
    {
      key: "reservedQty",
      label: t("inventory.columns.reserved"),
      numeric: true,
      render: (row) => <span className="text-ink-2">{row.reservedQty}</span>,
    },
    {
      key: "available",
      label: t("inventory.columns.available"),
      numeric: true,
      // The lamp is <AvailabilityDot> — the same 6px dot with a 3px ring that a
      // buyer sees on the storefront and an operator sees in the admin stock
      // console. One stock language across three portals is the cheapest
      // coherence there is, and the figure itself is the label, so colour is
      // never the only channel carrying the state.
      render: (row) => (
        // Two states, not three: UNCONFIRMED means "the platform does not know",
        // and a row at its reorder point is a row the platform knows precisely.
        // "Low" is a different axis and the Status column already carries it, so
        // the lamp answers availability and the ink answers urgency.
        <AvailabilityDot
          state={row.isOut ? "OUT_OF_STOCK" : "IN_STOCK"}
          label={String(row.available)}
          // text-ui because the dot's own type is `u-meta`: without it the one
          // figure a supplier scans this table for renders a rank below every
          // other numeric cell in the same row.
          className={cn(
            "text-ui",
            row.isOut ? "text-danger-ink" : row.isLow ? "text-warning-ink" : "text-ink-1",
          )}
        />
      ),
    },
    {
      key: "reorderPoint",
      label: t("inventory.columns.reorderAt"),
      numeric: true,
      hideOnMobile: true,
      render: (row) => <span className="text-ink-3">{row.reorderPoint}</span>,
    },
    {
      key: "status",
      label: t("inventory.columns.status"),
      align: "end",
      render: (row) => (
        <StatusPill tone={row.isOut ? "danger" : row.isLow ? "warning" : "neutral"}>
          {row.isOut ? t("inventory.state.out") : row.isLow ? t("inventory.state.atReorder") : t("inventory.state.in")}
        </StatusPill>
      ),
    },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-4">
        <PageHeader
          eyebrow={t("inventory.eyebrow")}
          // The Arabic gloss this title used to carry was decoration, not
          // localisation: an Arabic word set in the Latin display face at the
          // heading's negative tracking pulls the letterforms apart at their
          // joins. Now the title IS the locale's own word, set in the Arabic
          // display face the layout loads for the Arabic build.
          title={t("inventory.title")}
          linkComponent={Link}
          // The row ceiling is a disclosure, not decoration: it says the page is
          // showing a bounded read.
          dateline={t("inventory.dateline", { limit: String(PAGE_LIMIT) })}
        />

        {stocks.length > 0 && (
          <CellGrid cols={{ base: 1, sm: 3 }}>
            <Stat
              label={t("inventory.stats.out.label")}
              value={outCount}
              rank="section"
              chip={outCount > 0 ? "danger" : undefined}
              note={t("inventory.stats.out.note")}
            />
            <Stat
              label={t("inventory.stats.atReorder.label")}
              value={lowCount}
              rank="section"
              chip={lowCount > 0 ? "warning" : undefined}
              note={t("inventory.stats.atReorder.note")}
            />
            <Stat
              label={t("inventory.stats.rowsShown.label")}
              value={stocks.length}
              rank="section"
              note={t("inventory.stats.rowsShown.note")}
            />
          </CellGrid>
        )}

        {outCount + lowCount > 0 && (
          // The band takes the tone of the worst thing in it: a row with nothing
          // available to promise is a refused order, not a warning, and washing
          // it amber would make it read as the same severity as a reorder point.
          <Surface rung={1} tone={outCount > 0 ? "danger" : "warning"} className="p-4">
            <Eyebrow className="mb-1">{t("inventory.replenish.eyebrow")}</Eyebrow>
            <p className="u-body text-ink-1">
              {outCount > 0 && `${t("inventory.replenish.out", { count: outCount, n: String(outCount) })} `}
              {lowCount > 0 && t("inventory.replenish.atReorder", { count: lowCount, n: String(lowCount) })}
            </p>
            <Dateline className="mt-1">{t("inventory.replenish.dateline")}</Dateline>
          </Surface>
        )}

        <LedgerTable
          columns={columns}
          rows={stocks}
          getRowKey={(row) => row.id}
          density="compact"
          rowProps={(row) => ({
            // The rule is always 3px and always present; only its colour changes,
            // so a row at its reorder point is legible down the edge of the table
            // without anything reflowing or a whole row being washed in colour.
            className: `border-s-[3px] ${row.isOut ? "border-s-danger" : row.isLow ? "border-s-warning" : "border-s-transparent"}`,
          })}
          empty={
            <EmptyState
              eyebrow={t("inventory.empty.eyebrow")}
              headline={t("inventory.empty.headline")}
              body={t("inventory.empty.body")}
            />
          }
          footer={
            // The capped case is a disclosure that rows exist which this page
            // is not showing; it must read as plainly in Arabic as in English.
            stocks.length === PAGE_LIMIT
              ? t("inventory.footerCapped", { limit: String(PAGE_LIMIT) })
              : t("inventory.footerCount", { count: stocks.length, n: String(stocks.length) })
          }
        />
      </div>
    </SellerLayout>
  );
}
