"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertOctagon } from "lucide-react";
import { BrandMark, Button, EmptyState } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";

/**
 * Route-segment error boundary — the last screen a shopper sees when a page
 * under this segment throws.
 *
 * WHAT WAS HERE, and why none of it survived. This file was written before
 * SIJILL and carried the same set of defects the 404 did:
 *
 *   · `bg-grid mask-fade-b` plus a 400–600px `blur-[120px]` colour orb: a
 *     SECOND ambient field on one page, which §9 bans by name. Two stacked
 *     fields double the alpha and silently break every contrast ceiling §3.7
 *     derives — on the one screen whose whole job is to stay readable.
 *   · A `bg-gradient-to-br from-amber-500 to-orange-600` tile behind a warning
 *     triangle. The gradient is banned; the amber is a STATUS colour being spent
 *     as decoration; and a coloured lozenge at the top of a failure screen is
 *     the least authoritative thing that could be there.
 *   · `shadow-glow-sm`. §3.10: "there are no glow tokens."
 *   · Every string as an English/Arabic slash pair — "Something went wrong /
 *     حدث خطأ ما" — which reads as half-translated to both audiences at once.
 *     This boundary sits INSIDE the root layout, so NextIntlClientProvider is
 *     mounted and `useTranslations` works: there was never a reason for the
 *     literals beyond nobody having removed them.
 *   · `text-white` and `text-3xl font-bold` — a weight LAW C does not define.
 *
 * WHAT IS HERE NOW. The mark, so a failure still reads as this product, and
 * `EmptyState variant="certificate"`, which is the composed plate §10.11 says to
 * build BEFORE the field and before anything animated. A failure screen is an
 * empty state that arrived by accident rather than by navigation.
 *
 * THE COPY IS NARROWED ON PURPOSE. It used to say the team "can help", which
 * promises a support relationship this boundary cannot verify, and it did not
 * say what was and was not affected. It now states only what is knowable from
 * here: the render failed, retrying re-renders it, and nothing already
 * submitted was changed BY THIS FAILURE. The boundary knows the page threw. It
 * does not know what any earlier request reached the platform with, so it does
 * not claim "nothing was saved".
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    // Surfaces in the platform log. The digest is the only thing support can
    // correlate on, so it is logged and shown rather than swallowed.
    console.error("[customer] route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-shell flex-col items-center justify-center gap-8 px-gutter py-16">
      <BrandMark name={platformName()} size={48} />

      <EmptyState
        variant="certificate"
        eyebrow={t("eyebrow")}
        headline={t("headline")}
        body={t("body")}
        glyph={<AlertOctagon />}
        action={
          <Button type="button" variant="primary" onClick={reset}>
            {t("retry")}
          </Button>
        }
        className="w-full"
      />

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Button asChild variant="link" size="sm">
          <Link href="/">{t("home")}</Link>
        </Button>
        <Button asChild variant="link" size="sm">
          <Link href="/support">{t("support")}</Link>
        </Button>
      </div>

      {/* The digest is an identifier, so it is set in mono like every other
          reference in the product — and it is the one thing support will ask
          for, so it is visible rather than console-only. */}
      {error.digest ? (
        <p className="u-meta text-ink-3">
          {t("reference")} <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
