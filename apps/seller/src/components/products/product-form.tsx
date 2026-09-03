"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { platformName } from "@avenick/utils/portal-config";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  ImageOff,
  Info,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Combobox, Input, Textarea } from "@avenick/ui";
import { useToast } from "@/components/toast";
import { createProduct, updateProduct, type ProductFormState, type StatutoryVatRow } from "@/app/products/actions";

export type ProductFormOption = { value: string; label: string };

export type ProductFormPriceValue = {
  /** Stored row id; absent for a tier the seller has just added. */
  id?: string;
  type: "B2C" | "B2B";
  currency: string;
  price: string;
  minQty: string;
  maxQty: string;
  /** VAT rate already stored on this row, or null for a row not yet saved. */
  storedVatRate: string | null;
};

export type ProductFormImageValue = { id?: string; url: string; altEn: string | null };

export type ProductFormValues = {
  sku: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  categoryId: string;
  brandId: string;
  origin: string;
  isB2CEnabled: boolean;
  isB2BEnabled: boolean;
  moq: string;
  tags: string;
  stockQty: string;
  images: ProductFormImageValue[];
  prices: ProductFormPriceValue[];
};

export interface ProductFormProps {
  mode: "create" | "edit";
  productId?: string;
  initial: ProductFormValues;
  categories: ProductFormOption[];
  brands: ProductFormOption[];
  /** Statutory VAT per currency, resolved server-side from checkout's own table. */
  vatTable: StatutoryVatRow[];
  canManagePricing: boolean;
  canManageInventory: boolean;
  /**
   * Whether the platform can issue a presigned upload URL at all. False means
   * object storage is unconfigured, so no upload control is rendered — a
   * dropzone that cannot store anything is a lie about what this page can do.
   */
  uploadsEnabled: boolean;
  /** Current stored status; edit mode only. */
  currentStatus?: string;
  /** Units already reserved by open orders; edit mode only, informational. */
  reservedQty?: number;
  /** True when stock lives across several locations and cannot be set here. */
  stockIsSplit?: boolean;
}

const ORIGIN_OPTIONS: ProductFormOption[] = [
  { value: "AE", label: "United Arab Emirates" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "QA", label: "Qatar" },
  { value: "KW", label: "Kuwait" },
  { value: "OM", label: "Oman" },
  { value: "BH", label: "Bahrain" },
];

/** Extensions the upload policy signs for a product image (UPLOAD_POLICIES). */
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const SECTION = "rounded-2xl border border-border bg-card p-5 space-y-4";
const LABEL = "block text-sm font-medium mb-1.5";
const FIELD_ERROR = "mt-1 text-xs text-danger";

function toInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * Compare a stored rate against the statutory one the way checkout does —
 * integer basis points, because Decimal(5,2) against a whole-percent table
 * makes binary float equality the only hazard in the comparison.
 */
function ratesDisagree(storedVatRate: string | null, statutoryRate: number): boolean {
  if (storedVatRate === null) return false;
  const stored = Number(storedVatRate);
  if (!Number.isFinite(stored)) return true;
  return Math.round(stored * 100) !== Math.round(statutoryRate * 100);
}

function emptyPriceRow(type: "B2C" | "B2B", currency: string): ProductFormPriceValue {
  return { type, currency, price: "", minQty: "1", maxQty: "", storedVatRate: null };
}

