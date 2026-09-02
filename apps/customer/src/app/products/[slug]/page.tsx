"use client";

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { ShoppingCart, Star, Heart, Truck, ShieldCheck, RotateCcw, Award, Minus, Plus, MessageSquare, Package, ChevronRight } from "lucide-react";
import { Button, Badge } from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import { MainLayout } from "@/components/layout/main-layout";
import { useCartStore } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { resolveStorefrontSelection, toStorefrontCartLine, toStorefrontWishlistItem, type StorefrontProduct } from "@/lib/catalog-commercial";
import { defaultStorefrontCurrency, type Currency } from "@/lib/market-context";
import { ReviewForm, type SubmittedReview } from "@/components/product/review-form";

type Review = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  isVerified?: boolean;
  createdAt: string;
  user?: { firstName: string; lastName: string };
  /** Set only on a review merged in from this visitor's own POST response. */
  mine?: boolean;
};

/**
 * What the reviews section may offer the current visitor. Answered by the
 * eligibility endpoint, which reloads the account and checks for a DELIVERED
 * order containing this product; the POST re-checks all of it.
 */
type ReviewAccess =
  | { state: "loading" }
  | { state: "ready"; eligible: boolean; reason: "anonymous" | "not-purchased" | "already-reviewed" | "ok" }
  | { state: "blocked"; message: string }
  | { state: "unknown" };

type Tab = "description" | "specs" | "reviews" | "shipping";

