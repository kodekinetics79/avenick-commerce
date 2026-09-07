import { ImageResponse } from "next/og";
import { brandMarkDocument, isAvenick } from "@avenick/ui/brand-mark-geometry";
import { platformName } from "@avenick/utils/portal-config";

/** The iOS home-screen icon. See apps/customer/src/app/apple-icon.tsx. */
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
