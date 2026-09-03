import Link from "next/link";
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
  const { seller, membership } = await requireSellerAnyPermission(["inventory.view", "inventory.manage"]);
  const stocks = await getSellerInventory(seller.id, { limit: PAGE_LIMIT });

  const outCount = stocks.filter((s) => s.isOut).length;
  // isLow is inclusive of isOut, so the two figures below are made disjoint —
  // otherwise the same row would be counted twice in one band.
  const lowCount = stocks.filter((s) => s.isLow && !s.isOut).length;

  const columns: LedgerColumn<StockRow>[] = [
    {
      key: "product",
      label: "Product",
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
      label: "Warehouse",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-ink-2">
          {row.location.warehouse.nameEn}
          <span className="u-mono ms-1.5 text-meta text-ink-3">{row.location.code}</span>
        </span>
      ),
    },
    { key: "qty", label: "On hand", numeric: true },
    {
      key: "reservedQty",
      label: "Reserved",
      numeric: true,
      render: (row) => <span className="text-ink-2">{row.reservedQty}</span>,
    },
    {
      key: "available",
      label: "Available",
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
      label: "Reorder at",
      numeric: true,
      hideOnMobile: true,
      render: (row) => <span className="text-ink-3">{row.reorderPoint}</span>,
    },
    {
      key: "status",
      label: "Status",
      align: "end",
      render: (row) => (
        <StatusPill tone={row.isOut ? "danger" : row.isLow ? "warning" : "neutral"}>
          {row.isOut ? "Out of stock" : row.isLow ? "At reorder point" : "In stock"}
        </StatusPill>
      ),
    },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-4">
        <PageHeader
          eyebrow="Stock"
          // The Arabic gloss this title used to carry was decoration, not
          // localisation: the seller portal has no Arabic locale, and Arabic set
          // in the Latin display face at the heading's negative tracking pulls
          // the letterforms apart at their joins.
          title="Inventory"
          linkComponent={Link}
          dateline={`Stock rows for this seller's products, lowest quantity first · first ${PAGE_LIMIT} rows · read-only`}
        />

        {stocks.length > 0 && (
          <CellGrid cols={{ base: 1, sm: 3 }}>
            <Stat
              label="Out of stock"
              value={outCount}
              rank="section"
              chip={outCount > 0 ? "danger" : undefined}
              note="No units available to promise."
            />
            <Stat
              label="At reorder point"
              value={lowCount}
              rank="section"
              chip={lowCount > 0 ? "warning" : undefined}
              note="Available stock has reached the point recorded for that location."
            />
            <Stat
              label="Stock rows shown"
              value={stocks.length}
              rank="section"
              note="One row per product per warehouse location."
            />
          </CellGrid>
        )}

        {outCount + lowCount > 0 && (
          // The band takes the tone of the worst thing in it: a row with nothing
          // available to promise is a refused order, not a warning, and washing
          // it amber would make it read as the same severity as a reorder point.
          <Surface rung={1} tone={outCount > 0 ? "danger" : "warning"} className="p-4">
            <Eyebrow className="mb-1">Replenish</Eyebrow>
            <p className="u-body text-ink-1">
              {outCount > 0 && `${outCount} stock row${outCount === 1 ? " is" : "s are"} out of stock. `}
              {lowCount > 0 && `${lowCount} row${lowCount === 1 ? " has" : "s have"} reached its reorder point.`}
            </p>
            <Dateline className="mt-1">
              A listing with nothing available to promise can be suppressed and cannot be ordered. Stock is adjusted in
              the warehouse system; this page reports it and does not change it.
            </Dateline>
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
              eyebrow="Nothing recorded"
              headline="No stock has been recorded against this seller's products."
              body="A stock row appears here once a product is stocked at a warehouse location."
            />
          }
          footer={
            stocks.length === PAGE_LIMIT
              ? `${PAGE_LIMIT} rows shown — this page reads a bounded batch, so rows beyond it are not listed.`
              : `${stocks.length} stock row${stocks.length === 1 ? "" : "s"}`
          }
        />
      </div>
    </SellerLayout>
  );
}
