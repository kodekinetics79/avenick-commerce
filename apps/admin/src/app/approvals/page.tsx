import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import Link from "next/link";
import { format } from "date-fns";
import { Package, Store, FileCheck } from "lucide-react";
import { CellGrid, PageHeader, Stat } from "@avenick/ui";
import { ReviewQueue, type QueueListing } from "./review-queue";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  await requireAdminSession();

  // A read that failed is NOT a zero and NOT an empty queue. Falling back to 0
  // told an administrator "nothing is waiting" when the platform had not
  // answered at all — the exact fabrication the truth law forbids, and it is the
  // most expensive one on this page because the whole point of the page is to
  // say whether there is work. The queries are unchanged; only what a failure
  // renders as has changed, from a fictional figure to a stated gap.
  const [pendingProducts, pendingSellers, pendingDocs] = await Promise.all([
    db.product.count({ where: { status: "PENDING_REVIEW", deletedAt: null } }).catch(() => null),
    db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } }).catch(() => null),
    db.sellerDocument.count({ where: { status: "PENDING_REVIEW" } }).catch(() => null),
  ]);

  const products = await db.product.findMany({
    where: { status: "PENDING_REVIEW", deletedAt: null },
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { seller: { select: { businessNameEn: true } }, category: { select: { nameEn: true } } },
  }).catch(() => null);

  // The queue tiles carried ten hues of icon chip between them — blue, purple,
  // amber — none of which said anything the count did not. A queue has exactly
  // two states an operator acts on, so it gets exactly two: warning when there
  // is work, neutral when there is none.
  const queues: Array<{ label: string; count: number | null; icon: typeof Package; href: string }> = [
    { label: "Product listings", count: pendingProducts, icon: Package, href: "/products?status=PENDING_REVIEW" },
    { label: "Supplier applications", count: pendingSellers, icon: Store, href: "/sellers/pending" },
    { label: "Compliance documents", count: pendingDocs, icon: FileCheck, href: "/compliance" },
  ];
  const unread = queues.filter((queue) => queue.count === null).length;
  const totalPending = queues.reduce((sum, queue) => sum + (queue.count ?? 0), 0);
  // "At least", not a flat total, whenever a queue did not answer: the figure is
  // then a floor and the page says so rather than passing a partial sum off as
  // the whole of the outstanding work.
  const summary =
    unread > 0
      ? `At least ${totalPending.toLocaleString()} items are waiting on an administrator; ${
          unread === 1 ? "one queue" : `${unread} queues`
        } could not be read.`
      : totalPending === 1
        ? "1 item is waiting on an administrator."
        : `${totalPending.toLocaleString()} items are waiting on an administrator.`;

  // Dates are formatted here rather than in the client queue so the string the
  // server renders is the string that hydrates.
  const listings: QueueListing[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.nameEn,
    sku: p.sku,
    seller: p.seller?.businessNameEn ?? "Seller not recorded",
    category: p.category?.nameEn ?? "Uncategorised",
    submitted: format(p.createdAt, "MMM d, yyyy"),
  }));

  return (
    <AdminLayout pendingCount={pendingSellers ?? 0}>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Marketplace review"
          title="Approvals"
          description={summary}
          // LAW E. This is the sentence that makes the refusal notice below make
          // sense when it appears: every decision is written against the row's
          // current state, so a queue read a minute ago can already be wrong.
          dateline="Counts read when this page loaded · every decision is written against the row's state at the moment of the click"
        />

        {/* One panel divided by hairlines, not three floating cards. Three peer
            queues at one rank; the page title is what they are subordinate to. */}
        <CellGrid cols={{ base: 1, sm: 3 }}>
          {queues.map((queue) => (
            <Stat
              key={queue.label}
              label={queue.label}
              // A count that could not be read is set at inline rank and says so:
              // "Not read" at section rank would look like a figure, which is
              // precisely what it is not.
              value={queue.count === null ? "Not read" : queue.count.toLocaleString()}
              rank={queue.count === null ? "inline" : "section"}
              icon={queue.icon}
              chip={queue.count === null ? "danger" : queue.count > 0 ? "warning" : "neutral"}
              note={
                queue.count === null
                  ? "The platform did not answer this count"
                  : queue.count > 0
                    ? "Open the queue"
                    : "Nothing awaiting review"
              }
              // The cell corners are square: CellGrid draws its dividers as a 1px
              // hairline gap behind the cells, and a rounded cell lets that colour
              // show through as an arc at every corner.
              className="rounded-none"
              href={queue.href}
              linkComponent={Link}
            />
          ))}
        </CellGrid>

        <ReviewQueue listings={listings} totalPending={pendingProducts} unavailable={products === null} />
      </div>
    </AdminLayout>
  );
}
