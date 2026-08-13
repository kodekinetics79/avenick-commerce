import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { fetchBackendJson } from "@/lib/backend";

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const categories = await fetchBackendJson<any[]>("/api/categories");
  const cat = categories.find((c) => c.slug === params.slug);
  return { title: cat ? `${cat.nameEn} | Avenick Commerce` : "Category" };
}

export default async function CategoryPage({ params }: Props) {
  const categories = await fetchBackendJson<any[]>("/api/categories");
  const category = categories.find((c) => c.slug === params.slug);
  if (!category) return notFound();

  const { products } = await fetchBackendJson<{ products: any[] }>(`/api/products?limit=24&b2c=true&categorySlug=${encodeURIComponent(params.slug)}`);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{category.nameAr}</h1>
          <p className="text-muted-foreground">{category.nameEn} — {products.length} products</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => {
            const price = p.prices?.[0];
            const stock = p.inventory?.[0];
            return (
              <ProductCard key={p.id} id={p.id} slug={p.slug} nameEn={p.nameEn} nameAr={p.nameAr} imageUrl={p.images?.[0]?.url} price={price ? Number(price.price) : 0} sku={p.sku} sellerId={p.sellerId} sellerName={p.seller?.businessNameEn} inStock={stock?.inStock === true} moq={p.moq} />
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
