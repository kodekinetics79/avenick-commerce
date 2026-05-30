import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@manzil/database";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = await db.category.findUnique({ where: { slug: params.slug } });
  return { title: cat ? `${cat.nameEn} | Avenick Commerce` : "Category" };
}

export default async function CategoryPage({ params }: Props) {
  const category = await db.category.findUnique({ where: { slug: params.slug } });
  if (!category) return notFound();

  const products = await db.product.findMany({
    where: { categoryId: category.id, status: "ACTIVE", deletedAt: null },
    take: 24,
    orderBy: { publishedAt: "desc" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      prices: { where: { isActive: true }, take: 1 },
      seller: { select: { businessNameEn: true } },
      inventory: { select: { qty: true, reservedQty: true }, take: 1 },
    },
  });

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{category.nameAr}</h1>
          <p className="text-muted-foreground">{category.nameEn} — {products.length} products</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => {
            const price = p.prices[0];
            const stock = p.inventory[0];
            return (
              <ProductCard key={p.id} id={p.id} slug={p.slug} nameEn={p.nameEn} nameAr={p.nameAr} imageUrl={p.images[0]?.url} price={price ? Number(price.price) : 0} sku={p.sku} sellerId={p.sellerId} sellerName={p.seller.businessNameEn} inStock={stock ? stock.qty - stock.reservedQty > 0 : false} moq={p.moq} />
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
