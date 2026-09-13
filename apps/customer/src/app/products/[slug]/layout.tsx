import type { Metadata } from "next";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { platformName } from "@avenick/utils/portal-config";
import { isUnservable, productMetadata, readProductMeta } from "./product-meta";

type Params = { params: { slug: string } };

/**
 * The server half of the product page: its document head and its HTTP status.
 * See product-meta.ts for why this layout exists and what it will not do.
 *
 * `cache` makes generateMetadata and the layout body one database read per
 * request rather than two. It lives here rather than in product-meta.ts because
 * it is a server-renderer API: the module stays importable by a plain unit test.
 */
const read = cache(readProductMeta);

/**
 * NOT notFound() here, on purpose; the layout body below refuses the URL. When
 * generateMetadata throws a not-found, Next 14.2 resolves the head a second
 * time for the not-found view over the SAME segment tree, which runs this
 * function again, which throws again, and the second failure leaves the 404
 * with no head at all: no <title>, only the framework's noindex. Measured on
 * /products/<unknown>: the soft 404 this replaced at least said the platform's
 * name, and the first version of this layout said nothing.
 *
 * So an unservable slug gets a noindex head from here, which is also what
 * reaches the server HTML while a root loading boundary is still streaming the
 * status as 200. The layout body's notFound() supplies the plate and the 404.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const result = await read(params.slug);
  if (isUnservable(result)) return { robots: { index: false, follow: false } };
  if (result.kind !== "found") return {};

  const locale = cookies().get("AVENICK_LOCALE")?.value === "ar" ? "ar" : "en";
  const t = await getTranslations("pdp");
  return productMetadata(result.product, {
    locale,
    siteName: platformName(),
    describe: ({ name, brand, sku }) =>
      brand ? t("meta.descriptionBrand", { name, brand, sku }) : t("meta.description", { name, sku }),
  });
}

/**
 * A slug that names nothing is refused HERE, on the server, before the client
 * page has rendered anything — so the not-found plate, its noindex and the 404
 * status all arrive in the first response instead of after hydration. The page's
 * own client-side notFound() stays for what only it can see: a listing this
 * viewer's channel may not open.
 */
export default async function ProductLayout({ children, params }: Params & { children: React.ReactNode }) {
  if (isUnservable(await read(params.slug))) notFound();
  return children;
}
