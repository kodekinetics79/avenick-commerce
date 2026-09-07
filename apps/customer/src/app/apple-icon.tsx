import { ImageResponse } from "next/og";
import { brandMarkDocument, isAvenick } from "@avenick/ui/brand-mark-geometry";
import { platformName } from "@avenick/utils/portal-config";

/**
 * The iOS home-screen icon.
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
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const name = platformName();
  const svg = brandMarkDocument({ size: 180, title: name, theme: "light", plate: true });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  return new ImageResponse(
    isAvenick(name) ? (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={180} height={180} alt="" />
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
          fontSize: 104,
          fontWeight: 600,
        }}
      >
        {name.trim().charAt(0).toUpperCase()}
      </div>
    ),
    size,
  );
}
