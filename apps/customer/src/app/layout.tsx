import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { AuthProvider } from "@/components/auth-provider";
import { NavigationProgress } from "@/components/navigation-progress";
import { AmbientField, EnvironmentFlags, RevealRoot } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";
import "./globals.css";

// "The leading platform" (المنصة الرائدة) was a market-position claim nothing
// measures; the description says what the platform is, not where it ranks.
//
// It is generated rather than static because it used to be ONE string carrying
// both scripts — an English sentence with an Arabic clause welded on after an
// em-dash — which is what a document does when it has no message tree. An Arabic
// visitor's search result and share card now read as Arabic, not as English with
// Arabic appended.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    title: { default: platformName(), template: `%s | ${platformName()}` },
    description: t("metaDescription"),
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("AVENICK_LOCALE")?.value ?? "en";
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    // data-portal is what selects this app's posture in the shared token file:
    // radius, row height, motion scale, ambient-field intensity and the type
    // steps. Without it the stylesheet can only apply the density half, because
    // moving the type half into the app's own stylesheet would let it beat the
    // [dir="rtl"] block and shrink Arabic.
    <html lang={locale} dir={dir} data-portal="customer" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          THE ARABIC DISPLAY FACES, loaded only for the Arabic build.
          globals.css cannot be conditional and the English build must not pay
          for two extra families it will never render, so the base @import
          carries Latin plus Plex Arabic and this link carries the two faces that
          give Arabic its own display and provenance registers:
          Noto Kufi Arabic (the script of official inscription — the register
          argument for a trade register, not a mood board) and Noto Naskh Arabic
          (Arabic's authored register, which is what <Dateline> and the
          <EmptyState> lead set in). Before this, --font-provenance was Source
          Serif 4, which has ZERO Arabic coverage, so the Arabic build fell back
          silently and had no human voice at all.
        */}
        {locale === "ar" && (
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap"
          />
        )}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('avenick-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&m)){document.documentElement.classList.add('dark');}}catch(e){}})();` }} />
      </head>
      <body>
        {/*
          Mounted exactly once, here. AmbientField is the single permitted
          gradient in the product — it is fixed, never animated, and it replaces
          the pair of 384px blur-[120px] orbs the storefront used to paint on the
          home page. RevealRoot is one IntersectionObserver for every staged
          entrance on the page; if it never runs, the page is simply fully
          visible, so no content depends on it.
        */}
        <AmbientField />
        <RevealRoot />
        {/* Law 7 names Save-Data and no shipping browser exposes it as a CSS
            media query. This reads navigator.connection.saveData once and stamps
            data-save-data on <html>, which halves --motion-scale, stops the
            field drift, drops the grain layer, hides the hero's decorative
            planes and stops <LightGrid> attaching its pointer listener. If it
            never runs, the product is simply the full experience. */}
        <EnvironmentFlags />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
