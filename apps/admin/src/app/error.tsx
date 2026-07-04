"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, LayoutDashboard, AlertTriangle } from "lucide-react";

/**
 * Route-segment error boundary for the Admin console. Prevents an uncaught
 * render error from surfacing as a white screen / stack trace during testing.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="max-w-lg w-full text-center space-y-6 py-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-elevated">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            This screen hit an unexpected error. Try again, or return to the dashboard.
          </p>
          {error.digest ? <p className="text-[11px] text-muted-foreground/70 font-mono pt-1">ref: {error.digest}</p> : null}
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/95 transition-all shadow-glow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-card border border-border text-sm font-semibold hover:border-primary/40 transition-all"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
