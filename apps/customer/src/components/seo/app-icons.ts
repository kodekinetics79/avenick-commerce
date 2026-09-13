/**
 * The pixel sizes the plated app icon is cut at, one route each:
 * `/apple-icon/180`, `/apple-icon/192`, `/apple-icon/512`.
 *
 * 180 is what iOS asks for. 192 and 512 are the two sizes a web app manifest is
 * expected to carry. Chrome will not offer to install a manifest without them,
 * and Android draws the home-screen icon and the launch splash from them. Until
 * now the manifest listed only the 32px favicon and the 180px iOS icon, so an
 * install was either refused or scaled up from a thumbnail.
 *
 * They live beside apple-icon.tsx rather than icon.tsx because the plate is
 * what a home screen needs. icon.tsx is the tab favicon, drawn as ink on
 * transparency for a tab strip. Emitting a 512px plated tile as another
 * `<link rel="icon">` would let a browser choose it for the tab. The iOS icon is
 * already the plated master cut, composed for exactly this surface: an
 * arbitrary wallpaper the launcher masks.
 *
 * Shared by apple-icon.tsx and manifest.ts, so the manifest cannot name a size
 * no route draws.
 */
export const APP_ICON_SIZES = [180, 192, 512] as const;

export type AppIconSize = (typeof APP_ICON_SIZES)[number];

/** The route that serves one cut. */
export function appIconPath(size: AppIconSize): string {
  return `/apple-icon/${size}`;
}
