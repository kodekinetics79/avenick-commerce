"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { platformName } from "@avenick/utils/portal-config";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Info,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { UPLOAD_POLICIES } from "@avenick/utils/browser-upload-policy";
import {
  Button,
  Combobox,
  Dateline,
  Divider,
  Eyebrow,
  FieldWell,
  ImageFrame,
  Input,
  Surface,
  Textarea,
} from "@avenick/ui";
import { useToast } from "@/components/toast";
import { createProduct, updateProduct, type ProductFormState, type StatutoryVatRow } from "@/app/products/actions";
// One status vocabulary for the whole catalog surface; it hands back a message
// key rather than a word, because this module is shared with the list.
import { statusMeta } from "@/components/products/status-meta";

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

/**
 * The countries this form offers as an origin, as ISO codes. The code is what
 * is stored and what the server validates; the country's NAME is a message
 * (`form.origin.<code>`), resolved inside the component where a translator is
 * in scope.
 */
const ORIGIN_CODES = ["AE", "SA", "QA", "KW", "OM", "BH"] as const;

/**
 * The extensions and the ceiling the upload policy actually signs for a product
 * image, read from the policy rather than copied beside it. The form used to
 * carry its own ".jpg,.jpeg,.png,.webp" and its own 5 MB, which is two places
 * for one rule to drift and a dialogue box that can offer a file the presign
 * route will refuse.
 */
const IMAGE_POLICY = UPLOAD_POLICIES["product-image"];
const IMAGE_ACCEPT = Object.keys(IMAGE_POLICY.mediaTypesByExtension).join(",");
const IMAGE_MAX_BYTES = IMAGE_POLICY.maxBytes;
/** The ceiling as a plain figure; the unit is part of the message, not of this. */
const IMAGE_MAX_MB = String(Math.round(IMAGE_MAX_BYTES / (1024 * 1024)));
const IMAGE_TYPE_LABEL = Object.keys(IMAGE_POLICY.mediaTypesByExtension)
  .map((extension) => extension.replace(".", "").toUpperCase())
  .filter((label, index, all) => all.indexOf(label) === index)
  .join(", ");
/** The gallery ceiling the upload loop already enforced; named so it reads once. */
const IMAGE_MAX_COUNT = 8;

const LABEL = "u-ui mb-1.5 block font-medium text-ink-1";
const FIELD_ERROR = "u-meta mt-1 text-danger-ink";
/**
 * A native <select> styled as the same recessed rung-1 control <Input> renders,
 * so a form does not mix a pressed-in text field with a raised-looking dropdown.
 * Native is deliberate here: a country list and a two-value channel picker are
 * exactly what the platform control does better than any scripted menu.
 *
 * Every element wearing this MUST also carry data-rung={1}. That attribute is
 * what supplies the recessed fill, the --elev-1 inset, the portal's own corner
 * radius and the --ring-offset-surface the focus ring reads — the class alone
 * would leave a select with a different radius and no recess beside the Inputs
 * next to it. The ring itself is the shared .u-focus utility rather than a
 * shadow written out here: a hand-rolled box-shadow in a page is exactly how a
 * five-rung system quietly becomes a ten-shadow one.
 */
const CONTROL = [
  "u-focus w-full border border-input px-3 text-ui text-ink-1 h-control-md",
  "outline-none transition-[border-color,box-shadow] duration-press ease-standard",
].join(" ");

/**
 * The form as a sequence rather than one long scroll.
 *
 * Six panels stacked on one page meant a seller scrolled past pricing to reach
 * stock and never saw whether the channel switch above it was on. Each step is
 * one decision, the rail says how many are left, and every step stays reachable
 * at any time — this is a sequence, not a gate. Nothing is validated on the way
 * out of a step: the payload is still built and judged once, on save, exactly as
 * it was, so the server sees the identical request either way.
 *
 * `errorKey` is what maps a field error back to the step that renders it, so a
 * refusal from the server can put the seller in front of the field it names.
 */
const STEPS = [
  { id: "details", labelKey: "form.steps.details", errorKey: /^(sku|nameEn|nameAr|moq|categoryId|brandId|origin|tags)/ },
  { id: "description", labelKey: "form.steps.description", errorKey: /^description(En|Ar)/ },
  { id: "commerce", labelKey: "form.steps.commerce", errorKey: /^(isB2CEnabled|isB2BEnabled|prices)/ },
  { id: "stock", labelKey: "form.steps.stock", errorKey: /^stockQty/ },
  { id: "images", labelKey: "form.steps.images", errorKey: /^images/ },
] as const;

