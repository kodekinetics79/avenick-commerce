import Link from "next/link";
import { requireSellerAnyPermission } from "@/lib/auth";
import { getSellerInventory } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import {
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
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
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-nested bg-surface-1">
            {row.product?.images[0] ? (
              // Plain <img>, not next/image: uploaded product images live on the
              // object-storage host, which is not in next.config's remotePatterns
              // allowlist, and the optimizer throws for any host that is not. One
              // such row would take the whole page down instead of one thumbnail.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.product.images[0].url}
                alt=""
                width={36}
                height={36}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-meta text-ink-3">
                —
              </span>
            )}
          </div>
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
      render: (row) => (
        <span className={row.isOut ? "text-danger-ink" : row.isLow ? "text-warning-ink" : "text-ink-1"}>
          {row.available}
        </span>
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
