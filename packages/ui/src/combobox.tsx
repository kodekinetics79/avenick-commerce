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
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = options.filter((opt) => {
    const label = locale === "ar" && opt.labelAr ? opt.labelAr : opt.label;
    return label.toLowerCase().includes(query.toLowerCase());
  });

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected
    ? locale === "ar" && selected.labelAr
      ? selected.labelAr
      : selected.label
    : placeholder;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
        >
          <span className={cn(!selected && "text-muted-foreground")}>{displayLabel}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Content className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border border-border rounded-xl shadow-lg z-50">
        <div className="flex items-center border-b border-border px-3">
          <Search className="me-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-48 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            filtered.map((opt) => {
              const label = locale === "ar" && opt.labelAr ? opt.labelAr : opt.label;
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm",
                    "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                    isSelected && "bg-accent",
                  )}
                  onClick={() => {
                    onValueChange?.(isSelected ? "" : opt.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
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
