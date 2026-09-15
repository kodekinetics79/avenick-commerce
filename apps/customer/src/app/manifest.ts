import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { platformName } from "@avenick/utils/portal-config";
import { APP_ICON_SIZES, appIconPath } from "@/components/seo/app-icons";

/**
 * The web app manifest.
 *
 * `apps/customer/next.config.mjs` already allows `manifest-src 'self'` in the
 * spatial-commerce CSP, so a manifest was anticipated and then never shipped.
 * Without one, an installed storefront gets the document title and a screenshot
 * of the page as its icon.
 *
 * Every string comes from the message tree or from configuration, and the icons
 * point at the generated routes, so a renamed deployment gets its own name and
 * its own initial here too.
 *
 * `theme_color` is the paper ground rather than the brand green: it paints the
 * browser's own chrome around the app, and the storefront's chrome is a glass
 * bar over that ground, not a green bar. A green address bar above a paper page
 * is the seam a native-feeling install is supposed to hide.
 *
 * The icons were the 32px favicon and the 180px iOS icon, and nothing larger.
 * Chrome expects 192px and 512px icons before it offers an install, and Android
 * draws the home-screen icon and splash from them, so the stated aim above —
 * not a screenshot for an icon — was not actually met. The plated cuts come
 * from app-icons.ts, the same list apple-icon.tsx draws from.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("common");
  const name = platformName();

  return {
    name,
    short_name: name,
    description: t("metaDescription"),
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f7",
    theme_color: "#faf9f7",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      ...APP_ICON_SIZES.map((px) => ({
        src: appIconPath(px),
        sizes: `${px}x${px}`,
        type: "image/png",
        purpose: "any" as const,
      })),
    ],
  };
}
