"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useCartStore } from "@/stores/cart";
import { canonicalRequisitionCartLines } from "@/lib/requisition-reprice";

type Item = {
  productId: string;
  sku: string;
  nameEn: string;
  qty: number;
};

export function ReorderButton({ items }: { items: Item[] }) {
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  async function reorder() {
    const response = await fetch("/api/b2b/requisition-lists/reprice", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: items.map(({ productId, qty }) => ({ productId, quantity: qty })) }),
    });
    const body = await response.json();
    if (!response.ok || !body.success || !Array.isArray(body.data?.lines)) {
      alert(body.error ?? "Unable to reprice requisition");
      return;
    }
    let lines;
    try { lines = canonicalRequisitionCartLines(items.length, body.data); }
    catch (error) { alert(error instanceof Error ? error.message : "Requisition pricing response was incomplete"); return; }
    for (const line of lines) addItem(line);
    router.push("/cart");
  }

  const reorderable = items.length > 0;

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
