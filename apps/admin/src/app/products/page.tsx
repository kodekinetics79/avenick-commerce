import { requireAdminSession } from "@/lib/auth";
import { db, ProductStatus } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import Image from "next/image";
import Link from "next/link";
import {
  Button,
  EmptyState,
  FieldWell,
  ImageFrame,
  LedgerTable,
  Meter,
  NavItem,
  PageHeader,
  StatusPill,
  type PillTone,
} from "@avenick/ui";
import { getTranslations } from "next-intl/server";
import { ProductControls } from "./product-controls";
import { statusLabel } from "@/app/approvals/status-labels";

export async function generateMetadata() {
  const t = await getTranslations("adminReview");
  return { title: t("meta.products") };
}

/** Queues an operator works, in the order they are worked. */
const STATUS_TABS: ProductStatus[] = ["PENDING_REVIEW", "ACTIVE", "INACTIVE", "SUPPRESSED", "REJECTED"];

/** Enum → tone. Four semantic states, which is all an operator distinguishes. */
const STATUS_TONE: Record<ProductStatus, PillTone> = {
  ACTIVE: "success",
  PENDING_REVIEW: "warning",
  INACTIVE: "neutral",
  DRAFT: "neutral",
  SUPPRESSED: "danger",
  SUSPENDED: "danger",
  REJECTED: "danger",
};

const PAGE_SIZE = 50;

function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ProductStatus, value);
}

export default async function AdminProductsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminSession();
  const t = await getTranslations("adminReview");
  // An unknown status is a stale link, not a query to run: fall back to the queue.
  const status: ProductStatus = isProductStatus(searchParams.status) ? searchParams.status : "PENDING_REVIEW";
  const pendingCount = await db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } });

  const where = { deletedAt: null, status } as const;
  const totalInStatus = await db.product.count({ where });
  const products = await db.product.findMany({
    where,
    take: PAGE_SIZE,
    orderBy: { createdAt: "desc" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      seller: { select: { id: true, businessNameEn: true } },
      category: { select: { nameEn: true } },
      // The open suppression reason, so the operator restoring a listing can
      // see why it was taken down without opening the audit trail.
      issues: status === "SUPPRESSED"
        ? { where: { issueType: "SUPPRESSED", resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { message: true, createdAt: true } }
        : false,
    },
  });

  // The in-sentence form of the status, which is its own message rather than a
  // .toLowerCase() of the pill's: English lower-cases a status inside a sentence
  // and Arabic uses the same word in both places.
  const statusInline = statusLabel(t, status, "statusInline");

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("products.eyebrow")}
          title={t("products.title")}
          description={t("products.description", {
            count: totalInStatus,
            total: totalInStatus.toLocaleString("en-US"),
            status: statusInline,
          })}
          // The table is a page of the queue, not the queue. Saying which page
          // is the difference between a count and a claim about the catalogue.
          dateline={
            totalInStatus > products.length
              ? t("products.datelineTruncated", {
                  shown: products.length.toLocaleString("en-US"),
                  total: totalInStatus.toLocaleString("en-US"),
                })
              : t("products.dateline")
          }
        />

        {/* Recessed strip, raised current item: the same gesture as the sidebar,
            so a queue selector reads as "where you are" rather than as a chip. */}
        <FieldWell as="nav" aria-label={t("products.filterLabel")} className="flex flex-wrap gap-1 p-1">
          {STATUS_TABS.map((tab) => (
            <NavItem
              key={tab}
              href={`/products?status=${tab}`}
              label={statusLabel(t, tab)}
              orientation="horizontal"
              active={status === tab}
              linkComponent={Link}
            />
          ))}
        </FieldWell>

        <LedgerTable
          rows={products}
          getRowKey={(p) => p.id}
          stickyHead
          columns={[
            {
              key: "product",
              label: t("products.columns.listing"),
              render: (p) => (
                <div className="flex items-center gap-2.5">
                  {/* <ImageFrame>, not a bare <Image>: object-fit was COVER here,
                      which is the last one in this portal. On seller-supplied
                      photography arriving at every crop and every background
                      tone, cover crops the valve off a fitting and the label off
                      a drum — and one frame with cover in a column of forty with
                      contain announces that the system is not actually a system.
                      Admin's --img-inset is 0 and its ratio is 1/1, because a
                      plate around a 32px thumbnail is a box around a box; the
                      contain fit, the plate and the designed no-image state are
                      the same object the storefront uses. */}
                  <ImageFrame className="h-8 w-8 shrink-0 rounded-nested" alt={p.nameEn}>
                    {p.images[0] && (
                      <Image src={p.images[0].url} alt={p.nameEn} width={32} height={32} sizes="32px" />
                    )}
                  </ImageFrame>
                  <div className="min-w-0">
                    <p className="font-medium text-ink-1">{p.nameEn}</p>
                    {/* Mono is for identifiers. A SKU is one. */}
                    <p className="u-meta u-mono text-ink-3">{p.sku}</p>
                  </div>
                </div>
              ),
            },
            {
              key: "seller",
              label: t("products.columns.seller"),
              render: (p) => (
                <Link href={`/sellers/${p.seller.id}`} className="u-focus rounded-nested text-primary-ink hover:underline">
                  {p.seller.businessNameEn}
                </Link>
              ),
            },
            {
              key: "category",
              label: t("products.columns.category"),
              hideOnMobile: true,
              render: (p) => <span className="u-meta text-ink-2">{p.category.nameEn}</span>,
            },
            {
              key: "health",
              label: t("products.columns.health"),
              hideOnMobile: true,
              width: "128px",
              render: (p) => (
                // One element scaled on X, not five divs carrying three raw
                // hues. Tone is binary — the score is the reading, and colour is
                // reserved for the one case an operator has to act on.
                <div className="flex items-center gap-2">
                  <Meter
                    value={p.listingHealth}
                    tone={p.listingHealth < 60 ? "danger" : "neutral"}
                    size="sm"
                    label={t("products.healthLabel", { name: p.nameEn })}
                    className="w-14"
                  />
                  <span className="u-meta tnum text-ink-2">{p.listingHealth}</span>
                </div>
              ),
            },
            {
              key: "status",
              label: t("products.columns.status"),
              render: (p) => {
                const suppression = Array.isArray(p.issues) ? p.issues[0] : undefined;
                return (
                  <div className="space-y-1">
                    <StatusPill tone={STATUS_TONE[p.status] ?? "neutral"}>{statusLabel(t, p.status)}</StatusPill>
                    {suppression && (
                      <p className="u-meta max-w-[32ch] text-ink-2" title={suppression.message}>
                        <span className="text-ink-3">{t("products.reason")}</span>
                        {suppression.message}
                      </p>
                    )}
                  </div>
                );
              },
            },
            {
              key: "actions",
              label: t("products.columns.decision"),
              align: "end",
              render: (p) => (
                <div className="flex justify-end">
                  <ProductControls
                    productId={p.id}
                    status={p.status}
                    restoreTarget={p.status === "SUPPRESSED" ? (p.publishedAt ? "ACTIVE" : "DRAFT") : undefined}
                  />
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("products.empty.eyebrow")}
              headline={t("products.empty.headline", { status: statusInline })}
              body={t("products.empty.body")}
              action={
                status === "PENDING_REVIEW" ? undefined : (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/products?status=PENDING_REVIEW">{t("products.empty.action")}</Link>
                  </Button>
                )
              }
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
