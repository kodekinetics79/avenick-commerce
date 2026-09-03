import Link from "next/link";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Button, Dateline, EmptyState, Eyebrow, Field, Surface } from "@avenick/ui";
import { TextField } from "@/components/b2b/controls";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { getB2BT, b2bMetadata } from "@/components/b2b/i18n";
import { createList, deleteList, addItem, removeItem } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { ReorderButton } from "@/components/b2b/reorder-button";
import { ActionBanner } from "@/components/b2b/action-banner";
import { ListChecks, Plus, Trash2, X } from "lucide-react";

export async function generateMetadata() {
  return b2bMetadata("lists.title");
}

export default async function RequisitionListsPage({
  searchParams,
}: {
  // addItem is bound to a plain form and so has no return channel; it reports
  // its outcome through the query string exactly as the governed purchase-order
  // actions do — as a CODE plus the one value it names, never as a finished
  // sentence, so the outcome is stated in the reader's language and an arbitrary
  // query string cannot paint prose inside the product's own receipt. Round one
  // wrote both parameters and then never read them, so a buyer who added a
  // withdrawn SKU — the one case the action refuses — was told nothing at all
  // and saw a list that silently had not changed.
  searchParams?: { listDone?: string; listError?: string; listArg?: string };
}) {
  const t = await getB2BT();
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title={t("lists.title")}>
        <EmptyState
          variant="certificate"
          glyph={<ListChecks />}
          eyebrow={t("common.noCompany.eyebrow")}
          headline={t("common.noCompany.headline")}
          body={t("common.noCompany.body")}
          action={
            <Button asChild variant="primary">
              <Link href="/b2b/register">{t("common.noCompany.action")}</Link>
            </Button>
          }
        />
      </B2BShell>
    );
  }

  const lists = await db.requisitionList.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: { select: { sellerId: true } } }, orderBy: { createdAt: "asc" } } },
  });

  return (
    <B2BShell
      workspace={ctx.company.nameEn}
      eyebrow={t("lists.eyebrow")}
      title={t("lists.title")}
      description={t("lists.description")}
    >
      <div className="space-y-block">
        {/* `basis` is passed, and it has to be: the banner's default cites the
            purchase-order register and the company's approval trail, and a
            requisition line is written to neither. */}
        <ActionBanner
          done={searchParams?.listDone}
          error={searchParams?.listError}
          arg={searchParams?.listArg}
          basis="lists.banner.basis"
        />

        {/* Create list */}
        <ValidatedForm action={createList} rung={1} className="p-5">
          <Eyebrow className="mb-4 flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("lists.new")}
          </Eyebrow>
          <div className="max-w-md">
            <Field label={t("lists.field.name")} htmlFor="list-name" required>
              <TextField id="list-name" name="name" required placeholder={t("lists.field.name.placeholder")} />
            </Field>
            <Button type="submit" variant="primary">{t("lists.create")}</Button>
          </div>
        </ValidatedForm>

        {lists.length === 0 ? (
          // The one certificate on this page.
          <EmptyState
            variant="certificate"
            glyph={<ListChecks />}
            eyebrow={t("lists.empty.eyebrow")}
            headline={t("lists.empty.headline")}
            body={t("lists.empty.body")}
            action={
              <Button asChild variant="secondary">
                <Link href="/products?b2b=true">{t("lists.empty.action")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {lists.map((l) => {
              const reorderItems = l.items.filter((it) => it.productId != null).map((it) => ({
                productId: it.productId!,
                sku: it.sku,
                nameEn: it.nameEn,
                qty: it.qty,
              }));
              return (
                <Surface key={l.id} rung={2} className="flex flex-col p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-neutral-soft text-ink-2">
                        <ListChecks className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="u-h3 truncate text-ink-1">{l.name}</h2>
                        <p className="u-meta text-ink-3">
                          {t(l.items.length === 1 ? "lists.items.one" : "lists.items.other", { count: l.items.length })}
                        </p>
                      </div>
                    </div>
                    <form action={deleteList.bind(null, l.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={t("lists.delete", { name: l.name })}
                        className="hover:text-danger-ink"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </form>
                  </div>

                  {/* Items */}
                  {l.items.length === 0 ? (
                    <p className="u-meta mb-3 text-ink-2">{t("lists.emptyList")}</p>
                  ) : (
                    <ul className="mb-3 border-y border-hairline">
                      {l.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-center justify-between gap-2 border-b border-hairline py-2 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="u-ui truncate font-medium text-ink-1">{it.nameEn}</p>
                            <p className="u-mono u-meta text-ink-3">
                              {it.sku} · ×{it.qty}
                            </p>
                          </div>
                          <form action={removeItem.bind(null, it.id)}>
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              aria-label={t("lists.removeItem", { item: it.nameEn, list: l.name })}
                              className="hover:text-danger-ink"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Add item */}
                  <form action={addItem.bind(null, l.id)} className="grid grid-cols-[1fr_80px_auto] items-start gap-2">
                    <Field label={t("lists.addBySku")} htmlFor={`list-${l.id}-sku`} hideLabel>
                      <TextField id={`list-${l.id}-sku`} name="sku" required placeholder={t("lists.addBySku")} size="sm" />
                    </Field>
                    <Field label={t("lists.quantity")} htmlFor={`list-${l.id}-qty`} hideLabel>
                      <TextField id={`list-${l.id}-qty`} name="qty" type="number" min={1} defaultValue={1} size="sm" />
                    </Field>
                    <Button type="submit" variant="secondary" size="sm" aria-label={t("lists.addToList", { name: l.name })}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </form>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                    <Dateline>{t("lists.basis")}</Dateline>
                    <ReorderButton items={reorderItems} />
                  </div>
                </Surface>
              );
            })}
          </div>
        )}
      </div>
    </B2BShell>
  );
}
