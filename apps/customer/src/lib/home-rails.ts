import {
  getStorefrontProductsBySkus,
  getStorefrontSections,
  getTrendingProducts,
  listBrandsWithLogos,
} from "@avenick/database";
import { toCatalogListDto } from "@/lib/catalog-list-dto";
import { REVIEWED_MANUFACTURER_IMAGE_SKUS } from "@/lib/catalog-image-integrity";

type Row = Record<string, any>;

export interface HomeRails {
  bestSellers: Row[];
  newArrivals: Row[];
  topRated: Row[];
  featured: Row[];
  trending: Row[];
  verifiedMedia: Row[];
  brands: Row[];
}

export const EMPTY_HOME_RAILS: HomeRails = {
  bestSellers: [],
  newArrivals: [],
  topRated: [],
  featured: [],
  trending: [],
  verifiedMedia: [],
  brands: [],
};

/**
 * The readers the home page depends on, injectable so the degradation below is
 * testable without a database.
 */
export interface HomeRailReaders {
  sections: typeof getStorefrontSections;
  brands: typeof listBrandsWithLogos;
  trending: typeof getTrendingProducts;
  verifiedMedia: typeof getStorefrontProductsBySkus;
  onError?: (source: string, error: unknown) => void;
}

const DEFAULT_READERS: HomeRailReaders = {
  sections: getStorefrontSections,
  brands: listBrandsWithLogos,
  trending: getTrendingProducts,
  verifiedMedia: getStorefrontProductsBySkus,
};

/**
 * Every rail on the home page, from one call.
 *
 * The rows go through toCatalogListDto exactly as /api/products does, and that
 * is not a convenience — the DTO is where catalogue PRICE PRIVACY lives. It
 * decides which prices a channel may see and what the card is allowed to quote.
 * Reading the rows straight out of the service and shaping them here would
 * route around that rule, and the page would leak B2B pricing to an anonymous
 * visitor without anything failing.
 *
 * `rating` is re-attached after the DTO because the DTO builds a fresh object
 * and knows nothing about reviews.
 *
 * WHY THE READS ARE NOT ONE Promise.all. They were, and it cost the whole
 * storefront: on a database without the ProductViewSignal table the trend query
 * rejected, the combined promise rejected with it, and the catch below returned
 * six empty rails — a home page with no products at all because an OPTIONAL
 * signal was unavailable. The catalogue is the page's reason to exist; the
 * trend rail and the brand strip are garnish. So each optional source degrades
 * to [] on its own, and only a catalogue failure can empty the page.
 */
export async function loadHomeRails(readers: Partial<HomeRailReaders> = {}): Promise<HomeRails> {
  const { sections, brands, trending, verifiedMedia, onError } = {
    ...DEFAULT_READERS,
    ...readers,
  };
  const optional = async <T>(source: string, read: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await read();
    } catch (error) {
      onError?.(source, error);
      return [];
    }
  };

  const [sectionRows, brandRows, trendingRows, verifiedMediaRows] = await Promise.all([
    sections({ limit: 10 }).catch((error: unknown) => {
      onError?.("sections", error);
      return null;
    }),
    optional("brands", () => brands({ limit: 12 })),
    // Legitimately empty until the view signal has something to say. The panel
    // treats that as the normal case and shows the block only when it has rows
    // — nothing here invents a trend from an empty table.
    optional("trending", () => trending({ limit: 6 })),
    optional("verified manufacturer media", () =>
      verifiedMedia(REVIEWED_MANUFACTURER_IMAGE_SKUS, { limit: 8 }),
    ),
  ]);

  if (!sectionRows) {
    return {
      ...EMPTY_HOME_RAILS,
      brands: brandRows as Row[],
      verifiedMedia: verifiedMediaRows.map((row) => toCatalogListDto(row as any, "B2C")),
    };
  }

  const shape = (rows: Row[]) =>
    rows.map((row) => ({ ...toCatalogListDto(row as any, "B2C"), rating: row["rating"] ?? null }));

  return {
    bestSellers: shape(sectionRows.bestSellers as Row[]),
    newArrivals: shape(sectionRows.newArrivals as Row[]),
    topRated: shape(sectionRows.topRated as Row[]),
    featured: shape(sectionRows.featured as Row[]),
    trending: shape(trendingRows as Row[]),
    verifiedMedia: shape(verifiedMediaRows as Row[]),
    brands: brandRows as Row[],
  };
}
