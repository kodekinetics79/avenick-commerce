import { z } from "zod";
import type { Currency } from "@avenick/database";

export const PRODUCT_CURRENCIES = ["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"] as const satisfies readonly Currency[];
export const PRODUCT_ORIGINS = ["AE", "SA", "QA", "KW", "OM", "BH"] as const;
export const SELLER_MUTABLE_PRODUCT_STATUSES = ["DRAFT", "PENDING_REVIEW", "SUPPRESSED", "INACTIVE"] as const;

function isTrustedProductImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname === "placehold.co"
      || url.hostname === "www.mennekes.org"
      || url.hostname === "avenick.com"
      || url.hostname.endsWith(".avenick.com")
    );
  } catch {
    return false;
  }
}

const optionalText = (limit: number) => z.preprocess(
  (value) => value == null || value === "" ? undefined : value,
  z.string().trim().max(limit).optional(),
);
const optionalPositiveMoney = z.preprocess(
  (value) => value === "" || value == null ? undefined : Number(value),
  z.number().positive().max(999_999_999.99).optional(),
);

export const SellerProductFormSchema = z.object({
  categoryId: z.string().trim().min(1, "Choose a category."),
  sku: z.string().trim().min(2, "SKU must have at least 2 characters.").max(80).regex(/^[A-Za-z0-9._/-]+$/, "SKU may use letters, numbers, dot, underscore, slash and hyphen."),
  nameEn: z.string().trim().min(3, "English product name must have at least 3 characters.").max(180),
  nameAr: z.string().trim().min(3, "Arabic product name must have at least 3 characters.").max(180),
  descriptionEn: optionalText(5_000),
  descriptionAr: optionalText(5_000),
  imageUrl: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().url("Enter a valid image URL.").refine(isTrustedProductImageUrl, "Use an approved Avenick or manufacturer image host.").optional(),
  ),
  origin: z.preprocess((value) => value === "" ? undefined : value, z.enum(PRODUCT_ORIGINS).optional()),
  moq: z.coerce.number().int().min(1).max(1_000_000),
  currency: z.enum(PRODUCT_CURRENCIES),
  vatRate: z.coerce.number().min(0).max(100),
  b2bEnabled: z.boolean(),
  b2cEnabled: z.boolean(),
  b2bPrice: optionalPositiveMoney,
  b2cPrice: optionalPositiveMoney,
}).superRefine((value, ctx) => {
  if (!value.b2bEnabled && !value.b2cEnabled) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["b2bEnabled"], message: "Enable at least one sales channel." });
  }
  if (value.b2bEnabled && value.b2bPrice == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["b2bPrice"], message: "Enter a B2B price." });
  }
  if (value.b2cEnabled && value.b2cPrice == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["b2cPrice"], message: "Enter a B2C price." });
  }
});

export type SellerProductFormValue = z.infer<typeof SellerProductFormSchema>;

export function parseSellerProductForm(formData: FormData) {
  return SellerProductFormSchema.safeParse({
    categoryId: formData.get("categoryId"),
    sku: formData.get("sku"),
    nameEn: formData.get("nameEn"),
    nameAr: formData.get("nameAr"),
    descriptionEn: formData.get("descriptionEn"),
    descriptionAr: formData.get("descriptionAr"),
    imageUrl: formData.get("imageUrl"),
    origin: formData.get("origin"),
    moq: formData.get("moq"),
    currency: formData.get("currency"),
    vatRate: formData.get("vatRate"),
    b2bEnabled: formData.get("b2bEnabled") === "on",
    b2cEnabled: formData.get("b2cEnabled") === "on",
    b2bPrice: formData.get("b2bPrice"),
    b2cPrice: formData.get("b2cPrice"),
  });
}

export function countryCommerceDefaults(country: string) {
  const currency: Currency = ({ AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", OM: "OMR", BH: "BHD" } as const)[country as "AE"] ?? "USD";
  const vatRate = ({ AE: 5, SA: 15, QA: 0, KW: 0, OM: 5, BH: 10 } as const)[country as "AE"] ?? 0;
  return { currency, vatRate };
}
