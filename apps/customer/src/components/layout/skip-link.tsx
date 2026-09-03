"use client";

import { useTranslations } from "next-intl";

/**
 * The skip link.
 *
 * The header carries a full navigation, a mega-menu and a search field, so a
 * keyboard or screen-reader user otherwise tabs through the entire chrome on
 * every page before reaching the content. Visually hidden until it takes focus,
 * which is what makes it usable rather than decorative.
 *
 * It is a client island for one reason: its label used to be the literal
 * "Skip to content / تخطي إلى المحتوى" — both languages at once, in code, which
 * is what a product does when nobody owns the message tree. It now comes out of
 * next-intl like every other string, and isolating that in three lines keeps
 * <MainLayout> a plain shell that every server page can render unchanged.
 */
export function SkipLink() {
  const t = useTranslations("common");
  return (
    <a
      href="#main-content"
      // A token pair rather than a raw colour, and a named elevation rung rather
      // than the deprecated `shadow-elevated` alias.
      className="u-ui sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-layer focus:rounded-nested focus:bg-primary focus:px-4 focus:py-2 focus:font-medium focus:text-primary-foreground focus:shadow-elev-4"
    >
      {t("skipToContent")}
    </a>
  );
}
