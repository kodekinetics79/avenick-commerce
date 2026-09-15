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
      // A token pair rather than a raw colour. The focus ring is the system's
      // own `u-focus` ring, the same one every other control in the chrome
      // draws. Without it this link was the first thing a keyboard user
      // reached on every page, and it was the one control wearing the browser's
      // default blue outline. The ring REPLACES the elevation shadow this link
      // used to carry rather than sitting beside it: `u-focus` paints with
      // box-shadow, so the two would fight for the same property, and a link
      // that is invisible until it is focused loses no elevation cue by
      // dropping it.
      className="u-focus u-ui sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-layer focus:rounded-nested focus:bg-primary focus:px-4 focus:py-2 focus:font-medium focus:text-primary-foreground"
    >
      {t("skipToContent")}
    </a>
  );
}