export function ProductForm({
  mode,
  productId,
  initial,
  categories,
  brands,
  vatTable,
  canManagePricing,
  canManageInventory,
  uploadsEnabled,
  currentStatus,
  reservedQty,
  stockIsSplit,
}: ProductFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [values, setValues] = React.useState<ProductFormValues>(initial);
  const [state, setState] = React.useState<ProductFormState>({});
  const [pending, setPending] = React.useState<null | "SAVE" | "SAVE_DRAFT" | "SUBMIT_FOR_REVIEW">(null);

  const set = React.useCallback(<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  }, []);

  const fieldError = (path: string) => state.fieldErrors?.[path];

  // ── VAT ────────────────────────────────────────────────────────────────────
  const currencyOptions = vatTable.map((row) => row.currency);
  const statutoryFor = (currency: string) => vatTable.find((row) => row.currency === currency) ?? null;
  const defaultCurrency = currencyOptions.includes("AED") ? "AED" : currencyOptions[0] ?? "";

  // ── Images ─────────────────────────────────────────────────────────────────
  const [uploadNotice, setUploadNotice] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  /**
   * Upload straight to object storage through POST /api/uploads/presign. Any
   * outcome other than a signed URL followed by a successful PUT leaves the
   * image list untouched and states plainly what happened — the listing stays
   * savable without images, and no unreachable URL is ever recorded.
   */
  async function uploadFiles(files: FileList) {
    setUploadNotice(null);
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 8 - values.images.length)) {
        if (file.size > IMAGE_MAX_BYTES) {
          setUploadNotice(`"${file.name}" is larger than 5 MB and was not uploaded.`);
          continue;
        }

        let grant: Response;
        try {
          grant = await fetch("/api/uploads/presign", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              purpose: "product-image",
              filename: file.name,
              contentType: file.type,
              size: file.size,
            }),
          });
        } catch {
          setUploadNotice("Couldn't reach the upload service. Save the listing now and add images later.");
          return;
        }

        const body = (await grant.json().catch(() => null)) as
          | { success?: boolean; error?: string; data?: { url?: string; headers?: Record<string, string>; publicUrl?: string | null } }
          | null;

        if (!grant.ok || body?.success === false || !body?.data) {
          setUploadNotice(
            body?.error ?? `Image upload is unavailable right now (HTTP ${grant.status}). You can save the listing without images.`,
          );
          return;
        }

        const { url, headers, publicUrl } = body.data;
        if (typeof url !== "string" || typeof publicUrl !== "string") {
          // A grant this form cannot use is treated as no grant. Guessing a
          // readable URL would put a broken image into the catalog.
          setUploadNotice("The upload service returned a response this form can't use. No image was attached.");
          return;
        }

        const put = await fetch(url, { method: "PUT", body: file, headers: headers ?? undefined }).catch(() => null);
        if (!put || !put.ok) {
          setUploadNotice(`Uploading "${file.name}" failed${put ? ` (HTTP ${put.status})` : ""}. No image was attached.`);
          return;
        }

        setValues((previous) => ({
          ...previous,
          images: [...previous.images, { url: publicUrl, altEn: null }],
        }));
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── AI drafting ────────────────────────────────────────────────────────────
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiContext, setAiContext] = React.useState("");
  const [aiResult, setAiResult] = React.useState<string | null>(null);
  const [aiNotice, setAiNotice] = React.useState<string | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);

  function openAi() {
    const categoryLabel = categories.find((option) => option.value === values.categoryId)?.label ?? "";
    const brandLabel = brands.find((option) => option.value === values.brandId)?.label ?? "";
    setAiContext([values.nameEn, brandLabel, categoryLabel, values.tags].filter(Boolean).join(", "));
    setAiOpen(true);
  }

  async function generateDescription() {
    setAiLoading(true);
    setAiResult(null);
    setAiNotice(null);
    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "listing", context: aiContext }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.success === false) {
        setAiNotice(body?.error ?? "Couldn't generate a draft.");
        return;
      }
      // `ai: false` means no model produced this text — the payload is a status
      // message, not copy. Offering it as a description would put a service
      // notice into the catalog, so it is shown as a notice and nothing more.
      if (body?.data?.ai === false) {
        setAiNotice(body?.data?.text ?? "AI drafting is unavailable in this environment.");
        return;
      }
      const text = String(body?.data?.text ?? "").trim();
      if (!text) {
        setAiNotice("The AI service returned an empty draft.");
        return;
      }
      setAiResult(text);
    } catch {
      setAiNotice("Couldn't reach the AI service.");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function buildPayload(): { payload: Record<string, unknown> } | { localErrors: Record<string, string> } {
    const localErrors: Record<string, string> = {};

    const moq = toInt(values.moq);
    if (moq === null || moq < 1) localErrors["moq"] = "Enter a whole number of units, 1 or more.";

    const prices = values.prices.map((row, index) => {
      const minQty = toInt(row.minQty);
      const maxQty = row.maxQty.trim() === "" ? null : toInt(row.maxQty);
      if (minQty === null || minQty < 1) localErrors[`prices.${index}.minQty`] = "Enter a whole number, 1 or more.";
      if (row.maxQty.trim() !== "" && maxQty === null) localErrors[`prices.${index}.maxQty`] = "Enter a whole number, or leave it blank.";
      return { ...(row.id ? { id: row.id } : {}), type: row.type, currency: row.currency, price: row.price.trim(), minQty: minQty ?? 0, maxQty };
    });

    // Stock is sent only when the seller actually changed the field. A
    // prefilled figure that is merely re-submitted must not become an
    // ADJUSTMENT: between page load and save a fulfilment may have shipped
    // units, and writing the old number back would put them back on the shelf.
    let stockQty: number | undefined;
    let stockQtyAsLoaded: number | null | undefined;
    const stockChanged = values.stockQty.trim() !== initial.stockQty.trim();
    if (canManageInventory && !stockIsSplit && stockChanged && values.stockQty.trim() !== "") {
      const parsed = toInt(values.stockQty);
      if (parsed === null || parsed < 0) localErrors["stockQty"] = "Enter a whole number of units, 0 or more.";
      else stockQty = parsed;
      if (mode === "edit") {
        // What the page showed when it opened; the server refuses the save if
        // the live row no longer matches it.
        if (initial.stockQty.trim() === "") {
          stockQtyAsLoaded = null;
        } else {
          const loaded = toInt(initial.stockQty);
          if (loaded === null) localErrors["stockQty"] = "The stock figure this page loaded with is unreadable. Reload the page.";
          else stockQtyAsLoaded = loaded;
        }
      }
    }

    if (Object.keys(localErrors).length > 0) return { localErrors };

    return {
      payload: {
        sku: values.sku.trim(),
        nameEn: values.nameEn.trim(),
        nameAr: values.nameAr.trim(),
        descriptionEn: values.descriptionEn.trim(),
        descriptionAr: values.descriptionAr.trim(),
        categoryId: values.categoryId,
        brandId: values.brandId || null,
        origin: values.origin || null,
        isB2CEnabled: values.isB2CEnabled,
        isB2BEnabled: values.isB2BEnabled,
        moq,
        tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20),
        images: values.images.map((image) => ({ ...(image.id ? { id: image.id } : {}), url: image.url, altEn: image.altEn })),
        // Omitted entirely — not sent empty — when the actor has no capability
        // for it, so the server never demands a grant this save doesn't use.
        ...(canManagePricing ? { prices } : {}),
        ...(stockQty === undefined ? {} : { stockQty }),
        ...(stockQtyAsLoaded === undefined ? {} : { stockQtyAsLoaded }),
      },
    };
  }

  async function submit(intent: "SAVE" | "SAVE_DRAFT" | "SUBMIT_FOR_REVIEW") {
    const built = buildPayload();
    if ("localErrors" in built) {
      setState({ error: "Please correct the highlighted fields.", fieldErrors: built.localErrors });
      return;
    }

    setState({});
    setPending(intent);
    try {
      const result =
        mode === "create"
          ? await createProduct(built.payload, intent === "SUBMIT_FOR_REVIEW" ? "SUBMIT_FOR_REVIEW" : "SAVE_DRAFT")
          : await updateProduct(productId, built.payload, intent);

      if (!result.ok) {
        setState(result);
        if (result.error) toast({ title: result.error, variant: "error" });
        return;
      }

      toast({
        title: mode === "create" ? "Product created" : "Product saved",
        description:
          intent === "SUBMIT_FOR_REVIEW"
            ? `Sent to ${platformName()} for catalog review.`
            : intent === "SAVE_DRAFT"
              ? "Saved as a draft. It is not visible to buyers."
              : "Saved. Its status is unchanged.",
        variant: "success",
      });
      router.push("/products");
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Couldn't save this product." });
    } finally {
      setPending(null);
    }
  }

  // Editing a listing the seller cannot move back into review: the status
  // controls are hidden rather than shown as no-ops.
  const canChangeStatus = mode === "create" || ["DRAFT", "PENDING_REVIEW", "REJECTED"].includes(currentStatus ?? "");
  const busy = pending !== null;

  // Server-side field errors that no input below renders (e.g. images.2.url or
  // tags.4). They are listed under the top-level error so "correct the
  // highlighted fields" never points at nothing.
  const renderedErrorKeys = /^(sku|nameEn|nameAr|moq|categoryId|brandId|origin|descriptionEn|descriptionAr|isB2BEnabled|prices|stockQty|images|prices\.\d+\.(type|currency|price|minQty|maxQty))$/;
  const unrenderedErrors = Object.entries(state.fieldErrors ?? {}).filter(([key]) => !renderedErrorKeys.test(key));

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to products
      </Link>

      {/* Governance banner — states exactly what saving does and does not do. */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          {mode === "create" ? (
            <>
              <p className="font-semibold">A new listing goes to review before buyers can see it.</p>
              <p className="text-muted-foreground">
                This form cannot set a listing to Active. Save it as a draft to keep working on it, or submit it for
                review by a {platformName()} approver. Appearing on the public storefront is a further admin decision on top of
                approval.
              </p>
            </>
          ) : canChangeStatus ? (
            <>
              <p className="font-semibold">This listing is {(currentStatus ?? "").replace(/_/g, " ").toLowerCase()}.</p>
              <p className="text-muted-foreground">
                {currentStatus === "PENDING_REVIEW"
                  ? "Saving changes keeps it in the review queue. Withdrawing it to draft takes it out of the queue until you submit it again."
                  : `Saving as a draft keeps it out of the storefront. Submitting for review sends it to a ${platformName()} approver; this form cannot set it to Active.`}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">This listing is {(currentStatus ?? "").replace(/_/g, " ").toLowerCase()} — changes take effect immediately.</p>
              <p className="text-muted-foreground">
                Saving here edits the listing in place and does not change its status. Use the bulk actions on the
                products list to activate, deactivate or suppress it.
              </p>
            </>
          )}
        </div>
      </div>

      {state.error && (
        <div className="space-y-1.5" role="alert">
          <p className="flex items-start gap-1.5 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {state.error}
          </p>
          {unrenderedErrors.length > 0 && (
            <ul className="ml-6 list-disc text-sm text-danger space-y-0.5">
              {unrenderedErrors.map(([key, message]) => (
                <li key={key}>
                  <span className="font-mono text-xs">{key}</span>: {message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Basics ───────────────────────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="font-semibold">Product details</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              label="Product name (English)"
              value={values.nameEn}
              onChange={(event) => set("nameEn", event.target.value)}
              placeholder="e.g. Hardened steel bearing assortment"
              error={fieldError("nameEn")}
              required
            />
          </div>
          <div>
            <Input
              label="Product name (Arabic) — optional"
              dir="rtl"
              value={values.nameAr}
              onChange={(event) => set("nameAr", event.target.value)}
              placeholder="اتركه فارغًا إذا لم تتوفر ترجمة"
              error={fieldError("nameAr")}
              hint="Leave blank if you don't have a translation yet. We never copy the English name here — an untranslated listing is reported as an issue so it can be fixed properly."
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              label="SKU"
              value={values.sku}
              onChange={(event) => set("sku", event.target.value)}
              placeholder="e.g. BRG-6204-2RS"
              error={fieldError("sku")}
              hint="Unique across the marketplace. Letters, digits and . _ / -"
              required
            />
          </div>
          <div>
            <Input
              label="Minimum order quantity"
              type="number"
              min={1}
              step={1}
              value={values.moq}
              onChange={(event) => set("moq", event.target.value)}
              error={fieldError("moq")}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Category</label>
            <Combobox
              options={categories}
              value={values.categoryId}
              onValueChange={(value) => set("categoryId", value)}
              placeholder="Choose a category"
              searchPlaceholder="Search categories…"
              emptyText="No matching category"
            />
            {fieldError("categoryId") && <p className={FIELD_ERROR}>{fieldError("categoryId")}</p>}
          </div>
          <div>
            <label className={LABEL}>Brand — optional</label>
            <Combobox
              options={brands}
              value={values.brandId}
              onValueChange={(value) => set("brandId", value)}
              placeholder="No brand"
              searchPlaceholder="Search brands…"
              emptyText="No matching brand"
            />
            {fieldError("brandId") && <p className={FIELD_ERROR}>{fieldError("brandId")}</p>}
          </div>
          <div>
            <label className={LABEL} htmlFor="product-origin">Country of origin — optional</label>
            <select
              id="product-origin"
              value={values.origin}
              onChange={(event) => set("origin", event.target.value)}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Not stated</option>
              {ORIGIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {fieldError("origin") && <p className={FIELD_ERROR}>{fieldError("origin")}</p>}
          </div>
        </div>

        <div>
          <Input
            label="Tags — optional"
            value={values.tags}
            onChange={(event) => set("tags", event.target.value)}
            placeholder="bearings, iso-9001, industrial"
            hint="Comma separated, up to 20."
          />
        </div>
      </section>

      {/* ── Description + AI ─────────────────────────────────────────────── */}
      <section className={SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Description</h2>
          <button
            type="button"
            onClick={openAi}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
          >
            <Sparkles className="h-3.5 w-3.5" /> Draft with AI
          </button>
        </div>

        {aiOpen && (
          <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="ai-context">
              Product name & key specs to write from
            </label>
            <Textarea
              id="ai-context"
              rows={2}
              value={aiContext}
              onChange={(event) => setAiContext(event.target.value)}
              placeholder="e.g. CNC bearing assortment, hardened steel, ISO 9001"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={generateDescription}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiResult ? "Regenerate" : "Generate"}
              </button>
              <button type="button" onClick={() => setAiOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>

            {aiNotice && (
              <p className="flex items-start gap-1.5 text-xs text-danger">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {aiNotice}
              </p>
            )}

            {aiResult && (
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiResult}</p>
                <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => { set("descriptionEn", aiResult); setAiOpen(false); }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Replace the English description
                  </button>
                  <button
                    type="button"
                    onClick={() => { set("descriptionEn", `${values.descriptionEn}\n\n${aiResult}`.trim()); setAiOpen(false); }}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Append to it
                  </button>
                  <span className="text-[11px] text-muted-foreground">Machine-drafted — check the specs before you save.</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="description-en">English description</label>
            <Textarea
              id="description-en"
              rows={6}
              value={values.descriptionEn}
              onChange={(event) => set("descriptionEn", event.target.value)}
              placeholder="Specs, materials, certifications, typical use cases…"
            />
            {fieldError("descriptionEn") && <p className={FIELD_ERROR}>{fieldError("descriptionEn")}</p>}
          </div>
          <div>
            <label className={LABEL} htmlFor="description-ar">Arabic description — optional</label>
            <Textarea
              id="description-ar"
              dir="rtl"
              rows={6}
              value={values.descriptionAr}
              onChange={(event) => set("descriptionAr", event.target.value)}
              placeholder="اتركه فارغًا إذا لم تتوفر ترجمة"
            />
            {fieldError("descriptionAr") && <p className={FIELD_ERROR}>{fieldError("descriptionAr")}</p>}
          </div>
        </div>
      </section>

      {/* ── Channels ─────────────────────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="font-semibold">Sales channels</h2>
        <p className="text-sm text-muted-foreground">
          Which side of the marketplace this product is offered on. A price can only be added for a channel that is
          switched on here.
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.isB2CEnabled}
              onChange={(event) => set("isB2CEnabled", event.target.checked)}
              className="rounded border-border accent-[hsl(var(--primary))]"
            />
            Sell to consumers (B2C)
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.isB2BEnabled}
              onChange={(event) => set("isB2BEnabled", event.target.checked)}
              className="rounded border-border accent-[hsl(var(--primary))]"
            />
            Sell to businesses (B2B)
          </label>
        </div>
        {fieldError("isB2BEnabled") && <p className={FIELD_ERROR}>{fieldError("isB2BEnabled")}</p>}
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="font-semibold">Pricing</h2>

        {!canManagePricing ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Ban className="h-4 w-4 shrink-0 mt-0.5" />
            Your account does not have the <span className="font-mono text-xs">pricing.manage</span> capability, so prices
            are not editable here and this save will leave them exactly as they are.
          </p>
        ) : vatTable.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            No currency has a resolvable statutory VAT rate in this environment, so a price cannot be written that
            checkout would accept. Pricing is unavailable until that is configured.
          </p>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-secondary/40 p-3.5 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">VAT is set by statute, not by you.</p>
              <p>
                Checkout refuses an order whose price row disagrees with the statutory rate for the delivery destination,
                so the rate below is taken from the statutory table for the currency and saved with the price:{" "}
                {vatTable.map((row) => `${row.currency} → ${row.rate}% (${row.country})`).join(" · ")}.
              </p>
              <p>Currencies with no home VAT jurisdiction are not offered here, because no rate could be stored for them truthfully.</p>
              <p>
                Several rows in the same channel and currency are quantity tiers. Their ranges must not overlap: give each
                lower tier a max quantity below the next tier&apos;s min quantity. Only one row may cover a single unit.
              </p>
            </div>

            {values.prices.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No price yet. A listing needs at least one price before it can be submitted for review.
              </p>
            )}

            <div className="space-y-3">
              {values.prices.map((row, index) => {
                const statutory = statutoryFor(row.currency);
                const mismatch = statutory ? ratesDisagree(row.storedVatRate, statutory.rate) : false;
                return (
                  <div key={row.id ?? `new-${index}`} className="rounded-xl border border-border p-3.5 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-5">
                      <div>
                        <label className={LABEL} htmlFor={`price-type-${index}`}>Channel</label>
                        <select
                          id={`price-type-${index}`}
                          value={row.type}
                          onChange={(event) => {
                            const type = event.target.value as "B2C" | "B2B";
                            setValues((previous) => ({
                              ...previous,
                              prices: previous.prices.map((item, i) => (i === index ? { ...item, type } : item)),
                            }));
                          }}
                          className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="B2C">B2C</option>
                          <option value="B2B">B2B</option>
                        </select>
                        {fieldError(`prices.${index}.type`) && <p className={FIELD_ERROR}>{fieldError(`prices.${index}.type`)}</p>}
                      </div>
                      <div>
                        <label className={LABEL} htmlFor={`price-currency-${index}`}>Currency</label>
                        <select
                          id={`price-currency-${index}`}
                          value={row.currency}
                          onChange={(event) => {
                            const currency = event.target.value;
                            setValues((previous) => ({
                              ...previous,
                              prices: previous.prices.map((item, i) => (i === index ? { ...item, currency } : item)),
                            }));
                          }}
                          className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {currencyOptions.map((currency) => (
                            <option key={currency} value={currency}>{currency}</option>
                          ))}
                        </select>
                        {fieldError(`prices.${index}.currency`) && <p className={FIELD_ERROR}>{fieldError(`prices.${index}.currency`)}</p>}
                      </div>
                      <div>
                        <Input
                          label="Unit price"
                          inputMode="decimal"
                          value={row.price}
                          onChange={(event) => {
                            const price = event.target.value;
                            setValues((previous) => ({
                              ...previous,
                              prices: previous.prices.map((item, i) => (i === index ? { ...item, price } : item)),
                            }));
                          }}
                          placeholder="199.00"
                          error={fieldError(`prices.${index}.price`)}
                        />
                      </div>
                      <div>
                        <Input
                          label="Min qty"
                          type="number"
                          min={1}
                          step={1}
                          value={row.minQty}
                          onChange={(event) => {
                            const minQty = event.target.value;
                            setValues((previous) => ({
                              ...previous,
                              prices: previous.prices.map((item, i) => (i === index ? { ...item, minQty } : item)),
                            }));
                          }}
                          error={fieldError(`prices.${index}.minQty`)}
                        />
                      </div>
                      <div>
                        <Input
                          label="Max qty — optional"
                          type="number"
                          min={1}
                          step={1}
                          value={row.maxQty}
                          onChange={(event) => {
                            const maxQty = event.target.value;
                            setValues((previous) => ({
                              ...previous,
                              prices: previous.prices.map((item, i) => (i === index ? { ...item, maxQty } : item)),
                            }));
                          }}
                          error={fieldError(`prices.${index}.maxQty`)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        VAT: <span className="font-semibold text-foreground">{statutory ? `${statutory.rate}%` : "unavailable"}</span>
                        {statutory ? ` — statutory rate in ${statutory.country}, saved with this price.` : ""}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setValues((previous) => ({ ...previous, prices: previous.prices.filter((_, i) => i !== index) }))
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>

                    {mismatch && statutory && (
                      <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        This price is stored at {row.storedVatRate}% VAT but the statutory rate in {statutory.country} is{" "}
                        {statutory.rate}%. Orders cannot be placed while those disagree — saving corrects it to {statutory.rate}%.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {values.prices.length < 12 && defaultCurrency && (
              <div className="flex flex-wrap gap-2">
                {values.isB2CEnabled && (
                  <button
                    type="button"
                    onClick={() => setValues((previous) => ({ ...previous, prices: [...previous.prices, emptyPriceRow("B2C", defaultCurrency)] }))}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add B2C price
                  </button>
                )}
                {values.isB2BEnabled && (
                  <button
                    type="button"
                    onClick={() => setValues((previous) => ({ ...previous, prices: [...previous.prices, emptyPriceRow("B2B", defaultCurrency)] }))}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add B2B price
                  </button>
                )}
              </div>
            )}
            {fieldError("prices") && <p className={FIELD_ERROR}>{fieldError("prices")}</p>}
          </>
        )}
      </section>

      {/* ── Stock ────────────────────────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="font-semibold">Stock</h2>
        {!canManageInventory ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Ban className="h-4 w-4 shrink-0 mt-0.5" />
            Your account does not have the <span className="font-mono text-xs">inventory.manage</span> capability, so stock
            is not editable here and this save will leave it exactly as it is.
          </p>
        ) : stockIsSplit ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            Stock for this product is held in more than one location, so it cannot be set from a single field here. The
            seller portal has no per-location stock adjustment yet; the{" "}
            <Link href="/inventory" className="text-primary hover:underline">Inventory</Link> page shows the current
            figures but cannot change them.
          </p>
        ) : (
          <div className="max-w-xs">
            <Input
              label={mode === "create" ? "Opening stock on hand" : "Stock on hand"}
              type="number"
              min={0}
              step={1}
              value={values.stockQty}
              onChange={(event) => set("stockQty", event.target.value)}
              error={fieldError("stockQty")}
              hint={
                typeof reservedQty === "number" && reservedQty > 0
                  ? `${reservedQty} unit(s) are reserved by open orders — on-hand stock cannot be set below that.`
                  : mode === "create"
                    ? "Leave blank to record no opening stock."
                    : "Only a changed figure is saved; leaving it as loaded leaves stock untouched."
              }
            />
          </div>
        )}
      </section>

      {/* ── Images ───────────────────────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="font-semibold">Images</h2>

        {values.images.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {values.images.map((image, index) => (
              <li key={image.id ?? image.url} className="relative w-24">
                {/* Plain <img>: uploaded objects live on the storage host, which
                    is not in next.config's image remotePatterns allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.altEn ?? values.nameEn} className="h-24 w-24 rounded-xl object-cover border border-border" />
                {index === 0 && (
                  <span className="absolute top-1 start-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">Primary</span>
                )}
                <button
                  type="button"
                  onClick={() => setValues((previous) => ({ ...previous, images: previous.images.filter((_, i) => i !== index) }))}
                  className="absolute -top-2 -end-2 grid h-6 w-6 place-items-center rounded-full bg-danger text-white shadow"
                  aria-label={`Remove image ${index + 1}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {uploadsEnabled ? (
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => event.target.files && uploadFiles(event.target.files)}
            />
            <button
              type="button"
              disabled={uploading || values.images.length >= 8}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload images"}
            </button>
            <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 5 MB each. The first image is the primary one.</p>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ImageOff className="h-4 w-4 shrink-0 mt-0.5" />
            Image upload is unavailable in this environment — file storage is not configured, so no upload could be
            stored. You can save this listing now; until an image is added it will carry a “missing images” issue on the{" "}
            <Link href="/issues" className="text-primary hover:underline">Fix Your Products</Link> page.
          </p>
        )}

        {uploadNotice && (
          <p className="flex items-start gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {uploadNotice}
          </p>
        )}
        {fieldError("images") && <p className={FIELD_ERROR}>{fieldError("images")}</p>}
      </section>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pb-8">
        {canChangeStatus ? (
          <>
            {/* On a listing already in the queue, plain "save" must not silently
                withdraw it, so the draft action is named for what it does. */}
            {mode === "edit" && currentStatus === "PENDING_REVIEW" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit("SAVE_DRAFT")}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  {pending === "SAVE_DRAFT" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Withdraw to draft
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit("SAVE")}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {pending === "SAVE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save changes (stays in review)
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit("SAVE_DRAFT")}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  {pending === "SAVE_DRAFT" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save as draft
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit("SUBMIT_FOR_REVIEW")}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {pending === "SUBMIT_FOR_REVIEW" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {currentStatus === "REJECTED" ? "Resubmit for review" : "Submit for review"}
                </button>
              </>
            )}
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("SAVE")}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {pending === "SAVE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </button>
        )}
        <Link href="/products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</Link>
      </div>
    </div>
  );
}
