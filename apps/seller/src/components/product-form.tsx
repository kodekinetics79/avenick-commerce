"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Send } from "lucide-react";
import { Input, Textarea } from "@avenick/ui";
import { createProductAction, updateProductAction, type ProductActionState } from "@/app/products/actions";
import { PRODUCT_CURRENCIES, PRODUCT_ORIGINS } from "@/lib/product-form";

export type ProductFormInitial = {
  categoryId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  imageUrl: string;
  origin: string;
  moq: number;
  currency: string;
  vatRate: number;
  b2bEnabled: boolean;
  b2cEnabled: boolean;
  b2bPrice: string;
  b2cPrice: string;
};

export function ProductForm({
  categories,
  initial,
  productId,
}: {
  categories: Array<{ id: string; nameEn: string }>;
  initial: ProductFormInitial;
  productId?: string;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<ProductActionState>({});
  const [pending, setPending] = React.useState(false);
  const [b2bEnabled, setB2bEnabled] = React.useState(initial.b2bEnabled);
  const [b2cEnabled, setB2cEnabled] = React.useState(initial.b2cEnabled);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({});
    const formData = new FormData(event.currentTarget);
    try {
      const result = productId
        ? await updateProductAction(productId, {}, formData)
        : await createProductAction({}, formData);
      if (result.productId) {
        router.push(`/products?submitted=${productId ? "updated" : "created"}`);
        router.refresh();
        return;
      }
      setState(result);
    } catch {
      setState({ error: "The listing could not be submitted. Please retry." });
    } finally {
      setPending(false);
    }
  }

  const field = "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Listing identity</h2>
          <p className="text-xs text-muted-foreground mt-1">All changes are submitted for Avenick review. Sellers cannot self-activate listings.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">SKU
            <Input name="sku" required defaultValue={initial.sku} readOnly={Boolean(productId)} className={productId ? "mt-1.5 bg-secondary" : "mt-1.5"} />
          </label>
          <label className="text-sm font-medium">Category
            <select name="categoryId" required defaultValue={initial.categoryId} className={`${field} mt-1.5`}>
              <option value="" disabled>Choose a category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.nameEn}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Product name (English)
            <Input name="nameEn" required minLength={3} maxLength={180} defaultValue={initial.nameEn} className="mt-1.5" />
          </label>
          <label className="text-sm font-medium">Product name (Arabic)
            <Input name="nameAr" required minLength={3} maxLength={180} defaultValue={initial.nameAr} dir="rtl" className="mt-1.5" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Description (English)
            <Textarea name="descriptionEn" rows={5} maxLength={5000} defaultValue={initial.descriptionEn} className="mt-1.5" />
          </label>
          <label className="text-sm font-medium">Description (Arabic)
            <Textarea name="descriptionAr" rows={5} maxLength={5000} defaultValue={initial.descriptionAr} dir="rtl" className="mt-1.5" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="sm:col-span-2 text-sm font-medium">Primary image URL (HTTPS)
            <Input name="imageUrl" type="url" defaultValue={initial.imageUrl} placeholder="https://www.mennekes.org/fileadmin/products_media/product.jpg" className="mt-1.5" />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">Approved Avenick, Mennekes, or placeholder image hosts only.</span>
          </label>
          <label className="text-sm font-medium">Country of origin
            <select name="origin" defaultValue={initial.origin} className={`${field} mt-1.5`}>
              <option value="">Not specified</option>
              {PRODUCT_ORIGINS.map((origin) => <option key={origin} value={origin}>{origin}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Commercial terms</h2>
          <p className="text-xs text-muted-foreground mt-1">Prices, tax and minimum quantity are reviewed with the listing.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">Currency
            <select name="currency" defaultValue={initial.currency} className={`${field} mt-1.5`}>
              {PRODUCT_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">VAT rate (%)
            <Input name="vatRate" type="number" min={0} max={100} step="0.01" required defaultValue={initial.vatRate} className="mt-1.5" />
          </label>
          <label className="text-sm font-medium">Minimum order quantity
            <Input name="moq" type="number" min={1} step={1} required defaultValue={initial.moq} className="mt-1.5" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input name="b2bEnabled" type="checkbox" checked={b2bEnabled} onChange={(event) => setB2bEnabled(event.target.checked)} /> B2B listing
            </label>
            <label className="mt-3 block text-sm font-medium">B2B unit price
              <Input name="b2bPrice" type="number" min="0.01" step="0.01" disabled={!b2bEnabled} required={b2bEnabled} defaultValue={initial.b2bPrice} className="mt-1.5" />
            </label>
          </div>
          <div className="rounded-xl border border-border p-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input name="b2cEnabled" type="checkbox" checked={b2cEnabled} onChange={(event) => setB2cEnabled(event.target.checked)} /> B2C listing
            </label>
            <label className="mt-3 block text-sm font-medium">B2C unit price
              <Input name="b2cPrice" type="number" min="0.01" step="0.01" disabled={!b2cEnabled} required={b2cEnabled} defaultValue={initial.b2cPrice} className="mt-1.5" />
            </label>
          </div>
        </div>
      </div>

      {state.error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><AlertCircle className="h-4 w-4" />{state.error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.push("/products")} className="h-10 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary">Cancel</button>
        <button type="submit" disabled={pending || categories.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Send className="h-4 w-4" /> {pending ? "Submitting…" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
