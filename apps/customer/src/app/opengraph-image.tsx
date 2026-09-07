import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { brandMarkDocument } from "@avenick/ui/brand-mark-geometry";
import { platformName } from "@avenick/utils/portal-config";

/**
 * The share card.
 *
 * Every link shared out of any of the three portals used to render as a bare
 * title and description with no image, because no file in the repository set
 * `openGraph`, `twitter`, or a `metadataBase` for either to resolve against.
 *
 * WHAT IS ON IT, AND WHAT IS DELIBERATELY NOT. The mark, the configured name,
 * and the same one-sentence description the page's own `<meta>` carries — every
 * one of which is a fact this deployment already holds.
 *
 * There is no supplier count, no "trusted by", no rating, no category montage
 * and no product photography. LAW F: a share card is exactly where a marketplace
 * invents "2,400+ suppliers" because the composition looks empty without it, and
 * §10.12 calls filling a hole with fiction the only failure that ends the
 * project. The card is composed to be correct while empty instead — the mark,
 * the rule, and one true sentence, on the paper ground.
 *
 * The ruled ground is the field's ruling at the same 1px hairline rhythm, drawn
 * as a repeating gradient rather than the live `<AmbientField>`, which cannot
 * run here: this is a static raster with no drift, no coprime keyframes and no
 * viewport. Two of the three field lobes would be a second ambient field
 * (§9) if they moved; frozen ruling on a plate is the register, not the field.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Avenick";

export default async function OpengraphImage() {
  const name = platformName();
  const t = await getTranslations("common");

  const svg = brandMarkDocument({ size: 132, title: name, theme: "light" });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  // THE RULED GROUND, as an image rather than a CSS gradient.
  //
  // Satori rejects `repeating-linear-gradient` outright — "Invalid background
  // image" — and it does so at render time, so the failure arrives as a 500 on
  // the share card and as no image at all in the crawler, which is the silent
  // half. It also rejects CSS Color 4's space-separated `hsl()` with a slash
  // alpha inside a gradient, so neither the syntax nor the function was
  // salvageable.
  //
  // An <img> carrying a data: URI SVG is the mechanism the mark already proves
  // works here: Satori composites it through resvg, which has a complete SVG
  // implementation and no opinion about CSS gradient grammar.
  const rules = Array.from({ length: Math.floor(630 / 26) }, (_, i) =>
    `<rect y="${i * 26}" width="1200" height="1" fill="rgb(22,25,34)" fill-opacity="0.045"/>`,
  ).join("");
  const ground =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<rect width="1200" height="630" fill="rgb(250,249,247)"/>${rules}</svg>`;
  const groundSrc = `data:image/svg+xml;base64,${Buffer.from(ground, "utf8").toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "72px 80px",
          background: "rgb(250,249,247)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={groundSrc}
          width={1200}
          height={630}
          alt=""
          style={{ position: "absolute", top: 0, left: 0 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={132} height={132} alt="" />
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 600,
              color: "hsl(224 22% 11%)",
              letterSpacing: "-0.02em",
            }}
          >
            {name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {/* The brass rule, drawn from the inline start — the same gesture the
              mark carries, at the scale of the card. */}
          <div style={{ display: "flex", width: 132, height: 5, background: "hsl(36 56% 42%)" }} />
          <div
            style={{
              display: "flex",
              fontSize: 34,
              lineHeight: 1.35,
              color: "hsl(224 14% 32%)",
              maxWidth: 900,
            }}
          >
            {t("metaDescription")}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
