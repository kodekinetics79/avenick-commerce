import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AuthProvider } from "@/components/auth-provider";
import { AmbientField } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `Admin Console | ${platformName()}`, template: "%s | Admin" },
  description: `${platformName()} Admin Console`,
};

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
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
