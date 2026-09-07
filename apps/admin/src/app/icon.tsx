import { ImageResponse } from "next/og";
import { brandMarkDocument, isAvenick } from "@avenick/ui/brand-mark-geometry";
import { platformName } from "@avenick/utils/portal-config";

/**
 * The favicon. See apps/customer/src/app/icon.tsx for why this is generated
 * rather than a static icon.svg, and why the mark is flattened for Satori.
 *
 * The back office gets the same mark as the storefront, at the same size. A
 * portal-specific badge here would be a second brand rather than one brand in
 * two postures, and the tab strip is where an operator has both portals open
 * side by side — telling them apart is the window title's job, not the mark's.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const name = platformName();
  const svg = brandMarkDocument({ size: 32, title: name, theme: "light" });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  return new ImageResponse(
    isAvenick(name) ? (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={32} height={32} alt="" />
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
