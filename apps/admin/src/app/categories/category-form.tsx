"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X } from "lucide-react";
import { Button, Input } from "@avenick/ui";
import { slugify } from "@avenick/utils";
import { createCategoryAction, updateCategoryAction } from "./actions";

export interface CategoryOption {
  id: string;
  nameEn: string;
  parentId: string | null;
}

interface Existing {
  id: string;
  nameEn: string;
  nameAr: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface Props {
  mode: "create" | "edit";
  category?: Existing;
  /** Every category in the tree; the form removes the ones that cannot be a parent. */
  options: CategoryOption[];
  /** Pre-select a parent when creating from a row's "add subcategory". */
  defaultParentId?: string | null;
}

interface FieldErrors {
  [field: string]: string | undefined;
}

/** Ids of `rootId` and everything below it, computed from the flat option list. */
function subtree(options: CategoryOption[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const option of options) {
      if (option.parentId && ids.has(option.parentId) && !ids.has(option.id)) {
        ids.add(option.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Depth-first ordering with an indent so the parent select reads as a tree. */
function orderedOptions(options: CategoryOption[]): Array<CategoryOption & { depth: number }> {
  const byParent = new Map<string | null, CategoryOption[]>();
  for (const option of options) {
    const list = byParent.get(option.parentId) ?? [];
    list.push(option);
    byParent.set(option.parentId, list);
  }
  const out: Array<CategoryOption & { depth: number }> = [];
  const visit = (parentId: string | null, depth: number, seen: Set<string>) => {
    for (const option of byParent.get(parentId) ?? []) {
      if (seen.has(option.id)) continue;
      seen.add(option.id);
      out.push({ ...option, depth });
      visit(option.id, depth + 1, seen);
    }
  };
  visit(null, 0, new Set());
  return out;
}

/**
 * Create / edit a category inline. The slug follows the English name until
 * the operator edits it by hand, because a slug is a URL the storefront will
 * keep forever and a silent rewrite after publication would break links.
 * Parent choices exclude the category itself and its descendants so a cycle
 * cannot be expressed from this form; the server refuses it independently.
 */
export function CategoryForm({ mode, category, options, defaultParentId = null }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nameEn, setNameEn] = useState(category?.nameEn ?? "");
  const [nameAr, setNameAr] = useState(category?.nameAr ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [parentId, setParentId] = useState<string>(category?.parentId ?? defaultParentId ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const parentChoices = useMemo(() => {
    const excluded = category ? subtree(options, category.id) : new Set<string>();
    return orderedOptions(options).filter((option) => !excluded.has(option.id));
  }, [options, category]);

  function reset() {
    setNameEn(category?.nameEn ?? "");
    setNameAr(category?.nameAr ?? "");
    setSlug(category?.slug ?? "");
    setSlugTouched(mode === "edit");
    setParentId(category?.parentId ?? defaultParentId ?? "");
    setSortOrder(String(category?.sortOrder ?? 0));
    setIsActive(category?.isActive ?? true);
    setErrors({});
    setFormError(null);
  }

  function close() {
    reset();
    setOpen(false);
  }

  function onNameEn(value: string) {
    setNameEn(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const payload = { nameEn, nameAr, slug, parentId: parentId || null, sortOrder, isActive };
    startTransition(async () => {
      const result =
        mode === "edit" && category
          ? await updateCategoryAction({ ...payload, categoryId: category.id })
          : await createCategoryAction(payload);
      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: result.error });
        else setFormError(result.error);
        return;
      }
      router.refresh();
      close();
    });
  }

  if (!open) {
    return mode === "create" ? (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> {defaultParentId ? "Add subcategory" : "New Category"}
      </Button>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
        <Pencil className="h-3 w-3" /> Edit
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="basis-full w-full rounded-xl border border-border bg-background p-4 space-y-3" aria-label={mode === "edit" ? `Edit ${category?.nameEn ?? "category"}` : "New category"}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{mode === "edit" ? "Edit category" : defaultParentId ? "New subcategory" : "New category"}</p>
        <button type="button" onClick={close} aria-label="Close" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Name (English)" value={nameEn} onChange={(event) => onNameEn(event.target.value)} error={errors.nameEn} required maxLength={120} disabled={pending} />
        <Input label="Name (Arabic)" value={nameAr} onChange={(event) => setNameAr(event.target.value)} error={errors.nameAr} required maxLength={120} dir="rtl" disabled={pending} />
        <Input
          label="Slug"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          error={errors.slug}
          hint={slugTouched ? "Edited by hand; no longer follows the English name" : "Follows the English name until you edit it"}
          required
          maxLength={120}
          disabled={pending}
        />
        <Input label="Sort order" type="number" inputMode="numeric" min={0} step={1} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} error={errors.sortOrder} disabled={pending} />
        <div className="w-full">
          <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor={`parent-${category?.id ?? "new"}`}>
            Parent category
          </label>
          <select
            id={`parent-${category?.id ?? "new"}`}
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            disabled={pending}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Top level</option>
            {parentChoices.map((option) => (
              <option key={option.id} value={option.id}>
                {`${"  ".repeat(option.depth)}${option.nameEn}`}
              </option>
            ))}
          </select>
          {errors.parentId && <p className="mt-1 text-xs text-destructive">{errors.parentId}</p>}
        </div>
        <div className="flex flex-col justify-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} disabled={pending} className="h-4 w-4 rounded border-input" />
            Active (shown in storefront navigation)
          </label>
          {errors.isActive && <p className="mt-1 text-xs text-destructive">{errors.isActive}</p>}
        </div>
      </div>
      {formError && (
        <p role="alert" className="text-xs text-destructive">
          {formError}
        </p>
      )}
      <div className="flex items-center gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={close} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          {mode === "edit" ? "Save changes" : "Create category"}
        </Button>
      </div>
    </form>
  );
}
