"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@avenick/utils";
import { EmptyState, Eyebrow, FieldWell, StatusPill, Surface } from "@avenick/ui";

/** Mirrors the availability states in ops/release/frontend-availability.json. */
export type PaletteAvailability = "simulated" | "unavailable" | "read_only";

export interface PaletteItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Absent for an operational screen. */
  availability?: PaletteAvailability;
  /** The registry's own sentence, shown on the highlighted row. */
  availabilityNote?: string;
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

const AVAILABILITY_LABEL: Record<PaletteAvailability, string> = {
  simulated: "Example data",
  unavailable: "Not configured",
  read_only: "Read only",
};

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
 *
 * Each row carries the screen's availability contract, because knowing that
 * /quotes is a static example before you navigate to it is the difference
 * between a console and a demo. The state comes from the same registry CI
 * validates every href against.
 */
export function CommandPalette({ groups, open, onOpenChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const dialogRef = React.useRef<HTMLElement>(null);
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

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
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
  const activeItem = results[active]?.item;

  return (
    <div className="fixed inset-0 z-layer flex items-start justify-center px-4 pt-[12vh]">
      {/* The overlay is the element that actually receives a click outside the dialog. */}
      {/* No data-state: the scrim is drawn, not faded in. §8 of the design
          system ranks motion by FREQUENCY, not by surface, and a jump-to-page
          palette is the single most-used control in this console. The instinct
          of every implementer is to animate it because it is the most fun thing
          on the page to animate; it is also the most wrong. Raycast has no
          open/close animation at all, deliberately. */}
      <div className="u-layer-scrim" aria-hidden="true" onMouseDown={close} />
      <Surface
        ref={dialogRef}
        rung={5}
        glass
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a page"
        onKeyDown={onKeyDown}
        // z-[51] matches what .u-layer-panel carries in the system stylesheet,
        // and it is load-bearing rather than cosmetic: .u-layer-scrim is
        // z-index 50, so a panel left at z-index auto paints UNDERNEATH its own
        // scrim — dimmed, blurred, and with every click on a result swallowed by
        // the scrim's dismiss handler instead of navigating.
        // No animate-fade-up. See the scrim above: this panel is present on the
        // frame the operator pressed the key on, and 320ms of travel on a
        // control opened a hundred times a day is 32 seconds a day of waiting
        // for a fade.
        className="relative z-[51] w-full max-w-lg overflow-hidden"
      >
        {/* The query row is recessed: it is an input, and in this system that is
            what rung 1 means. */}
        <FieldWell className="flex h-12 items-center gap-2 rounded-none border-0 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            // A combobox needs a real accessible name. A placeholder is not one:
            // it disappears the moment a character is typed.
            aria-label="Jump to a page"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a page…"
            // u-focus, not a bare outline-none: this is the one text field in
            // the palette and it is inside the Tab cycle, so without a ring a
            // keyboard user shift-tabbing back into it has no indication of
            // where focus went. The ring's inner stop resolves to the well's own
            // surface, so it reads as the field lighting up rather than as a
            // floating outline.
            className="u-focus u-ui min-w-0 flex-1 rounded-nested bg-transparent text-ink-1 outline-none placeholder:text-ink-3"
          />
        </FieldWell>

        {/* The result count is announced without being drawn: a combobox that
            silently empties is the most common screen-reader failure here. */}
        <p className="sr-only" role="status" aria-live="polite">
          {results.length} {results.length === 1 ? "page matches" : "pages match"}
        </p>

        <ul ref={listRef} id={listId} role="listbox" aria-label="Pages" className="scrollbar-thin max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && (
            // The system's own empty state rather than a local imitation of it,
            // so the palette's blank reads as the same designed object as an
            // empty table. Padding is trimmed because this one sits inside a
            // 50vh scroller, not on a page.
            <li role="presentation">
              <EmptyState
                className="px-6 py-10"
                eyebrow="No match"
                headline={`No page is named “${query.trim()}”.`}
                body="This searches the console's own pages, not your data."
              />
            </li>
          )}
          {results.map((result, index) => {
            const heading = result.group !== lastGroup && !query.trim() ? result.group : null;
            lastGroup = result.group;
            const Icon = result.item.icon;
            const availability = result.item.availability;
            const isActive = index === active;
            return (
              <React.Fragment key={`${result.group}:${result.item.href}`}>
                {heading && (
                  <li role="presentation" className="px-4 pb-1 pt-3">
                    <Eyebrow>{heading}</Eyebrow>
                  </li>
                )}
                <li
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isActive}
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => go(result.item)}
                  className={cn(
                    "u-ui mx-1 flex cursor-pointer items-center gap-2.5 rounded-nested px-3 py-2 transition-colors duration-press ease-standard",
                    // A soft wash and a ring, never a primary fill: this console
                    // spends zero primary fills per view — colour here is state.
                    isActive ? "bg-primary-soft text-ink-1 ring-1 ring-primary/30" : "text-ink-2 hover:bg-ink-1/[0.04]",
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />}
                  <span className="flex-1 truncate">{result.item.label}</span>
                  {availability && (
                    <StatusPill tone={availability === "unavailable" ? "danger" : availability === "simulated" ? "warning" : "neutral"}>
                      {AVAILABILITY_LABEL[availability]}
                    </StatusPill>
                  )}
                  {query.trim() && <span className="u-meta shrink-0 truncate text-ink-3">{result.group}</span>}
                  {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>

        {/* The footer earns its line twice: it teaches the three keys the palette
            answers to, and it carries the highlighted screen's availability
            sentence — so the caveat arrives before the navigation, not after. */}
        <div className="flex items-center gap-3 border-t border-hairline px-4 py-2">
          <p className="u-meta min-w-0 flex-1 truncate text-ink-3">
            {activeItem?.availabilityNote ?? "Navigates the console. It does not search your data."}
          </p>
          <span className="u-meta hidden shrink-0 items-center gap-1 text-ink-3 sm:flex" aria-hidden="true">
            <kbd className="rounded-nested border border-border px-1">↑</kbd>
            <kbd className="rounded-nested border border-border px-1">↓</kbd>
            <kbd className="rounded-nested border border-border px-1.5">Enter</kbd>
            <kbd className="rounded-nested border border-border px-1.5">Esc</kbd>
          </span>
        </div>
      </Surface>
    </div>
  );
}
