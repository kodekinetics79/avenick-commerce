import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { AuthProvider } from "@/components/auth-provider";
import { AmbientField, EnvironmentFlags, RevealRoot } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";
import "./globals.css";

/**
 * The document title and description are the first strings a supplier reads, so
 * they are message-tree strings like everything else — which means they cannot
 * be a module-scope constant any more: a translator only exists inside a
 * request. The platform name stays dynamic and travels in as an interpolation
 * value rather than being written into either translation.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sellerShell.meta");
  return {
    title: { default: t("title", { platform: platformName() }), template: t("titleTemplate") },
    description: t("description", { platform: platformName() }),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    // data-portal is what selects this portal's posture in the shared token
    // sheet — radius, row height, motion scale, field intensity and the type
    // steps. The app stylesheet applies the density half unconditionally, but
    // the type half is keyed off this attribute so the RTL overrides still win.
    <html lang={locale} dir={dir} data-portal="seller" suppressHydrationWarning>
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
        {/* The one gradient permitted anywhere in the product, mounted once.
            At the seller portal's --field-intensity of 0.30 it is barely
            perceptible on purpose: a supplier lives in this app for hours. */}
        <AmbientField />
        {/* Drives every [data-reveal] on the page from a single observer, so no
            page has to become a client component to get an entrance. */}
        <RevealRoot />
        {/* Stamps data-save-data on <html> from navigator.connection.saveData;
            see the customer layout for why this is a component and not a query. */}
        <EnvironmentFlags />
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
