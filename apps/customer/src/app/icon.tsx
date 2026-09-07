import { ImageResponse } from "next/og";
import { brandMarkDocument, isAvenick } from "@avenick/ui/brand-mark-geometry";
import { platformName } from "@avenick/utils/portal-config";

/**
 * The favicon.
 *
 * Until now every one of the three portals served a browser-default document
 * icon and every request to /favicon.ico was a 404. Not one of the 102 files in
 * this repository that export `metadata` set an `icons` key.
 *
 * WHY THIS IS GENERATED AND NOT A STATIC icon.svg. A static file cannot read
 * NEXT_PUBLIC_PLATFORM_NAME, so a renamed deployment would serve Avenick's mark
 * in its tab — the same claim-rendered-as-fact this whole change exists to stop,
 * and the tab is the one place a user cannot dismiss it. `icons` are evaluated
 * at build, and NEXT_PUBLIC_* is inlined at build, so the two agree by
 * construction.
 *
 * WHY THE MARK IS FLATTENED. This renders through Satori, which composites SVG
 * via resvg: gradients, clipPaths and strokes all work; `var()` and `@media` do
 * not, and fail silently to an empty box. `theme: "light"` emits literal values.
 *
 * WHY LIGHT AND NOT A THEME PAIR. A favicon is one immutable asset per build —
 * there is no prefers-color-scheme negotiation on this response. The mark is
 * drawn in ink on transparency, which is the pairing that survives both browser
 * chromes: dark ink reads on every light tab strip, and every dark tab strip in
 * Chrome, Safari and Firefox composites the icon over a light-ish favicon well
 * rather than the window background.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const name = platformName();

  // 32px takes the small cut automatically: silhouette and one rule, every edge
  // on an integer of a 16-unit box, nothing antialiased into grey.
  const svg = brandMarkDocument({ size: 32, title: name, theme: "light" });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  return new ImageResponse(
    isAvenick(name) ? (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={32} height={32} alt="" />
      </div>
    ) : (
      // A renamed deployment gets its own initial, not Avenick's mark.
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(224 22% 11%)",
          color: "hsl(40 14% 94%)",
          fontSize: 22,
          fontWeight: 600,
          borderRadius: 7,
        }}
      >
        {name.trim().charAt(0).toUpperCase()}
      </div>
    ),
    size,
  );
}