type StepId = (typeof STEPS)[number]["id"];

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
  const t = useTranslations("sellerCatalog");
  const { toast } = useToast();

  const originOptions: ProductFormOption[] = ORIGIN_CODES.map((code) => ({
    value: code,
    label: t(`form.origin.${code}`),
  }));

  const [values, setValues] = React.useState<ProductFormValues>(initial);
  const [state, setState] = React.useState<ProductFormState>({});
  const [pending, setPending] = React.useState<null | "SAVE" | "SAVE_DRAFT" | "SUBMIT_FOR_REVIEW">(null);
  const [step, setStep] = React.useState<StepId>("details");
  const categoryLabelId = React.useId();
  const brandLabelId = React.useId();
  const errorRef = React.useRef<HTMLDivElement>(null);

  const set = React.useCallback(<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  }, []);

  const fieldError = (path: string) => state.fieldErrors?.[path];

  /** Which steps are currently carrying a refusal, for the rail's markers. */
  const stepsWithErrors = React.useMemo(() => {
    const keys = Object.keys(state.fieldErrors ?? {});
    return new Set(STEPS.filter((entry) => keys.some((key) => entry.errorKey.test(key))).map((entry) => entry.id));
  }, [state.fieldErrors]);

  /**
   * Put the seller in front of the first field that was refused. A stepped form
   * that reports "correct the highlighted fields" while the highlighted field is
   * on a step nobody is looking at is worse than one long scroll.
   */
  const goToFirstError = React.useCallback((fieldErrors: Record<string, string> | undefined) => {
    const keys = Object.keys(fieldErrors ?? {});
    if (keys.length === 0) return;
    const target = STEPS.find((entry) => keys.some((key) => entry.errorKey.test(key)));
    if (target) setStep(target.id);
  }, []);

  // A refusal is the one thing in this form that takes the focus, because it is
  // the one thing that can arrive while the seller is looking somewhere else.
  React.useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);

  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  // ── VAT ────────────────────────────────────────────────────────────────────
  const currencyOptions = vatTable.map((row) => row.currency);
  const statutoryFor = (currency: string) => vatTable.find((row) => row.currency === currency) ?? null;
  const defaultCurrency = currencyOptions.includes("AED") ? "AED" : currencyOptions[0] ?? "";

  // ── Images ─────────────────────────────────────────────────────────────────
  const [uploadNotice, setUploadNotice] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [imageDragging, setImageDragging] = React.useState(false);
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
      for (const file of Array.from(files).slice(0, IMAGE_MAX_COUNT - values.images.length)) {
        if (file.size > IMAGE_MAX_BYTES) {
          setUploadNotice(t("form.images.tooLarge", { name: file.name, mb: IMAGE_MAX_MB }));
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
          setUploadNotice(t("form.images.unreachable"));
          return;
        }

        const body = (await grant.json().catch(() => null)) as
          | { success?: boolean; error?: string; data?: { url?: string; headers?: Record<string, string>; publicUrl?: string | null } }
          | null;

        if (!grant.ok || body?.success === false || !body?.data) {
          setUploadNotice(body?.error ?? t("form.images.unavailable", { status: String(grant.status) }));
          return;
        }

        const { url, headers, publicUrl } = body.data;
        if (typeof url !== "string" || typeof publicUrl !== "string") {
          // A grant this form cannot use is treated as no grant. Guessing a
          // readable URL would put a broken image into the catalog.
          setUploadNotice(t("form.images.unusableGrant"));
          return;
        }

        const put = await fetch(url, { method: "PUT", body: file, headers: headers ?? undefined }).catch(() => null);
        if (!put || !put.ok) {
          // The HTTP status is reported when there is one and silently absent
          // when the request never reached a response at all — two different
          // facts, so they get two messages rather than one with a hole in it.
          setUploadNotice(
            put
              ? t("form.images.putFailedWithStatus", { name: file.name, status: String(put.status) })
              : t("form.images.putFailed", { name: file.name }),
          );
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
        setAiNotice(body?.error ?? t("form.ai.couldNotGenerate"));
        return;
      }
      // `ai: false` means no model produced this text — the payload is a status
      // message, not copy. Offering it as a description would put a service
      // notice into the catalog, so it is shown as a notice and nothing more.
      if (body?.data?.ai === false) {
        setAiNotice(body?.data?.text ?? t("form.ai.unavailable"));
        return;
      }
      const text = String(body?.data?.text ?? "").trim();
      if (!text) {
        setAiNotice(t("form.ai.emptyDraft"));
        return;
      }
      setAiResult(text);
    } catch {
      setAiNotice(t("form.ai.unreachable"));
    } finally {
      setAiLoading(false);
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function buildPayload(): { payload: Record<string, unknown> } | { localErrors: Record<string, string> } {
    const localErrors: Record<string, string> = {};

    const moq = toInt(values.moq);
    if (moq === null || moq < 1) localErrors["moq"] = t("form.errors.wholeUnitsMin1");

    const prices = values.prices.map((row, index) => {
      const minQty = toInt(row.minQty);
      const maxQty = row.maxQty.trim() === "" ? null : toInt(row.maxQty);
      if (minQty === null || minQty < 1) localErrors[`prices.${index}.minQty`] = t("form.errors.wholeNumberMin1");
      if (row.maxQty.trim() !== "" && maxQty === null) localErrors[`prices.${index}.maxQty`] = t("form.errors.wholeNumberOrBlank");
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
      if (parsed === null || parsed < 0) localErrors["stockQty"] = t("form.errors.wholeUnitsMin0");
      else stockQty = parsed;
      if (mode === "edit") {
        // What the page showed when it opened; the server refuses the save if
        // the live row no longer matches it.
        if (initial.stockQty.trim() === "") {
          stockQtyAsLoaded = null;
        } else {
          const loaded = toInt(initial.stockQty);
          if (loaded === null) localErrors["stockQty"] = t("form.errors.stockUnreadable");
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
      setState({ error: t("form.errors.correctHighlighted"), fieldErrors: built.localErrors });
      goToFirstError(built.localErrors);
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
        goToFirstError(result.fieldErrors);
        if (result.error) toast({ title: result.error, variant: "error" });
        return;
      }

      toast({
        title: mode === "create" ? t("form.toast.created") : t("form.toast.saved"),
        description:
          intent === "SUBMIT_FOR_REVIEW"
            ? t("form.toast.sentForReview", { platform: platformName() })
            : intent === "SAVE_DRAFT"
              ? t("form.toast.savedDraft")
              : t("form.toast.statusUnchanged"),
        variant: "success",
      });
      router.push("/products");
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : t("form.errors.couldNotSave") });
    } finally {
      setPending(null);
    }
  }

  // Editing a listing the seller cannot move back into review: the status
  // controls are hidden rather than shown as no-ops.
  const canChangeStatus = mode === "create" || ["DRAFT", "PENDING_REVIEW", "REJECTED"].includes(currentStatus ?? "");
  const busy = pending !== null;

  // The state named inside the banner's sentence, which is not the same string
  // as the pill's label: "This listing is in review" needs the in-sentence form.
  // A status nobody has labelled yet still reads as itself rather than vanishing.
  const currentStatusMeta = statusMeta(currentStatus ?? "");
  const currentStatusWord = currentStatusMeta.labelKey
    ? t(`form.state.${currentStatus}`)
    : currentStatusMeta.fallbackLabel;

  // Server-side field errors that no input below renders (e.g. images.2.url or
  // tags.4). They are listed under the top-level error so "correct the
  // highlighted fields" never points at nothing.
  const renderedErrorKeys = /^(sku|nameEn|nameAr|moq|categoryId|brandId|origin|descriptionEn|descriptionAr|isB2BEnabled|prices|stockQty|images|prices\.\d+\.(type|currency|price|minQty|maxQty))$/;
  const unrenderedErrors = Object.entries(state.fieldErrors ?? {}).filter(([key]) => !renderedErrorKeys.test(key));

  return (
    <div className="max-w-4xl space-y-4 pb-4">
      <Link
        href="/products"
        className="u-focus inline-flex items-center gap-1.5 rounded-nested text-ui text-ink-2 transition-colors duration-press ease-standard hover:text-ink-1"
      >
        {/* A direction-implying icon has to flip in Arabic. */}
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t("form.backToProducts")}
      </Link>

      {/* Governance banner — states exactly what saving does and does not do.
          Recessed, because it is context about the save, not a thing to press. */}
      <FieldWell padded className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
        <div className="space-y-1">
          {mode === "create" ? (
            <>
              <p className="u-body font-medium text-ink-1">{t("form.banner.create.headline")}</p>
              <p className="u-ui max-w-prose text-ink-2">{t("form.banner.create.body", { platform: platformName() })}</p>
            </>
          ) : canChangeStatus ? (
            <>
              <p className="u-body font-medium text-ink-1">{t("form.banner.is", { state: currentStatusWord })}</p>
              <p className="u-ui max-w-prose text-ink-2">
                {currentStatus === "PENDING_REVIEW"
                  ? t("form.banner.inReviewBody")
                  : t("form.banner.draftableBody", { platform: platformName() })}
              </p>
            </>
          ) : (
            <>
              <p className="u-body font-medium text-ink-1">{t("form.banner.isImmediate", { state: currentStatusWord })}</p>
              <p className="u-ui max-w-prose text-ink-2">{t("form.banner.immediateBody")}</p>
            </>
          )}
        </div>
      </FieldWell>

      {state.error && (
        // Focusable and focused on arrival. The commit buttons live on a bar
        // pinned to the bottom of the viewport, so without this a refusal can
        // land entirely off screen — and when it names a field on another step,
        // the seller is moved to a panel they never saw change.
        <div ref={errorRef} tabIndex={-1} className="u-focus space-y-1.5 rounded-nested" role="alert">
          <p className="flex items-start gap-1.5 text-ui text-danger-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {state.error}
          </p>
          {unrenderedErrors.length > 0 && (
            <ul className="ms-6 list-disc space-y-0.5 text-ui text-danger-ink">
              {unrenderedErrors.map(([key, message]) => (
                <li key={key}>
                  <span className="u-mono text-meta">{key}</span>: {message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* The rail. Every step stays reachable — this is a sequence the seller
          can read ahead in, never a wizard that locks the way back. */}
      <nav aria-label={t("form.steps.railLabel")}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {STEPS.map((entry, index) => {
            const active = entry.id === step;
            const hasError = stepsWithErrors.has(entry.id);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setStep(entry.id)}
                  aria-current={active ? "step" : undefined}
                  // The current step is the one that is RAISED. Depth carries the
                  // position, so the rail needs no colour of its own and the only
                  // colour in it is a genuine refusal.
                  className={[
                    "u-focus inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-ui",
                    "transition-[background-color,border-color,color,box-shadow] duration-hover ease-standard",
                    active
                      ? "border border-border-strong bg-surface-2 text-ink-1 shadow-elev-2"
                      : "border border-transparent text-ink-2 hover:text-ink-1",
                  ].join(" ")}
                >
                  <span className="fig text-meta text-ink-3">{index + 1}</span>
                  {t(entry.labelKey)}
                  {hasError && (
                    <>
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-danger" />
                      <span className="sr-only">{t("form.steps.hasError")}</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ── Basics ───────────────────────────────────────────────────────── */}
      <Surface hidden={step !== "details"} className="space-y-4 p-5">
        <h2 className="u-h3 text-ink-1">{t("form.details.title")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              label={t("form.details.nameEn")}
              value={values.nameEn}
              onChange={(event) => set("nameEn", event.target.value)}
              placeholder={t("form.details.nameEnPlaceholder")}
              error={fieldError("nameEn")}
              required
            />
          </div>
          <div>
            <Input
              label={t("form.details.nameAr")}
              dir="rtl"
              value={values.nameAr}
              onChange={(event) => set("nameAr", event.target.value)}
              placeholder={t("form.details.arabicPlaceholder")}
              error={fieldError("nameAr")}
              hint={t("form.details.nameArHint")}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              label={t("form.details.sku")}
              value={values.sku}
              onChange={(event) => set("sku", event.target.value)}
              placeholder={t("form.details.skuPlaceholder")}
              error={fieldError("sku")}
              hint={t("form.details.skuHint")}
              required
            />
          </div>
          <div>
            <Input
              label={t("form.details.moq")}
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
          {/* Not a <label>: Combobox renders a button, and a <label> cannot be
              associated with one, so the label written here before pointed at
              nothing. Combobox also forwards no id or aria-labelledby, so until
              it does (raised as a packages/ui request) the caption is tied to
              the control through a named group — which assistive technology does
              announce on entry — and the trigger's own name still comes from the
              placeholder or the chosen value. */}
          <div role="group" aria-labelledby={categoryLabelId}>
            <span className={LABEL} id={categoryLabelId}>
              {t("form.details.category")}
            </span>
            <Combobox
              options={categories}
              value={values.categoryId}
              onValueChange={(value) => set("categoryId", value)}
              placeholder={t("form.details.categoryPlaceholder")}
              searchPlaceholder={t("form.details.categorySearch")}
              emptyText={t("form.details.categoryEmpty")}
            />
            {fieldError("categoryId") && <p className={FIELD_ERROR}>{fieldError("categoryId")}</p>}
          </div>
          <div role="group" aria-labelledby={brandLabelId}>
            <span className={LABEL} id={brandLabelId}>
              {t("form.details.brand")}
            </span>
            <Combobox
              options={brands}
              value={values.brandId}
              onValueChange={(value) => set("brandId", value)}
              placeholder={t("form.details.brandPlaceholder")}
              searchPlaceholder={t("form.details.brandSearch")}
              emptyText={t("form.details.brandEmpty")}
            />
            {fieldError("brandId") && <p className={FIELD_ERROR}>{fieldError("brandId")}</p>}
          </div>
          <div>
            <label className={LABEL} htmlFor="product-origin">{t("form.details.origin")}</label>
            <select
              id="product-origin"
              value={values.origin}
              onChange={(event) => set("origin", event.target.value)}
              data-rung={1}
              className={CONTROL}
            >
              <option value="">{t("form.details.originNotStated")}</option>
              {originOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {fieldError("origin") && <p className={FIELD_ERROR}>{fieldError("origin")}</p>}
          </div>
        </div>

        <div>
          <Input
            label={t("form.details.tags")}
            value={values.tags}
            onChange={(event) => set("tags", event.target.value)}
            placeholder={t("form.details.tagsPlaceholder")}
            hint={t("form.details.tagsHint")}
          />
        </div>
      </Surface>

      {/* ── Description + AI ─────────────────────────────────────────────── */}
      <Surface hidden={step !== "description"} className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="u-h3 text-ink-1">{t("form.description.title")}</h2>
          {/* Secondary, not a gradient fill: drafting copy is an assist, and the
              page's single primary action is the one that saves the listing. */}
          <Button variant="secondary" size="sm" onClick={openAi} aria-expanded={aiOpen} aria-controls="ai-draft-panel">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t("form.description.draftWithAi")}
          </Button>
        </div>

        {aiOpen && (
          <FieldWell padded id="ai-draft-panel" className="space-y-3">
            <label className="u-meta block font-medium text-ink-2" htmlFor="ai-context">
              {t("form.description.aiContextLabel")}
            </label>
            <Textarea
              id="ai-context"
              rows={2}
              value={aiContext}
              onChange={(event) => setAiContext(event.target.value)}
              placeholder={t("form.description.aiContextPlaceholder")}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={generateDescription} loading={aiLoading}>
                {!aiLoading && <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {aiResult ? t("form.description.regenerate") : t("form.description.generate")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAiOpen(false)}>
                {t("form.description.close")}
              </Button>
            </div>

            {aiNotice && (
              <p role="status" className="flex items-start gap-1.5 text-meta text-danger-ink">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {aiNotice}
              </p>
            )}

            {aiResult && (
              // An opaque plate over the recessed well: the draft is the thing to
              // read, so it sits on a surface of its own rather than on the wash.
              <Surface className="space-y-3 p-3.5">
                <p className="u-ui whitespace-pre-wrap text-ink-1">{aiResult}</p>
                <Divider tone="hairline" />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => { set("descriptionEn", aiResult); setAiOpen(false); }}
                  >
                    {t("form.description.replaceEnglish")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { set("descriptionEn", `${values.descriptionEn}\n\n${aiResult}`.trim()); setAiOpen(false); }}
                  >
                    {t("form.description.appendToIt")}
                  </Button>
                </div>
                {/* LAW E: where this text came from is a fact about the text, so
                    it is set in the provenance voice rather than as fine print. */}
                <Dateline>{t("form.description.provenance")}</Dateline>
              </Surface>
            )}
          </FieldWell>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="description-en">{t("form.description.english")}</label>
            <Textarea
              id="description-en"
              rows={6}
              value={values.descriptionEn}
              onChange={(event) => set("descriptionEn", event.target.value)}
              placeholder={t("form.description.englishPlaceholder")}
            />
            {fieldError("descriptionEn") && <p className={FIELD_ERROR}>{fieldError("descriptionEn")}</p>}
          </div>
          <div>
            <label className={LABEL} htmlFor="description-ar">{t("form.description.arabic")}</label>
            <Textarea
              id="description-ar"
              dir="rtl"
              rows={6}
              value={values.descriptionAr}
              onChange={(event) => set("descriptionAr", event.target.value)}
              placeholder={t("form.details.arabicPlaceholder")}
            />
            {fieldError("descriptionAr") && <p className={FIELD_ERROR}>{fieldError("descriptionAr")}</p>}
          </div>
        </div>
      </Surface>

      {/* ── Channels ─────────────────────────────────────────────────────── */}
      <Surface hidden={step !== "commerce"} className="space-y-4 p-5">
        <h2 className="u-h3 text-ink-1">{t("form.channels.title")}</h2>
        <p className="u-ui max-w-prose text-ink-2">{t("form.channels.body")}</p>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-ui text-ink-1">
            <input
              type="checkbox"
              checked={values.isB2CEnabled}
              onChange={(event) => set("isB2CEnabled", event.target.checked)}
              className="u-focus h-4 w-4 rounded-sm border-border accent-primary"
            />
            {t("form.channels.b2c")}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-ui text-ink-1">
            <input
              type="checkbox"
              checked={values.isB2BEnabled}
              onChange={(event) => set("isB2BEnabled", event.target.checked)}
              className="u-focus h-4 w-4 rounded-sm border-border accent-primary"
            />
            {t("form.channels.b2b")}
          </label>
        </div>
        {fieldError("isB2BEnabled") && <p className={FIELD_ERROR}>{fieldError("isB2BEnabled")}</p>}
      </Surface>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <Surface hidden={step !== "commerce"} className="space-y-4 p-5">
        <h2 className="u-h3 text-ink-1">{t("form.pricing.title")}</h2>

        {!canManagePricing ? (
          <p className="flex items-start gap-2 text-ui text-ink-2">
            <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {/* The capability is a code identifier, so it stays in the mono
                face and untranslated inside the translated sentence. */}
            <span>
              {t.rich("form.pricing.noCapability", {
                code: (chunks) => <span className="u-mono text-meta text-ink-1">{chunks}</span>,
              })}
            </span>
          </p>
        ) : vatTable.length === 0 ? (
          <p className="flex items-start gap-2 text-ui text-danger-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t("form.pricing.noVatTable")}
          </p>
        ) : (
          <>
            <FieldWell padded className="space-y-1.5">
              <Eyebrow>{t("form.pricing.vatEyebrow")}</Eyebrow>
              <p className="u-ui max-w-prose text-ink-2">{t("form.pricing.vatBody")}</p>
              <p className="u-ui max-w-prose text-ink-2">{t("form.pricing.vatNoJurisdiction")}</p>
              <p className="u-ui max-w-prose text-ink-2">{t("form.pricing.vatTiers")}</p>
              {/* The table itself is the source being cited, so it is set in the
                  provenance voice rather than buried in the paragraph above. */}
              <Dateline className="pt-1">
                {t("form.pricing.statutoryTable")}{" "}
                {vatTable.map((row) => `${row.currency} → ${row.rate}% (${row.country})`).join(" · ")}
              </Dateline>
            </FieldWell>

            {values.prices.length === 0 && (
              <p className="u-ui text-ink-2">{t("form.pricing.noPriceYet")}</p>
            )}

            <div className="space-y-3">
              {values.prices.map((row, index) => {
                const statutory = statutoryFor(row.currency);
                const mismatch = statutory ? ratesDisagree(row.storedVatRate, statutory.rate) : false;
                return (
                  <FieldWell key={row.id ?? `new-${index}`} padded className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-5">
                      <div>
                        <label className={LABEL} htmlFor={`price-type-${index}`}>{t("form.pricing.channel")}</label>
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
                          data-rung={1}
                          className={CONTROL}
                        >
                          <option value="B2C">B2C</option>
                          <option value="B2B">B2B</option>
                        </select>
                        {fieldError(`prices.${index}.type`) && <p className={FIELD_ERROR}>{fieldError(`prices.${index}.type`)}</p>}
                      </div>
                      <div>
                        <label className={LABEL} htmlFor={`price-currency-${index}`}>{t("form.pricing.currency")}</label>
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
                          data-rung={1}
                          className={CONTROL}
                        >
                          {currencyOptions.map((currency) => (
                            <option key={currency} value={currency}>{currency}</option>
                          ))}
                        </select>
                        {fieldError(`prices.${index}.currency`) && <p className={FIELD_ERROR}>{fieldError(`prices.${index}.currency`)}</p>}
                      </div>
                      <div>
                        <Input
                          label={t("form.pricing.unitPrice")}
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
                          label={t("form.pricing.minQty")}
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
                          label={t("form.pricing.maxQty")}
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
                      <Dateline>
                        {statutory
                          ? t("form.pricing.vatRow", {
                              rate: String(statutory.rate),
                              country: statutory.country,
                            })
                          : t("form.pricing.vatRowUnavailable")}
                      </Dateline>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-danger-ink"
                        onClick={() =>
                          setValues((previous) => ({ ...previous, prices: previous.prices.filter((_, i) => i !== index) }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("form.pricing.remove")}
                        <span className="sr-only">
                          {" "}
                          {t("form.pricing.removeRow", { channel: row.type, currency: row.currency })}
                        </span>
                      </Button>
                    </div>

                    {mismatch && statutory && (
                      <p className="flex items-start gap-1.5 text-meta text-warning-ink">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {t("form.pricing.vatMismatch", {
                            stored: String(row.storedVatRate),
                            country: statutory.country,
                            rate: String(statutory.rate),
                          })}
                        </span>
                      </p>
                    )}
                  </FieldWell>
                );
              })}
            </div>

            {values.prices.length < 12 && defaultCurrency && (
              <div className="flex flex-wrap gap-2">
                {values.isB2CEnabled && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setValues((previous) => ({ ...previous, prices: [...previous.prices, emptyPriceRow("B2C", defaultCurrency)] }))}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("form.pricing.addB2C")}
                  </Button>
                )}
                {values.isB2BEnabled && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setValues((previous) => ({ ...previous, prices: [...previous.prices, emptyPriceRow("B2B", defaultCurrency)] }))}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("form.pricing.addB2B")}
                  </Button>
                )}
              </div>
            )}
            {fieldError("prices") && <p className={FIELD_ERROR}>{fieldError("prices")}</p>}
          </>
        )}
      </Surface>

      {/* ── Stock ────────────────────────────────────────────────────────── */}
      <Surface hidden={step !== "stock"} className="space-y-4 p-5">
        <h2 className="u-h3 text-ink-1">{t("form.stock.title")}</h2>
        {!canManageInventory ? (
          <p className="flex items-start gap-2 text-ui text-ink-2">
            <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {t.rich("form.stock.noCapability", {
                code: (chunks) => <span className="u-mono text-meta text-ink-1">{chunks}</span>,
              })}
            </span>
          </p>
        ) : stockIsSplit ? (
          <p className="flex items-start gap-2 text-ui text-ink-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {/* The link travels inside the sentence, because in Arabic it does
                not sit where it does in English. */}
            <span>
              {t.rich("form.stock.split", {
                link: (chunks) => (
                  <Link href="/inventory" className="u-focus rounded-nested text-primary-ink hover:underline">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </p>
        ) : (
          <div className="max-w-xs">
            <Input
              label={mode === "create" ? t("form.stock.openingLabel") : t("form.stock.label")}
              type="number"
              min={0}
              step={1}
              value={values.stockQty}
              onChange={(event) => set("stockQty", event.target.value)}
              error={fieldError("stockQty")}
              hint={
                typeof reservedQty === "number" && reservedQty > 0
                  ? t("form.stock.reservedHint", { count: reservedQty, n: String(reservedQty) })
                  : mode === "create"
                    ? t("form.stock.openingHint")
                    : t("form.stock.hint")
              }
            />
          </div>
        )}
      </Surface>

      {/* ── Images ───────────────────────────────────────────────────────── */}
      <Surface hidden={step !== "images"} className="space-y-4 p-5">
        <h2 className="u-h3 text-ink-1">{t("form.images.title")}</h2>

        {values.images.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {values.images.map((image, index) => (
              <li key={image.id ?? image.url} className="relative w-24">
                {/* THE FRAME, and this is the single most important place in the
                    portal for it: this preview is the supplier's own photograph,
                    and it is exactly what a buyer will see on the storefront. It
                    used `object-cover`, so the one screen where a supplier checks
                    their photo was also the one screen showing it cropped —
                    approving an image here whose valve or label the shopper never
                    sees. <ImageFrame> contains it, insets it off its own edge, and
                    lights it on the same plate the storefront card uses, so what
                    is approved here is what ships. It renders a plain <img> for
                    the same reason this cell already did: uploaded objects live on
                    the storage host, which is not in next.config's image
                    remotePatterns allowlist. */}
                <ImageFrame
                  src={image.url}
                  alt={image.altEn ?? values.nameEn}
                  className="h-24 w-24 rounded-nested border border-border"
                />
                {index === 0 && (
                  // An opaque plate, never text straight onto a photograph: the
                  // contrast of a label on an unknown image is not testable.
                  <span className="u-micro absolute start-1 top-1 rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-ink-1">
                    {t("form.images.primary")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setValues((previous) => ({ ...previous, images: previous.images.filter((_, i) => i !== index) }))}
                  className="u-focus absolute -end-2 -top-2 grid h-6 w-6 place-items-center rounded-pill bg-danger text-danger-foreground shadow-elev-2"
                  aria-label={t("form.images.removeImage", { position: String(index + 1) })}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
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
              className="sr-only"
              onChange={(event) => event.target.files && uploadFiles(event.target.files)}
            />
            {/* A real <button> carrying the drop handlers, so the target is
                reachable from the keyboard and shows the system focus ring.
                Dragging is an enhancement on top of it, never the only way in. */}
            <button
              type="button"
              disabled={uploading || values.images.length >= IMAGE_MAX_COUNT}
              onClick={() => fileRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setImageDragging(true); }}
              onDragOver={(event) => { event.preventDefault(); setImageDragging(true); }}
              onDragLeave={() => setImageDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setImageDragging(false);
                if (!uploading && event.dataTransfer.files?.length) void uploadFiles(event.dataTransfer.files);
              }}
              data-dragging={imageDragging ? "true" : "false"}
              data-rung={1}
              className={[
                "u-focus flex w-full flex-col items-center gap-2 border-2 border-dashed border-border px-6 py-8 text-center",
                "transition-[border-color,background-color] duration-hover ease-standard",
                "hover:border-border-strong disabled:opacity-60",
                "data-[dragging=true]:border-primary",
              ].join(" ")}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-ink-3" aria-hidden="true" />
              ) : (
                <UploadCloud className="h-6 w-6 text-ink-3" aria-hidden="true" />
              )}
              <span className="u-body font-medium text-ink-1">
                {uploading
                  ? t("form.images.uploading")
                  : values.images.length >= IMAGE_MAX_COUNT
                    ? t("form.images.atCeiling", { max: String(IMAGE_MAX_COUNT) })
                    : imageDragging
                      ? t("form.images.dropToUpload")
                      : t("form.images.dropzoneIdle")}
              </span>
              <span className="u-meta text-ink-3">
                {/* The file extensions are format identifiers, so they are passed
                    through the sentence rather than translated. */}
                {t("form.images.policy", {
                  types: IMAGE_TYPE_LABEL,
                  mb: IMAGE_MAX_MB,
                  max: String(IMAGE_MAX_COUNT),
                })}
              </span>
            </button>
            <Dateline>{t("form.images.primaryNote")}</Dateline>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-ui text-ink-2">
            <ImageOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {/* A disclosure about what this environment cannot do, so it keeps
                its whole shape — including where the seller goes to see the
                issue it will raise. */}
            <span>
              {t.rich("form.images.uploadsDisabled", {
                link: (chunks) => (
                  <Link href="/issues" className="u-focus rounded-nested text-primary-ink hover:underline">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </p>
        )}

        {uploadNotice && (
          <p role="status" className="flex items-start gap-1.5 text-ui text-warning-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {uploadNotice}
          </p>
        )}
        {fieldError("images") && <p className={FIELD_ERROR}>{fieldError("images")}</p>}
      </Surface>

      {/* ── The sequence bar ─────────────────────────────────────────────
          Raised and opaque, pinned to the bottom of the viewport: it carries the
          step position, the way forward and back, and the two commit actions, so
          a seller never has to scroll to the end of a step to save. Opaque
          rather than glass because body text and a commit action live on it. */}
      <Surface rung={4} className="sticky bottom-4 z-sticky flex flex-wrap items-center gap-2 p-3">
        <div className="min-w-0">
          <Eyebrow>
            {t.rich("form.bar.step", {
              current: String(stepIndex + 1),
              total: String(STEPS.length),
              fig: (chunks) => <span className="fig">{chunks}</span>,
            })}
          </Eyebrow>
          <p className="u-ui text-ink-1">{STEPS[stepIndex] ? t(STEPS[stepIndex].labelKey) : ""}</p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={stepIndex === 0}
            onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].id)}
          >
            {/* Direction-implying icons flip in Arabic. */}
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t("form.bar.back")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={stepIndex === STEPS.length - 1}
            onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].id)}
          >
            {t("form.bar.next")} <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {canChangeStatus ? (
            <>
              {/* On a listing already in the queue, plain "save" must not silently
                  withdraw it, so the draft action is named for what it does. */}
              {mode === "edit" && currentStatus === "PENDING_REVIEW" ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    loading={pending === "SAVE_DRAFT"}
                    onClick={() => submit("SAVE_DRAFT")}
                  >
                    {pending !== "SAVE_DRAFT" && <Save className="h-4 w-4" aria-hidden="true" />}
                    {t("form.bar.withdrawToDraft")}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    loading={pending === "SAVE"}
                    onClick={() => submit("SAVE")}
                  >
                    {pending !== "SAVE" && <Save className="h-4 w-4" aria-hidden="true" />}
                    {t("form.bar.saveStaysInReview")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    loading={pending === "SAVE_DRAFT"}
                    onClick={() => submit("SAVE_DRAFT")}
                  >
                    {pending !== "SAVE_DRAFT" && <Save className="h-4 w-4" aria-hidden="true" />}
                    {t("form.bar.saveAsDraft")}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    loading={pending === "SUBMIT_FOR_REVIEW"}
                    onClick={() => submit("SUBMIT_FOR_REVIEW")}
                  >
                    {pending !== "SUBMIT_FOR_REVIEW" && <Send className="h-4 w-4" aria-hidden="true" />}
                    {currentStatus === "REJECTED" ? t("form.bar.resubmitForReview") : t("form.bar.submitForReview")}
                  </Button>
                </>
              )}
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              loading={pending === "SAVE"}
              onClick={() => submit("SAVE")}
            >
              {pending !== "SAVE" && <Save className="h-4 w-4" aria-hidden="true" />}
              {t("form.bar.saveChanges")}
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/products">{t("form.bar.cancel")}</Link>
          </Button>
        </div>
      </Surface>
    </div>
  );
}
