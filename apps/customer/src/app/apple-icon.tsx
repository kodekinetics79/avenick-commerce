import { ImageResponse } from "next/og";
import { brandMarkDocument, isAvenick } from "@avenick/ui/brand-mark-geometry";
import { platformName } from "@avenick/utils/portal-config";
import { APP_ICON_SIZES } from "@/components/seo/app-icons";

/**
 * The plated app icon: the iOS home-screen icon, and the manifest's install icons.
 *
 * 180×180 is the size iOS actually asks for. It takes the MASTER cut rather than
 * the favicon's small cut — at 180px all four optical events are several pixels
 * each, which is the size the mark was drawn for.
 *
 * It gets a plate, and the favicon does not, for a reason that is about the
 * surface rather than the mark: a home screen composites this over an arbitrary
 * wallpaper and then masks the corners itself, so a transparent icon would drop
 * ink straight onto a photograph. The plate is the paper ground the rest of the
 * product sits on, which makes the tile the same material as the storefront.
 *
 * WHY THREE CUTS FROM ONE FILE. An Android home screen is the same surface, so
 * the manifest's 192px and 512px install icons are this icon at those sizes —
 * components/seo/app-icons.ts explains why they are not extra favicon sizes.
 * generateImageMetadata serves each at /apple-icon/<size>, and Next answers any
 * other id with a 404 before this function runs.
 */
export function generateImageMetadata() {
  return APP_ICON_SIZES.map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: "image/png",
  }));
}

export default function AppleIcon({ id }: { id: string }) {
  const px = Number(id);
  const name = platformName();
  const svg = brandMarkDocument({ size: px, title: name, theme: "light", plate: true });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  return new ImageResponse(
    isAvenick(name) ? (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={px} height={px} alt="" />
      </div>
    ) : (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(224 22% 11%)",
          color: "hsl(40 14% 94%)",
          // 104 on the 180px tile, held at the same proportion for every cut.
          fontSize: Math.round((px * 104) / 180),
          fontWeight: 600,
        }}
      >
        {name.trim().charAt(0).toUpperCase()}
      </div>
    ),
    { width: px, height: px },
  );
}
