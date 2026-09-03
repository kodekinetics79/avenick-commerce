"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, RefreshCw } from "lucide-react";
import { Button, Dateline, Divider, EmptyState, Eyebrow } from "@avenick/ui";

/**
 * Route-segment error boundary for Seller Central. Keeps an uncaught render
 * error from becoming a white screen while a supplier is working.
 *
 * The old version led with a 56px amber→orange gradient tile carrying
 * `shadow-elevated`, and put the digest — the one thing a supplier can actually
 * give the platform to find what happened — in 11px grey at 70% opacity below
 * the fold of the block. The digest is now a first-class line in the provenance
 * voice, in mono, which is exactly what mono is reserved for.
 *
 * Two actions rather than one, because the recovery and the exit are different
 * intentions: "try again" re-renders the segment, "dashboard" leaves it. The
 * certificate's contract is one action, so the retry — the primary one — is the
 * certificate's, and the way out sits beneath it.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[seller] route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <Divider drawn on className="w-12" />
      <Eyebrow className="mt-4">Seller Central</Eyebrow>

      <EmptyState
        className="mt-4"
        variant="certificate"
        glyph={<AlertTriangle />}
        eyebrow="Unexpected error"
        headline="This screen hit an error and could not finish rendering."
        // No claim about what did or did not happen to the seller's data: this
        // boundary catches a RENDER failure and knows nothing about the request
        // behind it, so saying "nothing was saved" would be a guess presented as
        // a fact.
        body="Nothing on this page was submitted by the failure itself. Try the screen again, or leave it and come back from your dashboard."
        action={
          <Button variant="primary" size="sm" onClick={reset}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" /> Back to your dashboard
          </Link>
        </Button>
        {/* The reference the platform can search on. Mono, because it is an
            identifier — the one category of string mono exists for. */}
        {error.digest && (
          <Dateline className="min-w-0">
            Reference <span className="u-mono text-ink-2">{error.digest}</span> — quote this if you report it.
          </Dateline>
        )}
      </div>
    </div>
  );
}
