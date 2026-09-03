import { B2BShell } from "@/components/b2b/b2b-shell";
import { Button, Dateline, EmptyState, Eyebrow, Field, Surface } from "@avenick/ui";
import { TextField } from "@/components/b2b/controls";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { createList, deleteList, addItem, removeItem } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { ReorderButton } from "@/components/b2b/reorder-button";
import { ListChecks, Plus, Trash2, X } from "lucide-react";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = { title: `Requisition Lists — ${platformName()} for Business` };

export default async function RequisitionListsPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Requisition Lists">
        <Surface rung={2}>
          <EmptyState
            eyebrow="No company context"
            headline="This session is not attached to a company account."
            body="Requisition lists are saved against a company. Sign in with a company account to manage them."
          />
        </Surface>
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
      eyebrow="Working"
      title="Requisition Lists"
      description="Save recurring baskets and reorder them without searching the catalogue again."
    >
      <div className="space-y-block">
        {/* Create list */}
        <ValidatedForm action={createList} rung={1} className="p-5">
          <Eyebrow className="mb-4 flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New list
          </Eyebrow>
          <div className="max-w-md">
            <Field label="List name" htmlFor="list-name" required>
              <TextField id="list-name" name="name" required placeholder="e.g. Monthly PPE restock" />
            </Field>
            <Button type="submit" variant="primary">Create list</Button>
          </div>
        </ValidatedForm>

        {lists.length === 0 ? (
          <Surface rung={2}>
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No requisition list has been saved yet."
              body="A list holds the SKUs and quantities you buy on a cycle. Reordering one reprices every line from the current catalogue rather than repeating an old price."
            />
          </Surface>
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
                          {l.items.length} item{l.items.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <form action={deleteList.bind(null, l.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete the list ${l.name}`}
                        className="hover:text-danger-ink"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </form>
                  </div>

                  {/* Items */}
                  {l.items.length === 0 ? (
                    <p className="u-meta mb-3 text-ink-2">This list is empty — add a product by its SKU below.</p>
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
                              aria-label={`Remove ${it.nameEn} from ${l.name}`}
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
                    <Field label="Add by SKU" htmlFor={`list-${l.id}-sku`} hideLabel>
                      <TextField id={`list-${l.id}-sku`} name="sku" required placeholder="Add by SKU" size="sm" />
                    </Field>
                    <Field label="Quantity" htmlFor={`list-${l.id}-qty`} hideLabel>
                      <TextField id={`list-${l.id}-qty`} name="qty" type="number" min={1} defaultValue={1} size="sm" />
                    </Field>
                    <Button type="submit" variant="secondary" size="sm" aria-label={`Add this SKU to ${l.name}`}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </form>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                    <Dateline>Repriced from the current catalogue when reordered</Dateline>
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
