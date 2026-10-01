import { describe, expect, it } from "vitest";

import { ImageSchema } from "@avenick/contracts";

import { absoluteUrl, slugOrNull, toImage, toMoney, toTimestamp } from "../dto";

/**
 * THE IMAGE DECISION, ENCODED.
 *
 * `ImageSchema.width`/`.height` are optional and `ProductImage` has no such
 * columns, so `toImage` is the single place that decides whether a size is
 * claimed at all. The rule it enforces has three parts and these tests are the
 * guard on each: derive where the URL genuinely states it, send the picture
 * WITHOUT a size where it does not, and never bridge the gap with a number
 * nobody measured — a guessed intrinsic size makes Flutter reserve the wrong
 * box, so every tile re-lays out when the real bytes arrive and the grid jumps
 * on every scroll.
 */
const ORIGIN = "https://shop.test";

describe("toImage: derived, or nothing", () => {
  it("derives the size a placehold.co URL states in its path", () => {
    const image = toImage(
      { url: "https://placehold.co/600x480/FFD700/000?text=Helmet", alt: "A helmet" },
      ORIGIN,
    );
    expect(image).toEqual({
      url: "https://placehold.co/600x480/FFD700/000?text=Helmet",
      width: 600,
      height: 480,
      alt: "A helmet",
    });
    expect(ImageSchema.safeParse(image).success).toBe(true);
  });

  it("derives the size a CDN states in its query", () => {
    expect(toImage({ url: "https://cdn.test/a.jpg?w=1200&h=800" }, ORIGIN)).toMatchObject({
      width: 1200,
      height: 800,
    });
    expect(toImage({ url: "https://cdn.test/a.jpg?width=64&height=64" }, ORIGIN)).toMatchObject({
      width: 64,
      height: 64,
    });
  });

  it("SENDS THE PICTURE WITHOUT A SIZE rather than inventing one", () => {
    // This is the pilot catalogue's shape: <assetBaseUrl>/<filename>, with the
    // dimensions nowhere. A square guess here is a grid that jumps; a null here
    // is a storefront with no pictures. The image goes, the claim does not.
    const image = toImage({ url: "https://assets.test/pilot/bolt-m6.jpg" }, ORIGIN);
    expect(image).toEqual({ url: "https://assets.test/pilot/bolt-m6.jpg", alt: null });
    // Absent KEYS, not explicit undefined: the JSON carries no claim either way.
    expect(Object.keys(image!)).not.toContain("width");
    expect(Object.keys(image!)).not.toContain("height");
    expect(ImageSchema.safeParse(image).success).toBe(true);
  });

  it("never emits half a size, because half a size reserves nothing", () => {
    // A width with no height is not an aspect ratio. The contract cannot refuse
    // it — a refinement would make Image a ZodEffects and break the $ref every
    // other schema shares — so this function is where the guarantee lives.
    for (const url of [
      "https://cdn.test/a.jpg?w=1200",
      "https://cdn.test/a.jpg?height=800",
      "https://cdn.test/a.jpg?w=0&h=800",
    ]) {
      const image = toImage({ url }, ORIGIN)!;
      expect(Object.hasOwn(image, "width")).toBe(Object.hasOwn(image, "height"));
      expect(image.width).toBeUndefined();
    }
  });

  it("does not mistake a part number for a size", () => {
    // "12x24" is a thread spec in an industrial catalogue, not a pixel count,
    // so the picture ships unsized rather than shaped like a bolt spec.
    const image = toImage({ url: "https://assets.test/parts/12x24-bolt.jpg" }, ORIGIN);
    expect(image?.width).toBeUndefined();
    expect(image?.url).toBe("https://assets.test/parts/12x24-bolt.jpg");
  });

  it("resolves a relative path against the app's own origin", () => {
    // Half the image columns in this database hold one: /brands/demo-3m.svg
    // from the demo logo script, /images/... from the seed. `z.string().url()`
    // refuses those, and they are served by this very app.
    expect(toImage({ url: "/media/600x600/helmet.jpg" }, ORIGIN)?.url)
      .toBe("https://shop.test/media/600x600/helmet.jpg");
  });

  it("STATES THE FIX: a brand logo now reaches the app, unsized", () => {
    // `scripts/demo-brand-logos.mjs` writes /brands/demo-<slug>.svg, and an SVG
    // carries no pixel size in its URL. While width/height were REQUIRED this
    // had to serialise as `logo: null` and the brand strip was a row of gaps.
    expect(toImage({ url: "/brands/demo-3m.svg", alt: "3M" }, ORIGIN)).toEqual({
      url: "https://shop.test/brands/demo-3m.svg",
      alt: "3M",
    });
  });

  it("still answers null when there is genuinely no image", () => {
    // Null means NO IMAGE, and only that — it must not go on meaning
    // "an image whose size we could not work out".
    expect(toImage({ url: null }, ORIGIN)).toBeNull();
    expect(toImage({ url: "   " }, ORIGIN)).toBeNull();
  });

  it("refuses a scheme a phone cannot fetch", () => {
    expect(toImage({ url: "javascript:alert(1)" }, ORIGIN)).toBeNull();
    expect(toImage({ url: "data:image/png;base64,AAAA" }, ORIGIN)).toBeNull();
  });

  it("keeps alt within the contract's bound, and null when there is none", () => {
    expect(toImage({ url: "https://placehold.co/10x10/x", alt: null }, ORIGIN)?.alt).toBeNull();
    const long = toImage({ url: "https://placehold.co/10x10/x", alt: "a".repeat(400) }, ORIGIN);
    expect(long?.alt).toHaveLength(300);
    expect(ImageSchema.safeParse(long).success).toBe(true);
  });
});

describe("absoluteUrl", () => {
  it("answers null for a value that is not a URL, rather than failing the response", () => {
    // Used for vatInvoiceUrl: "no invoice link" is a smaller wrong answer than
    // "this order cannot be displayed".
    expect(absoluteUrl("not a url at all", "")).toBeNull();
    expect(absoluteUrl("", ORIGIN)).toBeNull();
    expect(absoluteUrl(null, ORIGIN)).toBeNull();
    expect(absoluteUrl("https://files.test/invoice.pdf", ORIGIN)).toBe("https://files.test/invoice.pdf");
  });
});

describe("money and time", () => {
  it("reads a Decimal through its exact string, never a float parse", () => {
    // Prisma hands money back as a Decimal; `toString()` is exact and
    // `toFixed(2)` mirrors composeOrderTotals' own money() helper.
    expect(toMoney({ toString: () => "1234.50" })).toBe(1234.5);
    expect(toMoney({ toString: () => "0.10" })).toBe(0.1);
    expect(toMoney(19.999)).toBe(20);
  });

  it("states an instant the way the contract parses it", () => {
    expect(toTimestamp(new Date("2026-03-04T05:06:07.000Z"))).toBe("2026-03-04T05:06:07.000Z");
  });
});

describe("slugOrNull", () => {
  it("refuses a slug the contract's pattern would reject", () => {
    expect(slugOrNull("safety-helmet")).toBe("safety-helmet");
    // The pilot importer truncates with .slice(0, 90) AFTER stripping edge
    // hyphens, so a cut landing just past one leaves this behind.
    expect(slugOrNull("pilot-bolt-")).toBeNull();
    expect(slugOrNull("Safety_Helmet")).toBeNull();
    expect(slugOrNull(null)).toBeNull();
  });
});
