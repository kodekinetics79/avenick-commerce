import { requireAdminSession } from "@/lib/auth";
import { db, ProductStatus } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import Image from "next/image";
import Link from "next/link";
import {
  Button,
  EmptyState,
  FieldWell,
  LedgerTable,
  Meter,
  NavItem,
  PageHeader,
  StatusPill,
  type PillTone,
} from "@avenick/ui";
import { ProductControls } from "./product-controls";

export const metadata = { title: "Products" };

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

  const statusLabel = status.replace(/_/g, " ").toLowerCase();

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Catalogue"
          title="Products"
          description={
            totalInStatus === 1
              ? `1 listing is ${statusLabel}.`
              : `${totalInStatus.toLocaleString()} listings are ${statusLabel}.`
          }
          // The table is a page of the queue, not the queue. Saying which page
          // is the difference between a count and a claim about the catalogue.
          dateline={
            totalInStatus > products.length
              ? `Newest ${products.length} of ${totalInStatus.toLocaleString()} in this status · every decision is written against the listing's state at the moment of the click`
              : "Newest first · every decision is written against the listing's state at the moment of the click"
          }
        />

        {/* Recessed strip, raised current item: the same gesture as the sidebar,
            so a queue selector reads as "where you are" rather than as a chip. */}
        <FieldWell as="nav" aria-label="Filter listings by status" className="flex flex-wrap gap-1 p-1">
          {STATUS_TABS.map((tab) => (
            <NavItem
              key={tab}
              href={`/products?status=${tab}`}
              label={tab.replace(/_/g, " ")}
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
              label: "Listing",
              render: (p) => (
                <div className="flex items-center gap-2.5">
                  {p.images[0] ? (
                    <Image src={p.images[0].url} alt="" width={32} height={32} className="shrink-0 rounded-nested object-cover" />
                  ) : (
                    // Not a broken image and not an icon tile: a recessed blank
                    // that says "no primary image filed" by being empty.
                    <span className="h-8 w-8 shrink-0 rounded-nested bg-surface-1 shadow-elev-1" aria-hidden="true" />
                  )}
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
              label: "Seller",
              render: (p) => (
                <Link href={`/sellers/${p.seller.id}`} className="u-focus rounded-nested text-primary-ink hover:underline">
                  {p.seller.businessNameEn}
                </Link>
              ),
            },
            {
              key: "category",
              label: "Category",
              hideOnMobile: true,
              render: (p) => <span className="u-meta text-ink-2">{p.category.nameEn}</span>,
            },
            {
              key: "health",
              label: "Listing health",
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
                    label={`Listing health for ${p.nameEn}`}
                    className="w-14"
                  />
                  <span className="u-meta tnum text-ink-2">{p.listingHealth}</span>
                </div>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (p) => {
                const suppression = Array.isArray(p.issues) ? p.issues[0] : undefined;
                return (
                  <div className="space-y-1">
                    <StatusPill tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status.replace(/_/g, " ")}</StatusPill>
                    {suppression && (
                      <p className="u-meta max-w-[32ch] text-ink-2" title={suppression.message}>
                        <span className="text-ink-3">Reason: </span>
                        {suppression.message}
                      </p>
                    )}
                  </div>
                );
              },
            },
            {
              key: "actions",
              label: "Decision",
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
              eyebrow="Nothing recorded"
              headline={`No listing is currently ${statusLabel}.`}
              body="Listings move between these queues as sellers publish them and as the platform decides on them."
              action={
                status === "PENDING_REVIEW" ? undefined : (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/products?status=PENDING_REVIEW">Open the review queue</Link>
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
