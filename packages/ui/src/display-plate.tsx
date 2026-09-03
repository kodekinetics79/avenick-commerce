import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * DisplayPlate — the generated object.
 *
 * A composed, lit, ruled plate in the product's own hues, for a hero or feature
 * slot the catalogue owns no photograph for. It is abstract but PHYSICAL, and it
 * is honest because it claims nothing: no invented product, no stock imagery, no
 * illustration of a person.
 *
 * The conic origin is mirrored by --dir — `at calc(50% + (28% * var(--dir)))` —
 * which gives it a deliberately hand-placed asymmetry that is correct in both
 * directions. A fixed `at 22% 12%` would pass English review and put the light
 * source on the wrong shoulder in Arabic. That is the defect class this round
 * will otherwise produce, because SIJILL introduces masks and gradients where
 * round one had almost none.
 *
 * Customer portal only, one per route. It is decoration, so it is aria-hidden
 * unless it is given content.
 */
export interface DisplayPlateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds the tiled grain layer. Counts against the ≤3 grained elements budget. */
  grain?: boolean;
  /** Adds the ledger ruling. Same gesture, same line-height, as the field. */
  ruled?: boolean;
  /** Adds the fresnel shoulder ring. */
  rim?: boolean;
  /** Display glass over the plate. Customer only; <Surface> polices the rule. */
  children?: React.ReactNode;
}

export function DisplayPlate({
  grain = true,
  ruled = true,
  rim = true,
  className,
  children,
  ...props
}: DisplayPlateProps) {
  return (
    <div
      className={cn("u-plate", className)}
      data-grain={grain ? "" : undefined}
      data-rule-ground={ruled ? "" : undefined}
      data-rim={rim ? "" : undefined}
      aria-hidden={children ? undefined : "true"}
      {...props}
    >
      {children}
    </div>
  );
}
