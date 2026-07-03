"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Home, ShoppingBag, ArrowLeft, HelpCircle } from "lucide-react";
import { useState } from "react";

export default function NotFound() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background text-foreground overflow-hidden px-4">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 bg-grid mask-fade-b opacity-40 pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[400px] sm:h-[600px] sm:w-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 h-[300px] w-[300px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />

      <div className="relative max-w-2xl w-full text-center space-y-8 py-12">
        {/* Glow Logo Icon */}
        <div className="flex justify-center">
          <Link href="/" className="group flex items-center gap-2 mb-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white font-black text-2xl shadow-elevated group-hover:scale-105 transition-transform duration-300">
              A
            </span>
          </Link>
        </div>

        {/* 404 Visual Header */}
        <div className="space-y-3">
          <h1 className="text-8xl sm:text-9xl font-extrabold tracking-tighter text-gradient leading-none">
            404
          </h1>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Page not found / الصفحة غير موجودة
          </h2>
          <div className="max-w-md mx-auto space-y-2 mt-4">
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              We couldn't find the page you're looking for. It might have been moved, deleted, or never existed.
            </p>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed font-medium" dir="rtl">
              لم نتمكن من العثور على الصفحة التي تبحث عنها. قد تكون تمت إزالتها أو تغيير اسمها أو أنها لم تكن موجودة في الأصل.
            </p>
          </div>
        </div>

        {/* Interactive Search Bar */}
        <form onSubmit={handleSearch} className="max-w-md mx-auto relative group">
          <div className="relative w-full">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, brands, or categories..."
              className="w-full h-12 ps-12 pe-4 text-sm rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all duration-300 shadow-sm"
            />
          </div>
          <button
            type="submit"
            className="absolute end-1.5 top-1/2 -translate-y-1/2 h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/95 transition-all shadow-glow-sm"
          >
            Search
          </button>
        </form>

        {/* Quick Links & CTAs */}
        <div className="pt-4 max-w-lg mx-auto">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Useful links / روابط مفيدة
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link
              href="/"
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-elevated transition-all group"
            >
              <Home className="h-5 w-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Home</span>
              <span className="text-[10px] text-muted-foreground">الرئيسية</span>
            </Link>

            <Link
              href="/products"
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-elevated transition-all group"
            >
              <ShoppingBag className="h-5 w-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Products</span>
              <span className="text-[10px] text-muted-foreground">المنتجات</span>
            </Link>

            <button
              onClick={() => router.back()}
              className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-4 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-elevated transition-all group"
            >
              <ArrowLeft className="h-5 w-5 text-primary mb-2 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-semibold">Go Back</span>
              <span className="text-[10px] text-muted-foreground">الرجوع للخلف</span>
            </button>
          </div>
        </div>

        {/* Footer Support Info */}
        <div className="pt-8 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Need help? / هل تحتاج لمساعدة؟</span>
          <Link href="/support" className="text-primary hover:underline font-semibold">
            Contact Support / الدعم الفني
          </Link>
        </div>
      </div>
    </div>
  );
}
