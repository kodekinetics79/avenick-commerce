"use client";

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { ShoppingCart, Star, Heart, Truck, ShieldCheck, RotateCcw, Award, Minus, Plus, MessageSquare, Package, ChevronRight } from "lucide-react";
import { Button, Badge } from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import { MainLayout } from "@/components/layout/main-layout";
import { useCartStore } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { resolveStorefrontSelection, toStorefrontCartLine, type StorefrontProduct } from "@/lib/catalog-commercial";

type Review = { id: string; rating: number; title?: string | null; body?: string | null; isVerified?: boolean; createdAt: string; user?: { firstName: string; lastName: string } };

type Tab = "description" | "specs" | "reviews" | "shipping";

export default function ProductPage({ params }: { params: { slug: string } }) {
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState<Tab>("description");
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  const addItem = useCartStore((s) => s.addItem);
  const { toggle, has } = useWishlist();

  const scrollToSection = (id: Tab) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -110; 
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setTab(id);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const ids: Tab[] = ["description", "specs", "reviews", "shipping"];
      const scrollPosition = window.scrollY + 130;

      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && el.offsetTop <= scrollPosition) {
          setTab(ids[i]);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    fetch(`/api/products/${params.slug}`)
      .then((r) => r.json())
      .then((data) => {
        setProduct(data.data);
        setLoading(false);
        if (data.data) {
          setQty(data.data.moq ?? 1);
          const variants = data.data.variants ?? [];
          setSelectedVariantId(variants.find((variant: { inStock: boolean }) => variant.inStock)?.id ?? variants[0]?.id);
        }
      })
      .catch(() => setLoading(false));
  }, [params.slug]);

  if (loading) return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-4 bg-muted rounded w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="aspect-square bg-muted rounded-2xl" />
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-24 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </div>
      </div>
    </MainLayout>
  );

  if (!product) return notFound();

  const p = product as Record<string, unknown> & StorefrontProduct;
  const images = (p.images as { url: string }[]) ?? [];
  const variants = p.variants ?? [];
  const selection = resolveStorefrontSelection(p, selectedVariantId, qty);
  const seller = p.seller as Record<string, unknown>;
  const inStock = selection?.inStock === true;
  const displayPrice = selection?.unitPrice ?? 0;
  const displayCurrency = selection?.currency ?? "AED";
  const vatRate = selection?.vatRate ?? 0;
  const vatPerUnit = selection?.vatPerUnit ?? 0;
  const productId = String(p.id);
  const wishlisted = has(productId);
  const reviews = (p.reviews as Review[]) ?? [];
  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10 : 4.6;

  const TABS: { id: Tab; label: string }[] = [
    { id: "description", label: "Description" },
    { id: "specs", label: "Specifications" },
    { id: "reviews", label: `Reviews (${reviewCount})` },
    { id: "shipping", label: "Shipping & Returns" },
  ];

  return (
    <MainLayout>
      <div className="bg-background min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
            <Link href="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/products" className="hover:text-primary">Products</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate max-w-[200px]">{String(p.nameEn)}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Image gallery */}
            <div>
              <div className="aspect-square bg-card rounded-2xl border border-border overflow-hidden mb-3 relative group">
                {images[activeImage] ? (
                  <Image src={images[activeImage].url} alt={String(p.nameEn)} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 1024px) 100vw, 50vw" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Package className="h-16 w-16 mb-2 opacity-30" />
                    <p className="text-sm">No image available</p>
                  </div>
                )}
                {!inStock && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-card font-semibold px-4 py-2 rounded-full">Out of Stock</span>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button key={i} type="button" onClick={() => setActiveImage(i)}
                      className={`w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${activeImage === i ? "border-primary/100" : "border-border hover:border-primary/40"}`}>
                      <Image src={img.url} alt="" width={64} height={64} className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product info */}
            <div className="space-y-5">
              {/* Title + badges */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h1 className="text-2xl font-bold leading-tight">{String(p.nameEn)}</h1>
                    {!!p.nameAr && <p className="text-base text-muted-foreground mt-0.5" dir="rtl">{String(p.nameAr)}</p>}
                  </div>
                  <button type="button" aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"} onClick={() => toggle({ id: productId, slug: params.slug, nameEn: selection?.nameEn ?? String(p.nameEn), nameAr: selection?.nameAr ?? String(p.nameAr), imageUrl: images[0]?.url, price: displayPrice, currency: displayCurrency, sku: selection?.sku ?? String(p.sku), sellerId: String(p.sellerId), inStock })}
                    className={`p-2 rounded-xl border transition-all shrink-0 ${wishlisted ? "bg-destructive/10 border-destructive/20 text-destructive" : "border-border text-muted-foreground hover:border-destructive/20 hover:text-destructive"}`}>
                    <Heart className={`h-5 w-5 ${wishlisted ? "fill-current" : ""}`} />
                  </button>
                </div>

                {/* Rating row */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} className={`h-4 w-4 ${s <= Math.round(avgRating) ? "text-amber-400 fill-current" : "text-gray-200 fill-current"}`} />
                    ))}
                    <span className="text-sm font-semibold ms-1">{avgRating}</span>
                  </div>
                  <button type="button" onClick={() => scrollToSection("reviews")} className="text-sm text-primary hover:underline">
                    {reviewCount} reviews
                  </button>
                  <span className="text-muted-foreground text-sm">·</span>
                  <span className="text-sm text-muted-foreground">SKU: {selection?.sku ?? String(p.sku)}</span>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {!!p.origin && <Badge variant="secondary">{String(p.origin)}</Badge>}
                  {inStock
                    ? <Badge variant="success">In Stock</Badge>
                    : <Badge variant="error">Out of Stock</Badge>}
                  {!!p.isB2BEnabled && <Badge variant="info">B2B Available</Badge>}
                </div>
              </div>

              {variants.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-2 text-sm font-semibold">Select variant</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`rounded-xl border px-3 py-2 text-start text-sm transition-colors ${
                          selectedVariantId === variant.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="block font-medium">{variant.nameEn}</span>
                        <span className="block text-xs text-muted-foreground">
                          {Object.entries((variant.attributes ?? {}) as Record<string, unknown>).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") || variant.sku}
                          {!variant.inStock ? " · Out of stock" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price section */}
              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
                {selection ? <>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-3xl font-bold text-primary">{formatCurrency(displayPrice, displayCurrency as never)}</span>
                    <span className="text-sm text-muted-foreground pb-1">+ {formatCurrency(vatPerUnit, displayCurrency as never)} VAT/unit ({vatRate}%)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Total with VAT: <strong>{formatCurrency(selection.grossTotal, displayCurrency as never)}</strong> for {qty} unit{qty !== 1 ? "s" : ""}</p>
                </> : <p className="text-sm font-medium text-destructive">No applicable price is available for this selection and quantity.</p>}
              </div>

              {/* Qty + CTA */}
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-border rounded-xl overflow-hidden">
                  <button type="button" onClick={() => setQty((q) => Math.max(Number(p.moq) || 1, q - 1))} className="p-2.5 hover:bg-muted transition-colors"><Minus className="h-4 w-4" /></button>
                  <span className="px-4 text-sm font-semibold min-w-[2.5rem] text-center">{qty}</span>
                  <button type="button" onClick={() => setQty((q) => q + 1)} className="p-2.5 hover:bg-muted transition-colors"><Plus className="h-4 w-4" /></button>
                </div>
                <Button size="lg" variant="primary" className="flex-1" disabled={!inStock || !selection}
                  onClick={() => selection && addItem(toStorefrontCartLine(p, selection, qty, images[0]?.url))}>
                  <ShoppingCart className="h-4 w-4 me-2" />
                  {inStock ? "Add to Cart" : "Out of Stock"}
                </Button>
              </div>
              {Number(p.moq) > 1 && <p className="text-xs text-muted-foreground -mt-3">Minimum order: {Number(p.moq)} units</p>}              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: ShieldCheck, label: "Verified Supplier", color: "text-primary" },
                  { icon: Truck, label: "Free 200+ AED", color: "text-primary" },
                  { icon: RotateCcw, label: "14-day returns", color: "text-purple-600" },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex flex-col items-center gap-1 bg-card rounded-xl border border-border p-2.5 text-center">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
 
              {/* Seller */}
              {seller && (
                <div className="border border-border rounded-2xl p-4 bg-card">
                  <p className="text-xs text-muted-foreground mb-2">Sold by</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{String(seller.businessNameEn)}</p>
                      {!!seller.businessNameAr && <p className="text-sm text-muted-foreground" dir="rtl">{String(seller.businessNameAr)}</p>}
                      {!!seller.rating && (
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-current" />
                          <span className="text-sm font-medium">{Number(seller.rating).toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-end">
                      <Badge variant={seller.tier === "VERIFIED" ? "success" : seller.tier === "GOLD" ? "warning" : "secondary"}>
                        {String(seller.tier)}
                      </Badge>
                      <Link href={`/b2b/rfq/new?supplier=${String(seller.id ?? "")}`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                        <MessageSquare className="h-3 w-3" /> Request Quote
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-10 bg-card rounded-2xl border border-border overflow-hidden">
            <div className="flex border-b border-border overflow-x-auto sticky top-[64px] bg-card/95 backdrop-blur-md z-20">
              {TABS.map((t) => (
                <button key={t.id} type="button" onClick={() => scrollToSection(t.id)}
                  className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${tab === t.id ? "border-primary/100 text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6 divide-y divide-border">
              {/* Description */}
              <div id="description" className="pb-8 scroll-mt-28">
                <h3 className="text-base font-bold mb-4 text-foreground">Description</h3>
                <div className="prose prose-sm max-w-none">
                  {p.descriptionEn
                    ? <p className="text-muted-foreground leading-relaxed">{String(p.descriptionEn)}</p>
                    : <p className="text-muted-foreground italic">No description available.</p>}
                  {!!p.descriptionAr && <p className="text-muted-foreground leading-relaxed mt-4 text-right" dir="rtl">{String(p.descriptionAr)}</p>}
                </div>
              </div>

              {/* Specifications */}
              <div id="specs" className="py-8 scroll-mt-28">
                <h3 className="text-base font-bold mb-4 text-foreground">Specifications</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "SKU", value: String(p.sku) },
                    { label: "Origin", value: p.origin ? String(p.origin) : "—" },
                    { label: "Weight", value: p.weight ? `${String(p.weight)} kg` : "—" },
                    { label: "MOQ", value: `${Number(p.moq)} units` },
                    { label: "B2C Enabled", value: p.isB2CEnabled ? "Yes" : "No" },
                    { label: "B2B Enabled", value: p.isB2BEnabled ? "Yes" : "No" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-2.5 border-b border-border last:border-0 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews */}
              <div id="reviews" className="py-8 scroll-mt-28">
                <h3 className="text-base font-bold mb-4 text-foreground">Reviews ({reviewCount})</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b border-border">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-primary">{avgRating}</p>
                      <div className="flex justify-center mt-1">
                        {[1,2,3,4,5].map((s) => <Star key={s} className={`h-4 w-4 ${s <= Math.round(avgRating) ? "text-amber-400 fill-current" : "text-secondary fill-current"}`} />)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{reviewCount} review{reviewCount !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {reviewCount === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No reviews yet — be the first to review this product.</p>
                  ) : reviews.map((r) => {
                    const author = r.user ? `${r.user.firstName} ${r.user.lastName.charAt(0)}.`.trim() : "Verified buyer";
                    const date = new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    return (
                      <div key={r.id} className="py-4 border-b border-border last:border-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm text-foreground flex items-center gap-1.5">
                              {author}
                              {r.isVerified && <span className="text-[10px] font-semibold text-success bg-success/15 px-1.5 py-0.5 rounded-full">Verified</span>}
                            </p>
                            <div className="flex mt-0.5">
                              {[1,2,3,4,5].map((s) => <Star key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? "text-amber-400 fill-current" : "text-muted-foreground/25 fill-current"}`} />)}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{date}</span>
                        </div>
                        {r.title && <p className="text-sm font-semibold mb-0.5 text-foreground">{r.title}</p>}
                        {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Shipping */}
              <div id="shipping" className="pt-8 scroll-mt-28">
                <h3 className="text-base font-bold mb-4 text-foreground">Shipping & Returns</h3>
                <div className="space-y-4 text-sm text-muted-foreground">
                  {[
                    { icon: Truck, title: "Standard Delivery", desc: "2–5 business days. Free for orders over AED 200." },
                    { icon: ShieldCheck, title: "Express Delivery", desc: "Next business day available for most UAE locations." },
                    { icon: RotateCcw, title: "Returns Policy", desc: "14-day returns for B2C orders. Items must be unused and in original packaging." },
                    { icon: Award, title: "B2B Orders", desc: "Bulk orders may include special delivery terms. Contact your account manager." },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex gap-3">
                      <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div><p className="font-medium text-foreground">{title}</p><p className="text-muted-foreground">{desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
