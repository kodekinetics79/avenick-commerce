"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useCartStore } from "@/stores/cart";

type Item = {
  productId: string | null;
  sku: string;
  nameEn: string;
  qty: number;
  unitPrice: number | null;
  sellerId: string | null;
};

export function ReorderButton({ items }: { items: Item[] }) {
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  function reorder() {
    let added = 0;
    for (const it of items) {
      if (it.productId && it.sellerId && it.unitPrice != null) {
        addItem({ productId: it.productId, nameEn: it.nameEn, nameAr: it.nameEn, sku: it.sku, qty: it.qty, unitPrice: it.unitPrice, sellerId: it.sellerId, currency: "AED" });
        added++;
      }
    }
    if (added > 0) router.push("/cart");
  }

  const reorderable = items.some((i) => i.productId && i.sellerId && i.unitPrice != null);

  return (
    <button
      type="button"
      onClick={reorder}
      disabled={!reorderable}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      title={reorderable ? "Add all catalog items to cart" : "No catalog-linked items to reorder"}
    >
      <RotateCcw className="h-3.5 w-3.5" /> Reorder
    </button>
  );
}
