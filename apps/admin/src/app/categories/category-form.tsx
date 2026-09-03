"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Pencil, X } from "lucide-react";
import { Button, Dateline, Field, Input, Surface } from "@avenick/ui";
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
  // The active-checkbox message is a plain reserved line rather than a <Field>,
  // because Field puts its label above the control and a checkbox's label sits
  // beside it. It still has to be announced with the control, so it carries an id.
  const activeMessageId = useId();

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
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {defaultParentId ? "Add subcategory" : "New Category"}
      </Button>
    ) : (
      <Button type="button" variant="link" size="xs" onClick={() => setOpen(true)}>
        <Pencil className="h-3 w-3" aria-hidden="true" />
        Edit<span className="sr-only"> {category?.nameEn ?? "category"}</span>
      </Button>
    );
  }

  return (
    // Rung 2: the edit panel is an object standing on the list's recessed well,
    // and the fields inside it are the recessed things. Raised = actionable,
    // recessed = input, and a form gets to show both at once.
    <Surface
      rung={2}
      as="form"
      onSubmit={submit}
      className="w-full basis-full space-y-3 p-4"
      aria-label={mode === "edit" ? `Edit ${category?.nameEn ?? "category"}` : "New category"}
    >
      <div className="flex items-center justify-between">
        <p className="u-h3 text-ink-1">{mode === "edit" ? "Edit category" : defaultParentId ? "New subcategory" : "New category"}</p>
        <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
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
        <Field
          label="Parent category"
          htmlFor={`parent-${category?.id ?? "new"}`}
          error={errors.parentId}
          hint="A category cannot be moved under itself or its own descendants."
        >
          {/* A native select, kept deliberately: it is the one control on this
              form that has to work with a hardware keyboard, a screen reader and
              a phone's own picker. It carries data-rung so it takes the system's
              recessed surface rather than a hand-written box. */}
          <select
            id={`parent-${category?.id ?? "new"}`}
            data-rung={1}
            aria-invalid={errors.parentId ? true : undefined}
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            disabled={pending}
            className="u-focus w-full border border-input bg-surface-1 px-3 text-ui text-ink-1 outline-none transition-[border-color,box-shadow] duration-press ease-standard disabled:cursor-not-allowed disabled:opacity-50"
            style={{ height: "var(--control-h-md)" }}
          >
            <option value="">Top level</option>
            {parentChoices.map((option) => (
              <option key={option.id} value={option.id}>
                {`${"  ".repeat(option.depth)}${option.nameEn}`}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col justify-end">
          <label className="u-ui inline-flex items-center gap-2 text-ink-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={pending}
              aria-invalid={errors.isActive ? true : undefined}
              aria-describedby={activeMessageId}
              className="u-focus h-4 w-4 rounded-sm border-input accent-primary"
            />
            Active (shown in storefront navigation)
          </label>
          {/* The line is reserved either way, so an error never shifts the
              buttons beneath it up or down the page. It is wired to the control
              through aria-describedby so the refusal is announced with the
              checkbox rather than sitting beside it unread. */}
          <p id={activeMessageId} className="u-meta mt-1 min-h-[18px] text-danger-ink">{errors.isActive ?? ""}</p>
        </div>
      </div>
      {formError && (
        // A save that did not happen is not fine print, and it is the same class
        // of event as a refused decision elsewhere in this console: nothing was
        // written and nothing was reloaded. It is given the same shape.
        <Surface rung={2} tone="danger" role="alert" className="border-s-4 border-s-danger p-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
            <div className="min-w-0">
              <p className="u-ui text-ink-1">{formError}</p>
              <Dateline>Nothing was saved · this form still holds everything you typed</Dateline>
            </div>
          </div>
        </Surface>
      )}
      <div className="flex items-center gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={close} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          {mode === "edit" ? "Save changes" : "Create category"}
        </Button>
      </div>
    </Surface>
  );
}
