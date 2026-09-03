"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { createCategory, describeAdminFailure, updateCategory } from "@avenick/database";
import { log } from "@avenick/observability";
import { RECORD_ID } from "@avenick/utils";
import type { ActionResult } from "@/app/approvals/actions";

const recordId = z.string().trim().regex(RECORD_ID, "Invalid reference");

// Slug shape is the customer-facing URL segment; keep it URL-safe by
// construction rather than trusting the client-side slugify.
const categoryInput = z.object({
  nameEn: z.string().trim().min(2, "English name must be at least 2 characters").max(120, "Keep the English name under 120 characters"),
  nameAr: z.string().trim().min(2, "Arabic name must be at least 2 characters").max(120, "Keep the Arabic name under 120 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug must be at least 2 characters")
    .max(120, "Keep the slug under 120 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may contain only lowercase letters, digits and single hyphens"),
  parentId: z.union([recordId, z.literal(""), z.null()]).transform((value) => (value ? value : null)),
  sortOrder: z.coerce.number().int("Sort order must be a whole number").min(0, "Sort order cannot be negative").max(100000, "Sort order is too large"),
  isActive: z.boolean(),
});

// The form posts the number input's raw string; z.coerce accepts it at
// runtime but zod 3 types the coerced input as number, so widen it here.
export type CategoryFormInput = Omit<z.input<typeof categoryInput>, "sortOrder"> & { sortOrder: string | number };

function firstIssue(error: z.ZodError): ActionResult {
  const issue = error.issues[0];
  return { ok: false, error: issue?.message ?? "Invalid input", field: issue?.path[0]?.toString() };
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
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    await createCategory({ ...parsed.data, actorId: userId });
  } catch (error) {
    log.error("admin create category failed", error, { scope: "categories.create", slug: parsed.data.slug });
    return failure(error, "Could not create the category; reload and retry");
  }
  revalidateCategorySurfaces();
  return { ok: true, message: "Category created" };
}

export async function updateCategoryAction(input: CategoryFormInput & { categoryId: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const id = recordId.safeParse(input.categoryId);
  if (!id.success) return { ok: false, error: "Invalid category reference" };
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    await updateCategory({ ...parsed.data, categoryId: id.data, actorId: userId });
  } catch (error) {
    log.error("admin update category failed", error, { scope: "categories.update", categoryId: id.data });
    return failure(error, "Could not save the category; reload and retry");
  }
  revalidateCategorySurfaces();
  return { ok: true, message: "Category saved" };
}
