import { db } from "@avenick/database";

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
  return (await db.brand.findMany({
    where: { isActive: true },
    include: { _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } } },
    orderBy: { nameEn: "asc" },
  })) as unknown as PublicBrand[];
}
