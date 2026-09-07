import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { BrandMark, Button, EmptyState } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";

/**
 * 404.
 *
 * WHAT WAS HERE, and why none of it could stay. This file was written before
 * SIJILL and had drifted furthest of any surface in the product:
 *
 *   · A hardcoded "A" in a `bg-gradient-to-br from-primary to-accent` tile. Not
 *     platformName() — a renamed deployment showed somebody else's initial.
 *   · Two 400–600px `blur-[120px]` colour orbs and a `bg-grid` overlay. That is
 *     a second and third ambient field on one page, which §9 bans by name: two
 *     stacked fields double the alpha and silently break every contrast ceiling
 *     in §3.7. It is also the exact "visible orb" failure the single field
 *     exists to avoid.
 *   · `text-gradient` on the 404 figure — §9, and neutralised to plain ink in
 *     the compat block anyway, so it had already stopped doing anything.
 *   · `font-black` and `font-extrabold`. LAW C: weights are 400/500/600.
 *   · `shadow-glow-sm`. §3.10: "there are no glow tokens."
 *   · Every string as an English/Arabic slash pair — "Page not found / الصفحة
 *     غير موجودة" — which §9 bans and which reads as half-translated to both
 *     audiences at once.
 *   · A full search form duplicating the one the header already renders on this
 *     very page. LAW G: check for the duplicate before you count the options.
 *   · `-translate-x-1` on the back arrow: a physical direction, so it pointed
 *     the wrong way in Arabic.
 *
 * WHAT IS HERE NOW. `EmptyState variant="certificate"` — §10.11 says the empty
 * state is the surface someone is actually looking at and must be built before
 * the field, before the hero, before anything animated, and a 404 is the most
 * looked-at empty state in any product. It arrives with the brass rule already
 * drawn across its top edge, so this page belongs to the system rather than
 * decorating itself back into it.
 *
 * It also stopped being `"use client"`. Nothing here has state: the search box
 * that needed it is gone, and `router.back()` went with it — a browser has a
 * back button, and a control that only sometimes has somewhere to go is worse
 * than no control.
 */
export default async function NotFound() {
  const t = await getTranslations("notFound");
  const brand = platformName();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-shell flex-col items-center justify-center gap-8 px-gutter py-16">
      <Link href="/" aria-label={t("markLabel", { brand })} className="u-focus rounded-nested">
        <BrandMark name={brand} size={48} />
      </Link>

      <EmptyState
        variant="certificate"
        eyebrow={`${t("eyebrow")} · ${t("code")}`}
        headline={t("headline")}
        body={t("body")}
        glyph={<Compass />}
        action={
          <Button asChild variant="primary">
            <Link href="/products">{t("products")}</Link>
          </Button>
        }
        className="w-full"
      />

      {/* Two further destinations, as tertiary links rather than a second row of
          buttons: EmptyState takes exactly one action, and three equal buttons
          would make the recovery a three-way choice instead of a default with
          alternatives (LAW G — default one, do not delete the rest). */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Button asChild variant="link" size="sm">
          <Link href="/">{t("home")}</Link>
        </Button>
        <Button asChild variant="link" size="sm">
          <Link href="/support">{t("support")}</Link>
        </Button>
      </div>
    </div>
  );
}
