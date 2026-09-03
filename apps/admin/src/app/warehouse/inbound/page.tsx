import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getInboundMovements } from "@avenick/database";
import { Truck, PackagePlus, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Num, type PillTone,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";
import { Pager } from "@/components/console/chrome";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.inbound");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/** Tone and icon per movement type; labels come from `inbound.type`. */
const TYPE_CONFIG: Record<string, { tone: PillTone; icon: typeof PackagePlus }> = {
  IN: { tone: "success", icon: PackagePlus },
  ADJUSTMENT: { tone: "warning", icon: SlidersHorizontal },
};

interface PageProps {
  searchParams: { page?: string };
}

export default async function InboundPage({ searchParams }: PageProps) {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.inbound");

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
          breadcrumbs={[{ label: t("breadcrumbWarehouse"), href: "/warehouse" }, { label: t("breadcrumbSelf") }]}
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label={t("stats.total")} value={total} rank="section" dateline={t("stats.totalDateline")} />
          <CountStat label={t("stats.in")} value={inCount} dateline={t("stats.pageDateline")} />
          <CountStat label={t("stats.adjustments")} value={adjCount} dateline={t("stats.pageDateline")} />
          <CountStat label={t("stats.units")} value={unitsIn.toLocaleString()} dateline={t("stats.pageDateline")} />
        </CellGrid>

        <LedgerTable
          rows={movements}
          getRowKey={(m) => m.id}
          stickyHead
          dateline={t("table.dateline")}
          columns={[
            {
              key: "createdAt",
              label: t("columns.date"),
              render: (m) => <span className="whitespace-nowrap text-ink-2">{format(m.createdAt, "MMM d, yyyy HH:mm")}</span>,
            },
            {
              key: "type",
              label: t("columns.type"),
              render: (m) => {
                const known = TYPE_CONFIG[m.type];
                const cfg = known ?? TYPE_CONFIG["IN"]!;
                const Icon = cfg.icon;
                return (
                  <StatusPill tone={cfg.tone} className="whitespace-nowrap">
                    <Icon className="h-3 w-3" aria-hidden="true" /> {known ? t(`type.${m.type}`) : m.type}
                  </StatusPill>
                );
              },
            },
            {
              key: "product",
              label: t("columns.product"),
              render: (m) => (
                <div className="min-w-0 py-1">
                  <p className="truncate font-medium text-ink-1">{m.stock.product?.nameEn ?? "—"}</p>
                  <p className="u-mono u-meta text-ink-3">{m.stock.product?.sku ?? ""}</p>
                </div>
              ),
            },
            {
              key: "qty",
              label: t("columns.qty"),
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
              label: t("columns.location"),
              hideOnMobile: true,
              render: (m) => (
                <span className="text-ink-2">
                  {m.stock.location.warehouse.nameEn} · <span className="u-mono text-meta">{m.stock.location.code}</span>
                </span>
              ),
            },
            {
              key: "reference",
              label: t("columns.reference"),
              hideOnMobile: true,
              render: (m) => <span className="u-mono text-meta text-ink-3">{m.reference ?? "—"}</span>,
            },
            {
              key: "notes",
              label: t("columns.notes"),
              hideOnMobile: true,
              render: (m) => <span className="block max-w-[14rem] truncate text-ink-2" title={m.notes ?? undefined}>{m.notes ?? "—"}</span>,
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("empty.eyebrow")}
              headline={t("empty.headline")}
              body={t("empty.body")}
              icon={<Truck className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(target) => `/warehouse/inbound?page=${target}`}
              summary={t.rich("footer", {
                total: String(total),
                count: total,
                n: (chunks) => <span className="fig text-ink-2">{chunks}</span>,
              })}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
