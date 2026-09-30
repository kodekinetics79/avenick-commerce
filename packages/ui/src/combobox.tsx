"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@avenick/utils";
import { Button } from "./button";

interface ComboboxOption {
  value: string;
  label: string;
  labelAr?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  locale?: "ar" | "en";
  ariaLabelledBy?: string;
  searchLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results",
  locale = "en",
  ariaLabelledBy,
  searchLabel,
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();

  const filtered = React.useMemo(
    () =>
      options.filter((opt) => {
        const label = locale === "ar" && opt.labelAr ? opt.labelAr : opt.label;
        return label.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale));
      }),
    [locale, options, query],
  );

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected
    ? locale === "ar" && selected.labelAr
      ? selected.labelAr
      : selected.label
    : placeholder;

  const choose = (option: ComboboxOption) => {
    onValueChange?.(value === option.value ? "" : option.value);
    setOpen(false);
    setQuery("");
  };

  React.useEffect(() => {
    if (!open || !filtered[activeIndex]) return;
    document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered, listboxId, open]);

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          const selectedIndex = filtered.findIndex((option) => option.value === value);
          setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        }
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-labelledby={ariaLabelledBy}
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
        >
          <span className={cn(!selected && "text-muted-foreground")}>{displayLabel}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Content
        className="z-50 w-[var(--radix-popover-trigger-width)] rounded-panel border border-hairline bg-surface-2 p-0 shadow-elev-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <div className="flex items-center border-b border-border px-3">
          <Search className="me-2 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
          <input
            ref={searchRef}
            className="u-focus flex h-10 w-full bg-transparent py-3 text-sm text-ink-1 outline-none placeholder:text-ink-3"
            placeholder={searchPlaceholder}
            aria-label={searchLabel ?? searchPlaceholder}
            aria-controls={listboxId}
            aria-activedescendant={filtered[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && filtered[activeIndex]) {
                event.preventDefault();
                choose(filtered[activeIndex]);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
          />
        </div>
        <div id={listboxId} role="listbox" className="max-h-48 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            filtered.map((opt) => {
              const label = locale === "ar" && opt.labelAr ? opt.labelAr : opt.label;
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  id={`${listboxId}-${filtered.indexOf(opt)}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "u-focus flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-nested px-3 py-2 text-sm text-ink-1",
                    "hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent text-accent-foreground",
                    filtered[activeIndex]?.value === opt.value && "outline outline-2 -outline-offset-2 outline-ring",
                  )}
                  onMouseMove={() => setActiveIndex(filtered.indexOf(opt))}
                  onClick={() => choose(opt)}
                >
                  <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  {label}
                </button>
              );
            })
          )}
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}
