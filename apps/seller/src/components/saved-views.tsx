"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkPlus, X, Check, Loader2 } from "lucide-react";
import { cn } from "@avenick/utils";
import { Eyebrow } from "@avenick/ui";
import { useToast } from "@/components/toast";
import { createSavedView, deleteSavedView } from "@/app/saved-views/actions";

export type SavedViewItem = { id: string; name: string; query: string };

export function SavedViews({
  entity,
  basePath,
  views,
}: {
  entity: "orders" | "products";
  basePath: string;
  views: SavedViewItem[];
}) {
  const router = useRouter();
  const search = useSearchParams();
  const { toast } = useToast();
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const currentQuery = search.toString();
  const hasFilter = currentQuery.length > 0;

  function apply(query: string) {
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  function save() {
    const clean = name.trim();
    if (!clean) return;
    startTransition(async () => {
      try {
        await createSavedView(entity, clean, currentQuery);
        toast({ title: "View saved", description: clean, variant: "success" });
        setName("");
        setNaming(false);
        router.refresh();
      } catch (e) {
        toast({ title: "Couldn't save view", description: (e as Error).message, variant: "error" });
      }
    });
  }

  // Symmetrical with save(): the server action can reject (the view belongs to
  // someone else, the row is already gone), and an unhandled rejection inside a
  // transition told the seller nothing at all — the chip simply stayed where it
  // was with no explanation.
  function remove(id: string, label: string) {
    startTransition(async () => {
      try {
        await deleteSavedView(id);
        toast({ title: "View removed", description: label, variant: "info" });
        router.refresh();
      } catch (e) {
        toast({ title: "Couldn't remove view", description: (e as Error).message, variant: "error" });
      }
    });
  }

  if (views.length === 0 && !hasFilter && !naming) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Eyebrow className="inline-flex items-center gap-1 pe-1">
        <Bookmark className="h-3.5 w-3.5" aria-hidden="true" /> Saved
      </Eyebrow>

      {views.map((v) => {
        const active = v.query === currentQuery;
        return (
          <span
            key={v.id}
            className={cn(
              "group inline-flex items-center gap-1 rounded-pill text-meta font-medium ring-1",
              "transition-colors duration-hover ease-standard",
              // The selected view is marked with the soft/ink pair, not a solid
              // indigo fill: the seller portal gets ONE primary fill per view and
              // it belongs to that page's commit action, not to a filter chip.
              active
                ? "bg-primary-soft text-primary-ink ring-primary/25"
                : "bg-surface-2 text-ink-2 ring-border hover:text-ink-1",
            )}
          >
            <button
              type="button"
              onClick={() => apply(v.query)}
              aria-current={active ? "true" : undefined}
              className="u-focus rounded-pill py-1.5 pe-1 ps-3"
            >
              {v.name}
            </button>
            <button
              type="button"
              onClick={() => remove(v.id, v.name)}
              disabled={pending}
              aria-label={`Delete view ${v.name}`}
              className={cn(
                "u-focus rounded-pill py-1.5 pe-2 ps-0.5 transition-opacity duration-hover ease-standard",
                // Dimmed rather than hidden. :hover reveals nothing on a touch
                // screen, so `opacity-0 group-hover:opacity-100` left this control
                // permanently invisible AND untappable on a phone — and a keyboard
                // user tabbed onto a button they could not see. It is always drawn,
                // quietly, and comes up to full on hover or focus.
                "opacity-50 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100",
                // Danger ink in both states: this deletes the view whether or not
                // the view happens to be the one currently applied. text-primary is
                // the FILL hue and this system keeps a separate ink hue for text.
                "hover:text-danger-ink",
              )}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        );
      })}

      {naming ? (
        // Recessed while it is being typed into — an input is the canonical
        // "context or input" surface, which is what rung 1 means.
        <span className="inline-flex items-center gap-1 rounded-pill bg-surface-1 py-0.5 pe-1 ps-2 ring-1 ring-border">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setNaming(false); setName(""); } }}
            placeholder="View name"
            aria-label="Name for this saved view"
            maxLength={40}
            className="w-28 bg-transparent text-meta text-ink-1 placeholder:text-ink-3 focus:outline-none"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending || !name.trim()}
            aria-label="Save view"
            className="u-focus rounded-pill p-1 text-primary-ink transition-colors duration-press ease-standard hover:bg-primary-soft disabled:opacity-40"
          >
            {/* A spinner is a genuine loading indicator — the one thing in this
                product allowed to animate on its own. */}
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => { setNaming(false); setName(""); }}
            aria-label="Cancel"
            className="u-focus rounded-pill p-1 text-ink-3 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
      ) : (
        hasFilter && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="u-focus inline-flex items-center gap-1 rounded-pill border border-dashed border-border px-2.5 py-1.5 text-meta font-medium text-ink-3 transition-colors duration-hover ease-standard hover:border-border-strong hover:text-ink-1"
          >
            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" /> Save current view
          </button>
        )
      )}
    </div>
  );
}
