import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import { AuthProvider } from "@/components/auth-provider";
import { NavigationProgress } from "@/components/navigation-progress";
import { platformName } from "@avenick/utils/portal-config";
import "./globals.css";

// "The leading platform" (المنصة الرائدة) was a market-position claim nothing
// measures; the description now says what the platform is, not where it ranks.
export const metadata: Metadata = {
  title: { default: platformName(), template: `%s | ${platformName()}` },
  description: "B2B-first. B2C-ready. Built for modern trade. — منصة للتجارة الحديثة في الخليج",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("AVENICK_LOCALE")?.value ?? "en";
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('avenick-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&m)){document.documentElement.classList.add('dark');}}catch(e){}})();` }} />
      </head>
      <body>
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
