import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { platformName } from "@avenick/utils/portal-config";

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
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