export default function ProductPage({ params, searchParams }: { params: { slug: string }; searchParams: { currency?: string; b2b?: string; variantId?: string; qty?: string } }) {
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState<Tab>("description");
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  const [reviewAccess, setReviewAccess] = useState<ReviewAccess>({ state: "loading" });
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

  const productUrl = useCallback((extra: Record<string, string> = {}) => {
    const currency = searchParams.currency?.toUpperCase();
    const query = new URLSearchParams({ ...(currency ? { currency } : {}), ...(searchParams.b2b === "true" ? { b2b: "true" } : {}), ...extra });
    return `/api/products/${params.slug}${query.size ? `?${query}` : ""}`;
  }, [params.slug, searchParams.currency, searchParams.b2b]);

  useEffect(() => {
    fetch(productUrl())
      .then((r) => r.json())
      .then((data) => {
        setProduct(data.data);
        setLoading(false);
        if (data.data) {
          const requestedQty = Number(searchParams.qty);
          setQty(Number.isInteger(requestedQty) && requestedQty >= (data.data.moq ?? 1) ? requestedQty : data.data.moq ?? 1);
          const variants = data.data.variants ?? [];
          setSelectedVariantId(variants.some((variant: { id: string }) => variant.id === searchParams.variantId)
            ? searchParams.variantId : variants.find((variant: { inStock: boolean }) => variant.inStock)?.id ?? variants[0]?.id);
        }
      })
      .catch(() => setLoading(false));
  }, [productUrl, searchParams.variantId, searchParams.qty]);

  useEffect(() => {
    let cancelled = false;
    setReviewAccess({ state: "loading" });
    fetch(`/api/products/${encodeURIComponent(params.slug)}/reviews/eligibility`)
      .then(async (r) => ({ ok: r.ok, payload: await r.json().catch(() => null) }))
      .then(({ ok, payload }) => {
        if (cancelled) return;
        if (ok && payload?.success && payload.data) setReviewAccess({ state: "ready", ...payload.data });
        else if (!ok && typeof payload?.error === "string") setReviewAccess({ state: "blocked", message: payload.error });
        else setReviewAccess({ state: "unknown" });
      })
      .catch(() => { if (!cancelled) setReviewAccess({ state: "unknown" }); });
    return () => { cancelled = true; };
  }, [params.slug]);

  /**
   * After a review is stored, re-read the product so the list and the average
   * come from the server. The public product response is edge-cached for a
   * minute, so the refetch carries the new review id as a cache key; if the
   * cached copy still wins, the stored review is merged in from the POST
   * response rather than pretending it was not saved.
   */
  const onReviewSubmitted = useCallback(async (review: SubmittedReview) => {
    setReviewAccess({ state: "ready", eligible: false, reason: "already-reviewed" });
    const mine: Review = { ...review, mine: true };
    // Merging the stored review into a copy the server produced BEFORE it
    // existed: the list gains a row, so the server's total must gain one too,
    // or the tab label and the rating row disagree with the list by exactly
    // one. When the server sent no total the page counts the list itself.
    const withMine = <T extends Record<string, unknown> & { reviews?: Review[]; reviewTotal?: unknown }>(source: T): T => ({
      ...source,
      reviews: [mine, ...(source.reviews ?? [])],
      ...(typeof source.reviewTotal === "number" ? { reviewTotal: source.reviewTotal + 1 } : {}),
    });
    const data = await fetch(productUrl({ reviewed: review.id })).then((r) => r.json()).catch(() => null);
    const fresh = data?.data as (Record<string, unknown> & { reviews?: Review[] }) | undefined;
    if (fresh) {
      const listed = (fresh.reviews ?? []).some((r) => r.id === review.id);
      setProduct(listed ? fresh : withMine(fresh));
      return;
    }
    // The refetch failed or was refused; the review is stored regardless, so
    // it is shown from the POST response rather than vanishing after submit.
    setProduct((current) => current ? withMine(current as Record<string, unknown> & { reviews?: Review[] }) : current);
  }, [productUrl]);

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
  const selection = resolveStorefrontSelection(p, selectedVariantId, qty, searchParams.currency?.toUpperCase() ?? defaultStorefrontCurrency());
  const seller = p.seller as Record<string, unknown>;
  const brand = p.brand as { nameEn?: string; nameAr?: string | null } | null | undefined;
  const inStock = selection?.inStock === true;
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const availabilityStatus = selectedVariant?.availabilityStatus
    ?? p.inventory[0]?.status
    ?? (inStock ? "IN_STOCK" : "OUT_OF_STOCK");
  const displayPrice = selection?.unitPrice ?? 0;
  const displayCurrency = (selection?.currency ?? defaultStorefrontCurrency()) as Currency;
  const vatRate = selection?.vatRate ?? 0;
  const vatPerUnit = selection?.vatPerUnit ?? 0;
  const productId = String(p.id);
  const wishlisted = has(productId, selection?.variantId);
  // More than one active price band in the resolved currency — on the variant
  // or on the product it falls back to — means the unit price depends on the
  // quantity. The cart records this so a later quantity change comes back here
  // to be repriced instead of being edited against a tier that may no longer apply.
  const priceTiered = selection
    ? [...(selectedVariant?.prices ?? []), ...p.prices].filter((price) => price.currency === selection.currency).length > 1
    : false;
  const reviews = (p.reviews as Review[]) ?? [];
  const reviewCount = reviews.length;
  // The catalog returns the most recent reviews, not the full history. The
  // headline count is the server's total when it sends one; without it the
  // page can only count what it was given, and says so ("recent").
  const reviewTotalKnown = typeof p.reviewTotal === "number";
  const reviewTotal = reviewTotalKnown ? (p.reviewTotal as number) : reviewCount;
  const avgRating = reviewCount > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10 : null;

  const TABS: { id: Tab; label: string }[] = [
    { id: "description", label: "Description" },
    { id: "specs", label: "Specifications" },
    { id: "reviews", label: `Reviews (${reviewTotal})` },
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
                    <span className="bg-card font-semibold px-4 py-2 rounded-full">
                      {availabilityStatus === "UNCONFIRMED" ? "Availability unconfirmed" : "Out of Stock"}
                    </span>
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
                    {!!brand?.nameEn && <p className="mb-1 text-sm font-semibold text-primary">{brand.nameEn}</p>}
                    <h1 className="text-2xl font-bold leading-tight">{String(p.nameEn)}</h1>
                    {!!p.nameAr && <p className="text-base text-muted-foreground mt-0.5" dir="rtl">{String(p.nameAr)}</p>}
                  </div>
                  <button type="button" disabled={!selection} aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"} onClick={() => selection && toggle({ ...toStorefrontWishlistItem(p, params.slug, selection, qty, searchParams.b2b === "true" ? "B2B" : "B2C", images[0]?.url), priceTiered })}
                    className={`p-2 rounded-xl border transition-all shrink-0 ${wishlisted ? "bg-destructive/10 border-destructive/20 text-destructive" : "border-border text-muted-foreground hover:border-destructive/20 hover:text-destructive"}`}>
                    <Heart className={`h-5 w-5 ${wishlisted ? "fill-current" : ""}`} />
                  </button>
                </div>

                {/* Rating row */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {avgRating == null ? <span className="text-sm text-muted-foreground">No reviews yet</span> : <>
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} className={`h-4 w-4 ${s <= Math.round(avgRating) ? "text-amber-400 fill-current" : "text-gray-200 fill-current"}`} />
                      ))}
                      <span className="text-sm font-semibold ms-1">{avgRating}</span>
                    </>}
                  </div>
                  <button type="button" onClick={() => scrollToSection("reviews")} className="text-sm text-primary hover:underline">
                    {reviewTotal} {reviewTotalKnown ? "" : "recent "}review{reviewTotal !== 1 ? "s" : ""}
                  </button>
                  <span className="text-muted-foreground text-sm">·</span>
                  <span className="text-sm text-muted-foreground">SKU: {selection?.sku ?? String(p.sku)}</span>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {!!p.origin && <Badge variant="secondary">{String(p.origin)}</Badge>}
                  {availabilityStatus === "IN_STOCK"
                    ? <Badge variant="success">In Stock</Badge>
                    : availabilityStatus === "UNCONFIRMED"
                      ? <Badge variant="info">Availability unconfirmed</Badge>
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
                    <span className="text-3xl font-bold text-primary">{formatCurrency(displayPrice, displayCurrency)}</span>
                    <span className="text-sm text-muted-foreground pb-1">+ {formatCurrency(vatPerUnit, displayCurrency)} VAT/unit ({vatRate}%)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Total with VAT: <strong>{formatCurrency(selection.grossTotal, displayCurrency)}</strong> for {qty} unit{qty !== 1 ? "s" : ""}</p>
                </> : <p className="text-sm font-medium text-destructive">No applicable price is available for this selection and quantity.</p>}
              </div>

              {/* Qty + CTA */}
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-border rounded-xl overflow-hidden">
                  <button type="button" disabled={!selection} onClick={() => setQty((q) => Math.max(Number(p.moq) || 1, q - 1))} className="p-2.5 hover:bg-muted transition-colors disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                  <span className="px-4 text-sm font-semibold min-w-[2.5rem] text-center">{qty}</span>
                  <button type="button" disabled={!selection || qty >= selection.availableQty} onClick={() => setQty((q) => q + 1)} className="p-2.5 hover:bg-muted transition-colors disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                </div>
                <Button size="lg" variant="primary" className="flex-1" disabled={!inStock || !selection}
                  onClick={() => selection && addItem({ ...toStorefrontCartLine(p, selection, qty, searchParams.b2b === "true" ? "B2B" : "B2C", images[0]?.url), priceTiered })}>
                  <ShoppingCart className="h-4 w-4 me-2" />
                  Add to Cart
                </Button>
              </div>
              {!inStock && seller && (
                <Link
                  href={`/b2b/rfq/new?supplier=${encodeURIComponent(String(seller.id ?? ""))}&product=${encodeURIComponent(productId)}`}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  <MessageSquare className="h-4 w-4" /> Request Availability
                </Link>
              )}
              {Number(p.moq) > 1 && <p className="text-xs text-muted-foreground -mt-3">Minimum order: {Number(p.moq)} units</p>}              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  // Every claim here must be backed by an implemented rule.
                  // "Verified Supplier" was asserted for every seller regardless
                  // of tier — the real tier is rendered from seller.tier below.
                  // "14-day returns" named a window that exists nowhere in the
                  // schema or services.
                  { icon: ShieldCheck, label: "Price checked at order", color: "text-primary" },
                  { icon: Truck, label: "Delivery at checkout", color: "text-primary" },
                  { icon: RotateCcw, label: "See returns policy", color: "text-purple-600" },
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
                      {/* Aggregated from this seller's product reviews by the
                          service. Absent when they have none — a seller with no
                          reviews shows no star rather than a zero. */}
                      {(() => {
                        const summary = seller.reviewSummary as { averageRating: number | null; reviewCount: number } | undefined;
                        if (!summary || summary.averageRating === null || summary.reviewCount === 0) return null;
                        return (
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-3.5 w-3.5 text-amber-400 fill-current" />
                            <span className="text-sm font-medium">{summary.averageRating.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">
                              · {summary.reviewCount} review{summary.reviewCount === 1 ? "" : "s"}
                            </span>
                          </div>
                        );
                      })()}
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
                <h3 className="text-base font-bold mb-4 text-foreground">Reviews ({reviewTotal})</h3>
                <div className="space-y-4">
                  {avgRating != null && <div className="flex items-center gap-4 pb-4 border-b border-border">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-primary">{avgRating}</p>
                      <div className="flex justify-center mt-1">
                        {[1,2,3,4,5].map((s) => <Star key={s} className={`h-4 w-4 ${s <= Math.round(avgRating) ? "text-amber-400 fill-current" : "text-secondary fill-current"}`} />)}
                      </div>
                      {/* The average is over the reviews shown, never over the total: when the
                          server reports more than it sent, the label says which subset it is. */}
                      <p className="text-xs text-muted-foreground mt-1">
                        {reviewTotal > reviewCount
                          ? `from the ${reviewCount} most recent review${reviewCount !== 1 ? "s" : ""}`
                          : `from ${reviewCount} ${reviewTotalKnown ? "" : "recent "}review${reviewCount !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>}

                  {/*
                    Who may write here is decided by the eligibility endpoint,
                    never by the page: a form is shown only to a signed-in
                    buyer with a DELIVERED order containing this product.
                    The "Verified" badge on a review means exactly that.
                  */}
                  {reviewAccess.state === "ready" && reviewAccess.reason === "ok" && (
                    <ReviewForm slug={params.slug} onSubmitted={onReviewSubmitted} />
                  )}
                  {reviewAccess.state === "ready" && reviewAccess.reason === "anonymous" && (
                    <p className="text-sm text-muted-foreground">
                      <Link href={`/login?callbackUrl=${encodeURIComponent(`/products/${params.slug}`)}`} className="text-primary hover:underline">Sign in</Link>
                      {" "}to review this product. Reviews are open to buyers who have received it.
                    </p>
                  )}
                  {reviewAccess.state === "ready" && reviewAccess.reason === "not-purchased" && (
                    <p className="text-sm text-muted-foreground">Only buyers who received this product can review it.</p>
                  )}
                  {reviewAccess.state === "ready" && reviewAccess.reason === "already-reviewed" && (
                    <p className="text-sm text-muted-foreground">You have already reviewed this product.</p>
                  )}
                  {reviewAccess.state === "blocked" && (
                    <p className="text-sm text-muted-foreground">{reviewAccess.message}</p>
                  )}
                  {reviewAccess.state === "unknown" && (
                    <p className="text-sm text-muted-foreground">Could not check whether you can review this product right now.</p>
                  )}

                  {reviewCount === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No reviews yet.</p>
                  ) : reviews.map((r) => {
                    // The author line never claims more than the row proves: a name when
                    // the API returned one, "You" for the review just merged from this
                    // visitor's own submit, otherwise a plain "Buyer" (the badge, not the
                    // name, carries the verified claim).
                    const author = r.user ? `${r.user.firstName} ${r.user.lastName.charAt(0)}.`.trim() : r.mine ? "You" : "Buyer";
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
                    { icon: Truck, title: "Delivery", desc: "Available delivery terms are confirmed during order processing." },
                    { icon: ShieldCheck, title: "Order protection", desc: "Price, tax and availability are revalidated when the order is submitted." },
                    { icon: RotateCcw, title: "Returns Policy", desc: "Return eligibility and any applicable window are confirmed against the published returns policy when a return is requested." },
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
