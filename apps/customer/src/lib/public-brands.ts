import { db } from "@avenick/database";

/**
 * What "has something to sell" means, in one place.
 *
 * The count and the existence test MUST use the same predicate. When they
 * differed, a brand could be listed because it had an ACTIVE product while the
 * count only saw discoverable ones — a tile advertising "0 listings" that the
 * query itself had just judged worth showing.
 */
const PUBLICLY_VISIBLE = {
  status: "ACTIVE",
  deletedAt: null,
  isPubliclyDiscoverable: true,
} as const;

export interface PublicBrand {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
  logoUrl: string | null;
  _count: { products: number };
}

/**
 * The brands a shopper may browse, with a live count of their sellable listings.
 *
 * Read directly by the pages that need it, for the same reason the category
 * tree is: /products, /search and /brands render this on the server, and doing
 * that by FETCHING THE APP'S OWN HTTP ROUTE turns each page render into an
 * anonymous request from the app to itself. It then carries the app's address
 * rather than the visitor's, so a per-IP throttle counts every render in the
 * world against one bucket and the brand filter empties for everybody once it
 * fills. The route below still exists for real clients and calls this.
 */
export async function readPublicBrands(): Promise<PublicBrand[]> {
  const rows = await db.brand.findMany({
    where: {
      isActive: true,
      // A brand with nothing to sell is a shelf with nothing on it. The catalogue
      // strip already refuses to advertise a category with no visible product —
      // see the comment in app/page.tsx — and a brand tile is the same promise.
      // The live data made the cost obvious: EATON, Navigator, a second 3M and a
      // Honeywell all sat on the brands page reading "0 listings", so a third of
      // the grid led nowhere.
      products: { some: PUBLICLY_VISIBLE },
    },
    include: { _count: { select: { products: { where: PUBLICLY_VISIBLE } } } },
    orderBy: { nameEn: "asc" },
  });
  return rows as unknown as PublicBrand[];
}
