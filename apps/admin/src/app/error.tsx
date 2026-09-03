"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, LayoutDashboard, AlertTriangle } from "lucide-react";
import { Button, Dateline, EmptyState } from "@avenick/ui";

/**
 * Route-segment error boundary for the admin console. It prevents an uncaught
 * render error from surfacing as a white screen or a stack trace.
 *
 * It is the Certificate plate rather than a centred apology with a gradient
 * badge on it: a failure surface is still a surface the operator is looking at,
 * and the digest is the one genuinely useful fact on it — so it is set in mono,
 * as an identifier, and stated as what support will ask for.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-3">
        <EmptyState
          variant="certificate"
          glyph={<AlertTriangle />}
          eyebrow="Not rendered"
          headline="This screen hit an error and stopped before it finished drawing."
          // NOT "nothing was written". A render boundary knows the screen
          // failed to draw; it does not know what a request that reached the
          // platform before it did. Telling an operator their decision was not
          // recorded when it may have been is the kind of quiet untruth this
          // codebase spent a hardening programme removing — so the copy says
          // only what is knowable, and points at the register that does know.
          body="This is a rendering failure, so nothing on the screen behind it can be read as the record. Retrying re-runs the screen against the platform's current state; the audit trail is the authority on what was actually recorded."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={reset} size="sm">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" /> Command center
                </Link>
              </Button>
            </div>
          }
        />
        {error.digest && (
          <Dateline>
            Reference <span className="u-mono">{error.digest}</span> · quote it to platform operations
          </Dateline>
        )}
      </div>
    </div>
  );
}
