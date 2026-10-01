/**
 * Prevent a manufacturer-hosted asset from being presented as another brand's
 * product. The pilot catalogue previously attached Mennekes product photos to
 * 3M, BG Nexus, and other rows; showing no photo is more trustworthy than
 * asserting the wrong physical item.
 *
 * This is an immediate publication gate, not a substitute for exact SKU/MPN
 * review. New manufacturer sources should be added only with an explicit brand
 * match and an auditable import mapping.
 */
export function isCatalogImageTrusted(
  url: string,
  brandName?: string | null,
  labels: Array<string | null | undefined> = [],
): boolean {
  const candidate = url.trim();
  if (!candidate) return false;

  const description = labels.filter(Boolean).join(" ").toLowerCase();
  if (description.includes("demo image") || description.includes("not the actual product")) {
    return false;
  }

  try {
    const parsed = new URL(candidate, "https://catalog.invalid");
    const hostname = parsed.hostname.toLowerCase();
    const brand = (brandName ?? "").trim().toLowerCase();

    if (hostname === "www.mennekes.org" || hostname === "mennekes.org") {
      return brand.includes("mennekes");
    }

    return true;
  } catch {
    return false;
  }
}

export function trustedCatalogImages<T extends {
  url: string;
  altText?: string | null;
  altEn?: string | null;
  altAr?: string | null;
}>(
  images: T[],
  brandName?: string | null,
): T[] {
  return images.filter((image) => isCatalogImageTrusted(
    image.url,
    brandName,
    [image.altText, image.altEn, image.altAr],
  ));
}

export type ReviewedManufacturerImage = {
  url: string;
  altEn: string;
  altAr: string;
  manufacturerPartNumber: string;
  sourcePage: string;
};

/**
 * Exact SKU → official manufacturer media mappings reviewed against the
 * manufacturer page, part number, and core electrical specifications. This
 * table is intentionally small: an unreviewed product keeps the neutral image
 * state instead of inheriting a visually similar item.
 */
const REVIEWED_MANUFACTURER_IMAGES: Record<string, ReviewedManufacturerImage> = {
  "PILOT-MENNEKES-ITM-004108": reviewedMennekes("13619"),
  "PILOT-MENNEKES-ITM-002302": reviewedMennekes("13620"),
  "PILOT-MENNEKES-ITM-004109": reviewedMennekes("13622"),
  "PILOT-MENNEKES-ITM-002303": reviewedMennekes("13624"),
  "PILOT-MENNEKES-ITM-004110": reviewedMennekes("13649"),
  "PILOT-MENNEKES-ITM-003851": reviewedMennekes("13625"),
  "PILOT-MENNEKES-ITM-004111": reviewedMennekes("13627"),
  "PILOT-MENNEKES-ITM-002304": reviewedMennekes("13629"),
  "PILOT-MENNEKES-130-0017395": reviewedMennekes("13202"),
  "PILOT-MENNEKES-130-0030408": reviewedMennekes("1457"),
  "PILOT-MENNEKES-130-0031116": reviewedMennekes("1491"),
  "PILOT-MENNEKES-130-0030435": reviewedMennekes("1128A"),
};

function reviewedMennekes(partNumber: string): ReviewedManufacturerImage {
  return {
    url: `https://www.mennekes.org/fileadmin/products_media/produktbilder/${partNumber}.png`,
    altEn: `Mennekes product ${partNumber}`,
    altAr: `منتج مينيكيس ${partNumber}`,
    manufacturerPartNumber: partNumber,
    sourcePage: `https://www.mennekes.org/industry/product-details/${partNumber}/`,
  };
}

export function reviewedManufacturerImage(sku: string): ReviewedManufacturerImage | null {
  return REVIEWED_MANUFACTURER_IMAGES[sku.trim().toUpperCase()] ?? null;
}
