import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { AuthProvider } from "@/components/auth-provider";
import { AmbientField, EnvironmentFlags } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";
import "./globals.css";

// generateMetadata rather than a static `metadata` object: the console's own
// name is translated, and a module-scope constant has no translator in scope.
// The platform name stays configuration and is passed in as a value.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminShell.meta");
  const platform = platformName();
  return {
    title: { default: t("default", { platform }), template: `%s | ${t("suffix")}` },
    description: t("description", { platform }),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    // data-portal selects this portal's Meridian posture: the densest radius and
    // row height, the fastest motion, the faintest ambient field, and the console
    // type steps. The app stylesheet already applies the density half so the
    // console is correct even before hydration; the attribute is what turns on
    // the TYPE half, which cannot live in the app sheet without out-ranking the
    // RTL overrides for Arabic.
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} data-portal="admin" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The Arabic display and provenance faces, loaded only for the Arabic
            build — globals.css cannot be conditional and the English build must
            not pay for two families it will never render. Noto Kufi Arabic is
            the display register (the script of official inscription) and Noto
            Naskh Arabic is the provenance register; --font-provenance was Source
            Serif 4, which has ZERO Arabic coverage, so the Arabic build fell
            back silently and had no human voice at all. */}
        {locale === "ar" && (
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400..700&family=Noto+Naskh+Arabic:wght@400..700&display=swap"
          />
        )}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('avenick-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&m)){document.documentElement.classList.add('dark');}}catch(e){}})();` }} />
      </head>
      <body>
        {/* The one gradient permitted anywhere in the product, mounted once. At
            the admin --field-intensity of 0.15 it is barely a tint — a console
            wants a ground that is not flat white, not a decorated one. It
            replaces the blur-[100px] orb that used to sit behind the command
            band, which had a discernible edge and read as a 2019 SaaS template.
            <RevealRoot> is deliberately NOT mounted: staged reveals are off in
            admin, because a console must be fully readable at t=0. */}
        <AmbientField />
        {/* Stamps data-save-data on <html> from navigator.connection.saveData.
            Law 7 names Save-Data and no shipping browser exposes it as a CSS
            media query, so the attribute is the only way CSS can honour it. */}
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
