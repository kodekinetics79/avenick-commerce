import { CategoryBreadcrumbJsonLd } from "@/components/seo/category-breadcrumb";

/**
 * The category segment's layout exists to carry the page's structured data.
 *
 * A layout receives the route params and renders around the page, and the
 * breadcrumb markup is a function of the slug alone, so it sits here rather than
 * inside the page's body. The page keeps its own rendering untouched.
 *
 * It holds no loading state, deliberately. A loading.tsx at this segment would
 * flush a 200 before the page's notFound() runs, and turn every unknown category
 * back into a soft 404.
 */
export default function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return (
    <>
      <CategoryBreadcrumbJsonLd slug={params.slug} />
      {children}
    </>
  );
}
