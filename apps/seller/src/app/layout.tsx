import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AuthProvider } from "@/components/auth-provider";
import { AmbientField, RevealRoot } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `Seller Central | ${platformName()}`, template: "%s | Seller Central" },
  description: `${platformName()} Seller Central — manage your store`,
};

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
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
