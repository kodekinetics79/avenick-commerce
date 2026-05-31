import Link from "next/link";
import {
  ArrowRight,
  Factory,
  Briefcase,
  Cpu,
  ShieldAlert,
  UtensilsCrossed,
  Building2,
  ShieldCheck,
  Truck,
  BadgeCheck,
  Sparkles,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { db } from "@avenick/database";

const CATEGORIES = [
  { slug: "industrial-supplies", nameEn: "Industrial", icon: Factory },
  { slug: "electronics", nameEn: "Electronics", icon: Cpu },
  { slug: "office-supplies", nameEn: "Office", icon: Briefcase },
  { slug: "safety-ppe", nameEn: "Safety & PPE", icon: ShieldAlert },
  { slug: "food-hospitality", nameEn: "Hospitality", icon: UtensilsCrossed },
  { slug: "building-materials", nameEn: "Building", icon: Building2 },
];

const PARTNERS = ["SKF", "EATON", "NSK", "TIMKEN", "ABB", "BOSCH", "SIEMENS", "GATES"];

async function getFeaturedProducts() {
  return db.product.findMany({
    where: { status: "ACTIVE", isB2CEnabled: true, deletedAt: null },
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      prices: { where: { type: "B2C", isActive: true }, take: 1 },
      seller: { select: { businessNameEn: true } },
      inventory: { select: { qty: true, reservedQty: true }, take: 1 },
      category: { select: { nameEn: true } },
    },
  });
}

export default async function HomePage() {
  const products = await getFeaturedProducts();

  const mapped = products.map((p) => {
    const price = p.prices[0];
    const stock = p.inventory[0];
    const available = stock ? stock.qty - stock.reservedQty : 0;
    return {
      id: p.id,
      slug: p.slug,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      imageUrl: p.images[0]?.url,
      price: price ? Number(price.price) : 0,
      sku: p.sku,
      sellerId: p.sellerId,
      sellerName: p.seller.businessNameEn,
      inStock: available > 0,
      moq: p.moq,
      category: p.category?.nameEn ?? "Industrial",
    };
  });

  return (
    <MainLayout>
      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        {/* backdrop */}
        <div className="absolute inset-0 bg-grid mask-fade-b opacity-60" />
        <div className="absolute -top-24 start-1/4 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-10 end-1/4 h-80 w-80 rounded-full bg-accent/20 blur-[120px]" />

        <div className="relative max-w-7xl mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-3xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> The GCC's modern trade OS
            </span>
            <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[0.95]">
              Sourcing,
              <br />
              <span className="text-gradient">re-imagined.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              48,000+ products from 2,400+ verified GCC suppliers. Buy retail or
              request volume quotes — one platform, B2B-first and B2C-ready.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 hover:shadow-glow transition-all active:scale-[0.98]"
              >
                Start buying <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/b2b/rfq/new"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl border border-border bg-card/60 backdrop-blur font-semibold hover:bg-secondary transition-colors"
              >
                Request a quote
              </Link>
            </div>

            {/* trust stats */}
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg border-t border-border pt-6">
              {[
                { v: "2,400+", l: "Verified suppliers" },
                { v: "48,000+", l: "Products" },
                { v: "287", l: "B2B companies" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-2xl font-bold font-mono tracking-tight">{s.v}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* partner marquee */}
        <div className="relative border-t border-border bg-background/40 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Trusted brands</span>
            {PARTNERS.map((b) => (
              <span key={b} className="text-sm font-bold tracking-wide text-muted-foreground/70 hover:text-foreground transition-colors">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Category strip ───────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {CATEGORIES.map(({ slug, nameEn, icon: Icon }) => (
            <Link
              key={slug}
              href={`/products?category=${slug}`}
              className="group shrink-0 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 hover:border-primary/40 hover:shadow-card transition-all"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold whitespace-nowrap">{nameEn}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Best sellers ─────────────────────────────────── */}
      <Section title="Best sellers" subtitle="Most ordered this week" href="/products">
        <Grid>{mapped.slice(0, 5).map((p) => <ProductCard key={p.id} {...p} badge="HOT" />)}</Grid>
      </Section>

      {/* ─── Value props ──────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: BadgeCheck, t: "Verified suppliers", d: "Every seller is KYC-checked with valid trade licenses." },
            { icon: ShieldCheck, t: "Buyer protection", d: "Secure payments, escrow, and easy refunds on every order." },
            { icon: Truck, t: "GCC-wide logistics", d: "Integrated 3PL with live tracking across the Gulf." },
            { icon: Sparkles, t: "AI sourcing", d: "Smart RFQs and quote comparison that save procurement hours." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-card transition-all">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary mb-4">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-semibold">{t}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Featured ─────────────────────────────────────── */}
      <Section title="Featured products" subtitle="Hand-picked by our team" href="/products">
        <Grid>{mapped.slice(0, 5).map((p) => <ProductCard key={p.id} {...p} badge="NEW" />)}</Grid>
      </Section>

      {/* ─── B2B CTA band ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 pb-16 pt-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-600 to-accent-700 p-10 lg:p-14 text-white">
          <div className="absolute -bottom-20 -end-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative max-w-xl">
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">Procuring at volume?</h2>
            <p className="mt-3 text-white/80">
              Submit an RFQ and get competitive quotes from 3+ verified suppliers — with
              approval workflows, credit terms, and consolidated invoicing.
            </p>
            <Link
              href="/b2b/rfq/new"
              className="mt-7 inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-white text-primary-700 font-semibold hover:bg-white/90 transition-colors active:scale-[0.98]"
            >
              Submit an RFQ <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}

/* ── local layout helpers ─────────────────────────────── */
function Section({ title, subtitle, href, children }: { title: string; subtitle?: string; href: string; children: React.ReactNode }) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all">
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">{children}</div>;
}
