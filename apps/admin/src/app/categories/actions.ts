"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { createCategory, describeAdminFailure, updateCategory } from "@avenick/database";
import { log } from "@avenick/observability";
import { RECORD_ID } from "@avenick/utils";
import type { ActionResult } from "@/app/approvals/actions";

/** next-intl's translator, as much of it as this module uses. */
type Translator = (key: string, values?: Record<string, string | number>) => string;

// The schemas are built per call rather than at module scope: every message in
// them is read by an administrator, and a translator does not exist until there
// is a request to read the locale from. The validation itself is unchanged —
// the same shapes, the same bounds, the same slug regex.
const recordIdSchema = (t: Translator) => z.string().trim().regex(RECORD_ID, t("actions.category.invalidReference"));

// Slug shape is the customer-facing URL segment; keep it URL-safe by
// construction rather than trusting the client-side slugify.
const categoryInputSchema = (t: Translator) =>
  z.object({
    nameEn: z.string().trim().min(2, t("actions.category.nameEnMin")).max(120, t("actions.category.nameEnMax")),
    nameAr: z.string().trim().min(2, t("actions.category.nameArMin")).max(120, t("actions.category.nameArMax")),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, t("actions.category.slugMin"))
      .max(120, t("actions.category.slugMax"))
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t("actions.category.slugShape")),
    parentId: z.union([recordIdSchema(t), z.literal(""), z.null()]).transform((value) => (value ? value : null)),
    sortOrder: z.coerce
      .number()
      .int(t("actions.category.sortInteger"))
      .min(0, t("actions.category.sortMin"))
      .max(100000, t("actions.category.sortMax")),
    isActive: z.boolean(),
  });

// The form posts the number input's raw string; z.coerce accepts it at
// runtime but zod 3 types the coerced input as number, so widen it here.
export type CategoryFormInput = Omit<z.input<ReturnType<typeof categoryInputSchema>>, "sortOrder"> & {
  sortOrder: string | number;
};

function firstIssue(t: Translator, error: z.ZodError): ActionResult {
  const issue = error.issues[0];
  return { ok: false, error: issue?.message ?? t("actions.invalidInput"), field: issue?.path[0]?.toString() };
}

function failure(error: unknown, fallback: string): ActionResult {
  const field = (error as { field?: string } | null)?.field;
  return { ok: false, error: describeAdminFailure(error, fallback), field };
}

function revalidateCategorySurfaces() {
  revalidatePath("/categories");
  revalidatePath("/products");
}

export async function createCategoryAction(input: CategoryFormInput): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const t = (await getTranslations("adminReview")) as Translator;
  const parsed = categoryInputSchema(t).safeParse(input);
  if (!parsed.success) return firstIssue(t, parsed.error);
  try {
    await createCategory({ ...parsed.data, actorId: userId });
  } catch (error) {
    log.error("admin create category failed", error, { scope: "categories.create", slug: parsed.data.slug });
    return failure(error, t("actions.category.createFallback"));
  }
  revalidateCategorySurfaces();
  return { ok: true, message: t("actions.category.created") };
}

export async function updateCategoryAction(input: CategoryFormInput & { categoryId: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const t = (await getTranslations("adminReview")) as Translator;
  const id = recordIdSchema(t).safeParse(input.categoryId);
  if (!id.success) return { ok: false, error: t("actions.category.invalidCategoryReference") };
  const parsed = categoryInputSchema(t).safeParse(input);
  if (!parsed.success) return firstIssue(t, parsed.error);
  try {
    await updateCategory({ ...parsed.data, categoryId: id.data, actorId: userId });
  } catch (error) {
    log.error("admin update category failed", error, { scope: "categories.update", categoryId: id.data });
    return failure(error, t("actions.category.updateFallback"));
  }
  revalidateCategorySurfaces();
  return { ok: true, message: t("actions.category.saved") };
}
