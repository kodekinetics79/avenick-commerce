"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Home, HelpCircle, AlertTriangle } from "lucide-react";

/**
 * Route-segment error boundary. Any uncaught error while rendering a page under
 * this segment lands here instead of a raw stack trace / white screen — the
 * single most important safeguard for an unscripted, self-serve client test.
 * Bilingual and on-brand so a failure still reads as a considered product.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in Render/Vercel logs. Swap for Sentry.captureException once wired.
    console.error("[customer] route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background text-foreground overflow-hidden px-4">
      <div className="absolute inset-0 bg-grid mask-fade-b opacity-40 pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[400px] sm:h-[600px] sm:w-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      <div className="relative max-w-xl w-full text-center space-y-8 py-12">
        <div className="flex justify-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-elevated">
            <AlertTriangle className="h-7 w-7" />
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Something went wrong / حدث خطأ ما
          </h1>
          <div className="max-w-md mx-auto space-y-2 mt-4">
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              This page hit an unexpected error. Try again — if it keeps happening, our team can help.
            </p>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed font-medium" dir="rtl">
              واجهت هذه الصفحة خطأ غير متوقع. حاول مرة أخرى — وإذا استمر الأمر، فإن فريقنا جاهز لمساعدتك.
            </p>
          </div>
          {error.digest ? (
            <p className="text-[11px] text-muted-foreground/70 font-mono pt-1">ref: {error.digest}</p>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/95 transition-all shadow-glow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Try again / حاول مجدداً
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-card border border-border text-sm font-semibold hover:border-primary/40 transition-all"
          >
            <Home className="h-4 w-4" />
            Home / الرئيسية
          </Link>
        </div>

        <div className="pt-6 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Need help? / هل تحتاج لمساعدة؟</span>
          <Link href="/support" className="text-primary hover:underline font-semibold">
            Contact Support / الدعم الفني
          </Link>
        </div>
      </div>
    </div>
  );
}
