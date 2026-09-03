import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getInboundMovements } from "@avenick/database";
import { Truck, PackagePlus, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Num, type PillTone,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";
import { Pager } from "@/app/finance/console-chrome";

export const metadata = { title: "Inbound Receiving" };
export const dynamic = "force-dynamic";

const TYPE_CONFIG: Record<string, { label: string; tone: PillTone; icon: typeof PackagePlus }> = {
  IN: { label: "Stock In", tone: "success", icon: PackagePlus },
  ADJUSTMENT: { label: "Adjustment", tone: "warning", icon: SlidersHorizontal },
};

interface PageProps {
  searchParams: { page?: string };
}

export default async function InboundPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 30;
  const { movements, total } = await getInboundMovements({ page, limit });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const inCount = movements.filter((m) => m.type === "IN").length;
  const adjCount = movements.filter((m) => m.type === "ADJUSTMENT").length;
  const unitsIn = movements.filter((m) => m.type === "IN").reduce((s, m) => s + m.qty, 0);

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          linkComponent={Link}
          breadcrumbs={[{ label: "Warehouse", href: "/warehouse" }, { label: "Inbound" }]}
          eyebrow="Operations"
          title="Inbound receiving"
          description="Stock-in movements and inventory adjustments from the movement ledger."
          dateline="Three of the four figures below describe this page of the ledger, not the whole of it"
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label="Total movements" value={total} rank="section" dateline="Every inbound movement on record" />
          <CountStat label="Stock-in" value={inCount} dateline="On this page of the ledger" />
          <CountStat label="Adjustments" value={adjCount} dateline="On this page of the ledger" />
          <CountStat label="Units received" value={unitsIn.toLocaleString()} dateline="On this page of the ledger" />
        </CellGrid>

        <LedgerTable
          rows={movements}
          getRowKey={(m) => m.id}
          stickyHead
          dateline="Movements as recorded, newest first · a negative quantity is stock taken off the shelf"
          columns={[
            {
              key: "createdAt",
              label: "Date",
              render: (m) => <span className="whitespace-nowrap text-ink-2">{format(m.createdAt, "MMM d, yyyy HH:mm")}</span>,
            },
            {
              key: "type",
              label: "Type",
              render: (m) => {
                const cfg = TYPE_CONFIG[m.type] ?? TYPE_CONFIG["IN"]!;
                const Icon = cfg.icon;
                return (
                  <StatusPill tone={cfg.tone} className="whitespace-nowrap">
                    <Icon className="h-3 w-3" aria-hidden="true" /> {cfg.label}
                  </StatusPill>
                );
              },
            },
            {
              key: "product",
              label: "Product",
              render: (m) => (
                <div className="min-w-0 py-1">
                  <p className="truncate font-medium text-ink-1">{m.stock.product?.nameEn ?? "—"}</p>
                  <p className="u-mono u-meta text-ink-3">{m.stock.product?.sku ?? ""}</p>
                </div>
              ),
            },
            {
              key: "qty",
              label: "Qty",
              numeric: true,
              render: (m) => (
                <Num
                  value={m.qty >= 0 ? `+${m.qty}` : String(m.qty)}
                  className={m.qty >= 0 ? "text-success-ink" : "text-danger-ink"}
                />
              ),
            },
            {
              key: "location",
              label: "Location",
              hideOnMobile: true,
              render: (m) => (
                <span className="text-ink-2">
                  {m.stock.location.warehouse.nameEn} · <span className="u-mono text-meta">{m.stock.location.code}</span>
                </span>
              ),
            },
            {
              key: "reference",
              label: "Reference",
              hideOnMobile: true,
              render: (m) => <span className="u-mono text-meta text-ink-3">{m.reference ?? "—"}</span>,
            },
            {
              key: "notes",
              label: "Notes",
              hideOnMobile: true,
              render: (m) => <span className="block max-w-[14rem] truncate text-ink-2" title={m.notes ?? undefined}>{m.notes ?? "—"}</span>,
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No inbound movement has been recorded."
              body="A stock-in appears here when a seller or warehouse operator receives inventory against a bin location."
              icon={<Truck className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(target) => `/warehouse/inbound?page=${target}`}
              summary={
                <>
                  <span className="fig text-ink-2">{total}</span> movement{total === 1 ? "" : "s"} on record
                </>
              }
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
