import { describe, expect, it } from "vitest";
import {
  isCatalogImageTrusted,
  reviewedManufacturerImage,
  trustedCatalogImages,
} from "../catalog-image-integrity";

describe("catalog image integrity gate", () => {
  it("quarantines Mennekes-hosted images attached to a different brand", () => {
    const url = "https://www.mennekes.org/fileadmin/products_media/produktbilder/13501.png";
    expect(isCatalogImageTrusted(url, "3M")).toBe(false);
    expect(isCatalogImageTrusted(url, "BG Nexus")).toBe(false);
    expect(isCatalogImageTrusted(url, null)).toBe(false);
  });

  it("retains manufacturer-hosted images only for the matching brand", () => {
    const url = "https://www.mennekes.org/fileadmin/products_media/produktbilder/13501.png";
    expect(isCatalogImageTrusted(url, "MENNEKES Electric GmbH")).toBe(true);
  });

  it("quarantines explicitly marked demo images even when the brand matches", () => {
    const url = "https://www.mennekes.org/fileadmin/products_media/produktbilder/13501.png";
    expect(isCatalogImageTrusted(url, "Mennekes", ["[DEMO IMAGE — not the actual product]"])).toBe(
      false,
    );
    expect(
      trustedCatalogImages(
        [
          {
            url,
            altEn: "[DEMO IMAGE — not the actual product] Mennekes",
          },
        ],
        "Mennekes",
      ),
    ).toEqual([]);
  });

  it("keeps neutral or first-party image sources and rejects empty values", () => {
    expect(isCatalogImageTrusted("/media/product.png", "3M")).toBe(true);
    expect(isCatalogImageTrusted("https://cdn.avenick.com/product.png", "3M")).toBe(true);
    expect(isCatalogImageTrusted("   ", "3M")).toBe(false);
  });

  it("filters a mixed gallery without mutating the approved records", () => {
    const approved = { url: "https://cdn.avenick.com/3m-lubricant.png", altText: "3M lubricant" };
    expect(
      trustedCatalogImages(
        [
          {
            url: "https://www.mennekes.org/fileadmin/products_media/produktbilder/13501.png",
            altText: "wrong",
          },
          approved,
        ],
        "3M",
      ),
    ).toEqual([approved]);
  });

  it("returns only exact, reviewed manufacturer mappings", () => {
    expect(reviewedManufacturerImage("PILOT-MENNEKES-ITM-004108")).toMatchObject({
      manufacturerPartNumber: "13619",
      url: "https://www.mennekes.org/fileadmin/products_media/produktbilder/13619.png",
      sourcePage: "https://www.mennekes.org/industry/product-details/13619/",
    });
    expect(reviewedManufacturerImage("PILOT-MENNEKES-ITM-004107")).toMatchObject({
      manufacturerPartNumber: "13516",
      url: "https://www.mennekes.org/fileadmin/products_media/produktbilder/13516.png",
      sourcePage: "https://www.mennekes.org/industry/product-details/13516/",
    });
    expect(reviewedManufacturerImage("PILOT-3M-ITM-004049")).toBeNull();
  });
});
