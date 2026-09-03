"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, PackageSearch } from "lucide-react";
import { Button, CommitRow, Dateline, EmptyState, Eyebrow, SectionHeader, Surface, useCommitState } from "@avenick/ui";
import { ProductReviewControls, type ReviewKind, type ReviewOutcome } from "./product-review-controls";

/**
 * One listing in the review queue, flattened server-side so this component
 * receives nothing but strings — no Prisma model crosses the boundary and no
 * date is formatted twice with two different locales.
 */
export interface QueueListing {
  id: string;
  name: string;
  sku: string;
  seller: string;
  category: string;
  submitted: string;
}

interface Props {
  listings: QueueListing[];
  /**
   * Total in PENDING_REVIEW, so the footer can say what is not on screen.
   * `null` when the count itself could not be read.
   */
  totalPending: number | null;
  /**
   * True when the listing read failed. An empty list and a failed read are
   * different facts, and showing "nothing is waiting" for the second is the one
   * lie this page is most able to tell.
   */
  unavailable?: boolean;
}

/**
 * The product review queue.
 *
 * It is a queue, not a table: each entry carries a two-step reject form and,
 * when a decision is refused, a compare-and-swap notice that has to sit at full
 * width. Both of those are what makes a real table the wrong container — a
 * conflict notice squeezed into a 180px "Actions" cell is exactly how the most
 * important message on the page ends up looking like the least important.
 *
 * So: one recessed well, hairline-divided rows, and the commit choreography on
 * the row itself. Acting on a row paints its inline-start rule, washes it in its
 * tone, and then drains it out — which answers the only real usability question
 * in a forty-row queue, "which one did I just act on".
 */
export function ReviewQueue({ listings, totalPending, unavailable = false }: Props) {
  // Rows leave the list only once the server has confirmed the decision, and the
  // set is keyed by id so a router.refresh() that returns the same row (because
  // the write was refused) simply shows it again.
  const [drained, setDrained] = useState<Set<string>>(new Set());
  const visible = useMemo(() => listings.filter((l) => !drained.has(l.id)), [listings, drained]);

  return (
    <Surface rung={1} className="overflow-hidden">
      <div className="px-4 pt-4">
        <SectionHeader
          eyebrow="Queue"
          title="Product listings awaiting review"
          // No count when the read failed: a "0" beside the title would be the
          // same lie as an empty state, just smaller.
          count={unavailable ? undefined : visible.length}
          dateline="Listings a seller has submitted and no administrator has decided · newest first"
          className="mb-3"
        />
      </div>

      {visible.length === 0 ? (
        unavailable ? (
          <EmptyState
            variant="certificate"
            glyph={<AlertTriangle />}
            eyebrow="Not read"
            headline="The review queue could not be read."
            body="This is not the same as an empty queue: the platform did not answer, so nothing here can be relied on and no listing should be assumed decided or undecided from it."
            action={
              <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                Read the queue again
              </Button>
            }
          />
        ) : (
          <EmptyState
            variant="certificate"
            glyph={<PackageSearch />}
            eyebrow="Nothing awaiting review"
            headline="No product listing is waiting on an administrator."
            body="A listing appears here the moment a seller submits one for review, and leaves it as soon as somebody approves or rejects it. Nothing is filtered out of this queue."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/products?status=ACTIVE">Review live listings</Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="border-t border-hairline">
          {visible.map((listing) => (
            <QueueEntry
              key={listing.id}
              listing={listing}
              onDrained={() => setDrained((set) => new Set(set).add(listing.id))}
            />
          ))}
        </div>
      )}

      {totalPending !== null && totalPending > listings.length && (
        <div className="border-t border-hairline px-4 py-2.5">
          <Dateline>
            {`Showing the newest ${listings.length} of ${totalPending.toLocaleString()} listings in review`}
          </Dateline>
        </div>
      )}
    </Surface>
  );
}

function QueueEntry({ listing, onDrained }: { listing: QueueListing; onDrained: () => void }) {
  const commit = useCommitState({ onExit: onDrained });
  const [tone, setTone] = useState<"success" | "danger" | "warning">("success");

  function report(outcome: ReviewOutcome, kind: ReviewKind) {
    if (outcome === "idle") {
      // The reason field refused it, not the platform. Nothing was attempted
      // against the record, so the row goes back to rest carrying no mark.
      commit.reset();
      return;
    }
    if (outcome === "failed") {
      // Nothing was written. Marking a refused approval in the reject colour
      // would say the opposite of what happened, so the row commits in warning
      // and stays put — findable in a long queue, and honest about the outcome.
      setTone("warning");
      commit.commit({ exit: false });
      return;
    }
    setTone(kind === "reject" ? "danger" : "success");
    if (outcome === "pending") commit.begin();
    else commit.commit();
  }

  return (
    <CommitRow
      as="div"
      state={commit.state}
      tone={tone}
      onTransitionEnd={commit.onTransitionEnd}
      // border-b-hairline, not border-hairline: the shared .u-commit rule holds
      // a 3px transparent border-inline-start so the commit rule can colour in
      // without reflowing the rows below it, and an all-sides border-colour
      // utility (which Tailwind emits after the system sheet) would paint that
      // reserved rule hairline on every row at rest.
      className="u-ledger-row flex flex-wrap items-start gap-4 border-b border-b-hairline px-4 py-3 last:border-b-0"
    >
      <div className="min-w-0 flex-1 basis-64">
        <p className="u-ui font-medium text-ink-1">{listing.name}</p>
        <p className="u-meta text-ink-2">
          {listing.seller} · {listing.category}
        </p>
        {/* Mono is for identifiers — SKUs, order refs, tracking ids. Never money. */}
        <p className="u-meta u-mono text-ink-3">{listing.sku}</p>
      </div>

      <div className="shrink-0">
        <Eyebrow>Submitted</Eyebrow>
        <p className="u-meta tnum text-ink-2">{listing.submitted}</p>
      </div>

      <div className="ms-auto shrink-0">
        <ProductReviewControls productId={listing.id} onOutcome={report} />
      </div>
    </CommitRow>
  );
}
