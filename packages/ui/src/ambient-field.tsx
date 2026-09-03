import * as React from "react";
import { cn } from "@avenick/utils";

/**
 * AmbientField — the one gradient permitted anywhere in the product.
 *
 * Mount it exactly once, in a root layout. It replaces the pair of 384px
 * blur-[120px] orbs on the storefront home and the blur-[100px] orb behind the
 * admin command band. Those read as a 2019 SaaS template because they have a
 * discernible edge; this one spans past the viewport on every side, tops out at
 * roughly 6% alpha in light, and carries a noise layer — a wide low-alpha
 * gradient without noise bands into visible rings on an 8-bit display.
 *
 * Intensity is a portal token: 1.0 customer, 0.30 seller, 0.15 admin.
 *
 * Zero JavaScript, zero paint cost on scroll (it is fixed and never animated).
 */
export function AmbientField({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("u-field", className)} />;
}
