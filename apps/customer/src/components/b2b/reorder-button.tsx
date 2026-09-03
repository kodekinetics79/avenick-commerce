"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@avenick/ui";
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
    <Button
      type="button"
      variant="primary"
      size="sm"
      onClick={reorder}
      disabled={!reorderable}
      // A `title` is not announced by most screen readers and never appears on
      // touch, so the reason a disabled control is disabled is given as its
      // accessible name rather than only as a tooltip.
      aria-label={reorderable ? "Add every catalog item on this list to the cart" : "Nothing to reorder — no item on this list is linked to a catalog product"}
      title={reorderable ? "Add all catalog items to cart" : "No catalog-linked items to reorder"}
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reorder
    </Button>
  );
}
