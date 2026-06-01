"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkPlus, X, Check, Loader2 } from "lucide-react";
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

  function remove(id: string, label: string) {
    startTransition(async () => {
      await deleteSavedView(id);
      toast({ title: "View removed", description: label, variant: "info" });
      router.refresh();
    });
  }

  if (views.length === 0 && !hasFilter && !naming) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground pe-1"><Bookmark className="h-3.5 w-3.5" /> Saved:</span>

      {views.map((v) => {
        const active = v.query === currentQuery;
        return (
          <span
            key={v.id}
            className={`group inline-flex items-center gap-1 rounded-xl text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground shadow-glow-sm" : "bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
          >
            <button type="button" onClick={() => apply(v.query)} className="ps-3 pe-1 py-1.5">{v.name}</button>
            <button
              type="button"
              onClick={() => remove(v.id, v.name)}
              disabled={pending}
              aria-label={`Delete view ${v.name}`}
              className={`pe-2 ps-0.5 py-1.5 rounded-e-xl ${active ? "hover:text-white/80" : "opacity-0 group-hover:opacity-100 hover:text-danger"} transition-opacity`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      {naming ? (
        <span className="inline-flex items-center gap-1 rounded-xl border border-primary/40 bg-card ps-2 pe-1 py-0.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setNaming(false); setName(""); } }}
            placeholder="View name"
            maxLength={40}
            className="w-28 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground"
          />
          <button type="button" onClick={save} disabled={pending || !name.trim()} aria-label="Save view" className="p-1 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => { setNaming(false); setName(""); }} aria-label="Cancel" className="p-1 rounded-lg text-muted-foreground hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>
        </span>
      ) : (
        hasFilter && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <BookmarkPlus className="h-3.5 w-3.5" /> Save current view
          </button>
        )
      )}
    </div>
  );
}
