import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * FacetRail — counted filter facets, built on <details>/<summary> so opening and
 * closing needs no client component at all.
 *
 * The chevron is drawn from two rotated borders. No icon, nothing to mirror, and
 * it rotates about its own centre, so it is direction-agnostic by construction.
 *
 * COUNTS MUST BE REAL. Omit the count entirely rather than approximate it: a
 * wrong facet count is a lie that any user can falsify by clicking it, which is
 * the worst kind. `count` is optional for exactly that reason — pass it when the
 * query returned it and leave it out when it did not.
 *
 * Server Component. Every string arrives already localised.
 */
export interface FacetOption {
  id: string;
  label: string;
  /** Real count, or undefined. Never an estimate. */
  count?: number;
  href?: string;
  selected?: boolean;
}

export interface FacetRailProps extends React.HTMLAttributes<HTMLDetailsElement> {
  label: string;
  options: FacetOption[];
  /** Open on first paint. Use for the one or two facets that matter most. */
  defaultOpen?: boolean;
  /** Renders each option. Supply this when the options need to be form inputs. */
  renderOption?: (option: FacetOption) => React.ReactNode;
}

export function FacetRail({
  label,
  options,
  defaultOpen = false,
  renderOption,
  className,
  ...props
}: FacetRailProps) {
  if (options.length === 0) return null;

  return (
    <details open={defaultOpen} className={cn("u-facet border-b border-hairline", className)} {...props}>
      <summary className="u-focus">
        <span className="u-ui font-medium text-ink-1">{label}</span>
        <span className="u-facet__chev" aria-hidden="true" />
      </summary>
      <ul className="pb-tight">
        {options.map((option) => (
          <li key={option.id}>
            {renderOption ? (
              renderOption(option)
            ) : (
              <a
                href={option.href ?? "#"}
                data-active={option.selected ? "true" : undefined}
                className="u-focus u-state-wash flex items-center justify-between gap-2 rounded-nested px-2 py-1 text-ui text-ink-2 data-[active=true]:text-ink-1"
              >
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <span className="fig u-meta text-ink-3">{option.count}</span>
                )}
              </a>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
