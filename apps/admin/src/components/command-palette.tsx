"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@avenick/utils";

export interface PaletteItem {
  href: string;
  label: string;
  icon?: LucideIcon;
}

export interface PaletteGroup {
  label: string;
  items: PaletteItem[];
}

interface Props {
  groups: PaletteGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Scored {
  group: string;
  item: PaletteItem;
  score: number;
}

/**
 * Rank a navigation entry against the query. Substring hits on the label win,
 * then hits on the group or path, then an in-order subsequence of the label
 * ("wst" → "Warehouse Stock"), penalised by how spread out the letters are.
 * Returns a negative score for no match.
 */
function score(query: string, group: string, item: PaletteItem): number {
  const label = item.label.toLowerCase();
  const path = item.href.toLowerCase();
  const groupName = group.toLowerCase();
  if (label.startsWith(query)) return 100;
  if (label.includes(query)) return 80;
  if (`${groupName} ${label}`.includes(query)) return 70;
  if (groupName.includes(query) || path.includes(query)) return 60;

  let cursor = 0;
  let gaps = 0;
  let previous = -1;
  for (const char of query) {
    const index = label.indexOf(char, cursor);
    if (index < 0) return -1;
    if (previous >= 0) gaps += index - previous - 1;
    previous = index;
    cursor = index + 1;
  }
  return Math.max(1, 40 - gaps);
}

function rank(groups: PaletteGroup[], rawQuery: string): Scored[] {
  const query = rawQuery.trim().toLowerCase();
  const out: Scored[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      const value = query ? score(query, group.label, item) : 0;
      if (value >= 0) out.push({ group: group.label, item, score: value });
    }
  }
  // Stable: equal scores keep the sidebar's own order.
  return query ? out.sort((a, b) => b.score - a.score) : out;
}

const FOCUSABLE = 'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard jump-to-page over the sidebar's routes. Deliberately not a data
 * search: it never queries anything, so it can never show a stale or
 * partial record and it needs no server round-trip.
 */
export function CommandPalette({ groups, open, onOpenChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);
  const listId = React.useId();

  const results = React.useMemo(() => rank(groups, query), [groups, query]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  // Global shortcut. Cmd on macOS, Ctrl elsewhere; both are accepted so a
  // keyboard on the "wrong" platform still works.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Focus management: remember what had focus, move it into the dialog, and
  // hand it back on close so keyboard users are not dropped at the top of
  // the page.
  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setActive(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      restoreRef.current?.focus?.();
      restoreRef.current = null;
    };
  }, [open]);

  React.useEffect(() => {
    setActive(0);
  }, [query]);

  React.useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function go(item: PaletteItem) {
    close();
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length) setActive((index) => (index + 1) % results.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length) setActive((index) => (index - 1 + results.length) % results.length);
      return;
    }
    if (event.key === "Enter") {
      const target = results[active];
      if (target) {
        event.preventDefault();
        go(target.item);
      }
      return;
    }
    if (event.key === "Tab") {
      // Trap focus inside the dialog.
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  if (!open) return null;

  let lastGroup: string | null = null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4">
      {/* The overlay is the element that actually receives a click outside the dialog. */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" onMouseDown={close} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a page"
        onKeyDown={onKeyDown}
        className="relative w-full max-w-lg rounded-2xl border border-border bg-popover text-popover-foreground shadow-elevated overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a page…"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <ul ref={listRef} id={listId} role="listbox" aria-label="Pages" className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground" role="presentation">
              No page matches “{query.trim()}”
            </li>
          )}
          {results.map((result, index) => {
            const heading = result.group !== lastGroup && !query.trim() ? result.group : null;
            lastGroup = result.group;
            const Icon = result.item.icon;
            return (
              <React.Fragment key={`${result.group}:${result.item.href}`}>
                {heading && (
                  <li role="presentation" className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    {heading}
                  </li>
                )}
                <li
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => go(result.item)}
                  className={cn(
                    "mx-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer",
                    index === active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary",
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span className="flex-1 truncate">{result.item.label}</span>
                  {query.trim() && <span className={cn("text-[11px] truncate", index === active ? "text-primary-foreground/80" : "text-muted-foreground")}>{result.group}</span>}
                  {index === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
