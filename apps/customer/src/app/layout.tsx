import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { AuthProvider } from "@/components/auth-provider";
import { NavigationProgress } from "@/components/navigation-progress";
import { AmbientField, EnvironmentFlags, RevealRoot } from "@avenick/ui";
import { platformName, selfOrigin } from "@avenick/utils/portal-config";
import { appIconPath } from "@/components/seo/app-icons";
import { JsonLd } from "@/components/seo/json-ld";
import { siteIdentity } from "@/components/seo/structured-data";
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
  const name = platformName();

  // metadataBase is what every relative asset URL below resolves against. It was
  // absent, and its absence is why an openGraph block would not have worked even
  // if one had existed: Next resolves `/opengraph-image` against it, warns at
  // build when it is missing, and falls back to localhost. selfOrigin() returns
  // null rather than a guess when the deployment is not configured, so an
  // unconfigured environment omits the key instead of advertising a card at an
  // address that is not this one.
  const origin = selfOrigin("customer");

  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: { default: name, template: `%s | ${name}` },
    description: t("metaDescription"),
    applicationName: name,
    // icon.tsx, apple-icon.tsx and opengraph-image.tsx are file conventions and
    // are wired automatically; this names the manifest, which is not.
    manifest: "/manifest.webmanifest",
    // Only what is true of EVERY page: the kind of site and its name. This block
    // used to carry `title: name`, the root description and `url: origin`, and
    // no route overrides openGraph, so every page on the storefront — a product,
    // a category, the cart — shared as "Avenick", with the home page's sentence,
    // at the home page's address.
    //
    // Leaving title and description out lets Next fill og:title, og:description
    // and their twitter:* twins from each page's own resolved title (template
    // included) and description (resolve-metadata.js, inheritFromMetadata). That
    // is also why pages must not rebuild openGraph themselves: a page-level
    // openGraph replaces this one, and the image opengraph-image.tsx attaches here
    // would go with it. og:url is omitted, not recomputed: it is optional, a
    // scraper uses the URL it fetched, and each indexable page names its
    // canonical through lib/page-metadata.ts instead.
    openGraph: { type: "website", siteName: name },
    twitter: { card: "summary_large_image" },
  };
}

/**
 * The browser's own chrome — the mobile address bar, the installed window's
 * title bar — painted the colour of the page ground rather than the browser's
 * default. There was no theme-color at all, so a dark-theme visitor on Android
 * got a white bar above a near-black page.
 *
 * The two values are the literal grounds: --surface-0 in :root is
 * hsl(36 20% 97.5%) = #faf9f7, the same paper the manifest's theme_color names,
 * and in .dark it is hsl(232 18% 4%) = #08090c. They are literals because a meta
 * tag cannot read a CSS custom property; if either token moves, these move with it.
 *
 * KNOWN LIMIT. This follows the SYSTEM preference. The header's ThemeToggle can
 * override that, and it records the override in localStorage, which a server-
 * rendered tag cannot see. A visitor who picks light on a dark system keeps a dark
 * bar until the toggle updates the tag itself. That fix belongs to ThemeToggle in
 * packages/ui and is handed off, not guessed at here.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#08090c" },
  ],
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("AVENICK_LOCALE")?.value ?? "en";
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";
  // The site's name, address and logo as structured data, on every page. Only
  // when this deployment knows its own address: every URL in it must be
  // absolute, and selfOrigin() returns null rather than a guess. The logo is the
  // 512px plated icon, the size search engines ask a logo to clear.
  const origin = selfOrigin("customer");

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
        {origin && <JsonLd data={{ "@graph": siteIdentity(origin, platformName(), appIconPath(512)) }} />}
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
