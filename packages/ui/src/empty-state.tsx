import * as React from "react";
import { FileText } from "lucide-react";
import { cn } from "@avenick/utils";
import { Eyebrow } from "./eyebrow";

/**
 * EmptyState — an editorial blank, not an error screen. And in its `certificate`
 * variant, THE DESIGNED OBJECT.
 *
 * This is the surface the owner is actually looking at, and it is the one this
 * product can never fill with fiction. So it has to be composed rather than
 * apologised for. The default variant keeps round one's centred editorial blank,
 * because 117 call sites across three portals depend on its box. The
 * `certificate` variant is the new one:
 *
 *   A large, deliberately composed, LEFT-ALIGNED plate. A brass hairline drawn
 *   across its top edge — the same .u-drawn rule as active nav, so an empty
 *   surface still belongs to the page. A cropped lucide glyph at 44% width
 *   bleeding off the OUTER corner at 5% ink. Faint ledger ruling behind. An
 *   eyebrow naming exactly what is empty, one sentence in the provenance voice,
 *   one sentence of plain explanation, and exactly one real action.
 *
 * Cropping the glyph is what makes it read as composition rather than as a sad
 * centred icon, and `inset-inline-end` is what makes it crop from the correct
 * corner in Arabic without a second rule.
 *
 * NO illustration of a person. No "Oops!". No invented count, ETA or "popular
 * searches". Say precisely WHAT is empty: "No orders yet" is a fact, "Nothing to
 * see here" is filler, and filler is what the hardening programme removed.
 *
 * THE MARKETPLACE MOVE, and it is fully true: when a category is empty, the one
 * action is the RFQ route. "No supplier lists this yet — request a quote" turns
 * the emptiest surface in the product into its most differentiated one.
 *
 * Every list, table, grid and queue in all three portals passes one of these.
 * Server Component: it lost its "use client" directive, which it never needed.
 */
export interface EmptyStateProps {
  /** Names the state in micro-caps, e.g. "NOTHING RECORDED". */
  eyebrow?: string;
  /** The precise sentence. Preferred over `title`. */
  headline?: string;
  /** Explanation. Preferred over `description`. */
  body?: string;
  /** @deprecated Use `headline`. Kept so existing call sites keep working. */
  title?: string;
  /** @deprecated Use `body`. Kept so existing call sites keep working. */
  description?: string;
  /** A single action. One button, never a row of them. Required on `certificate`. */
  action?: React.ReactNode;
  /** Small inline mark for the default variant, rendered at text scale. */
  icon?: React.ReactNode;
  /**
   * `certificate` is the composed plate. `default` is round one's centred blank,
   * kept as the default so no existing call site changes shape.
   */
  variant?: "default" | "certificate";
  /** `hero` is the taller plate used by the hero specimen slot. */
  scale?: "default" | "hero";
  /**
   * The cropped background mark, a lucide icon element. Drawn from the system's
   * own geometry at 5% ink, never a stock illustration. Defaults to FileText.
   */
  glyph?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  eyebrow,
  headline,
  body,
  title,
  description,
  action,
  icon,
  variant = "default",
  scale = "default",
  glyph,
  className,
}: EmptyStateProps) {
  const lead = headline ?? title ?? "";
  const explain = body ?? description;

  if (variant === "certificate") {
    // The content contract is enforced by the throw rather than by review,
    // because the failure it prevents — a beautifully composed plate with a
    // dead end in it — looks fine in a screenshot.
    if (process.env.NODE_ENV !== "production" && !action) {
      throw new Error(
        '<EmptyState variant="certificate"> requires an `action`. The certificate is the surface a user has landed on with nothing to do; giving them exactly one real thing to do next is the entire point of composing it.',
      );
    }

    return (
      <div
        className={cn("u-empty", className)}
        data-scale={scale === "hero" ? "hero" : undefined}
        data-rule-ground=""
        data-grain=""
      >
        <div className="u-empty__glyph" aria-hidden="true">
          {glyph ?? <FileText />}
        </div>

        {/* The same brass rule as active nav, a selected tab and the ladder's
            active band. One gesture in different postures. */}
        <div className="u-drawn w-16" data-on="true" aria-hidden="true" />

        {eyebrow && <Eyebrow className="flex items-center gap-1.5">{icon}{eyebrow}</Eyebrow>}

        {/* The provenance voice at h2 size: this sentence is a statement of fact
            about the data, which is exactly what the serif is reserved for. In
            Arabic it now sets in Noto Naskh rather than falling back silently. */}
        <p className="u-provenance max-w-desc text-h2 text-ink-1">{lead}</p>

        {explain && <p className="u-body max-w-desc text-ink-2">{explain}</p>}

        {action && <div className="flex">{action}</div>}
      </div>
    );
  }

  return (
    <div className={cn("px-6 py-14 text-center", className)}>
      {/* A 2px rule rather than an icon tile: it is the same underrule the section
          heads and table heads use, so an empty surface still belongs to the page. */}
      <div className="mx-auto mb-5 h-0.5 w-10 bg-border-strong" aria-hidden="true" />

      <Eyebrow className="mb-2 flex items-center justify-center gap-1.5">
        {icon}
        {eyebrow ?? "Nothing recorded"}
      </Eyebrow>

      {/* The provenance voice, at h2 size. This sentence is a statement of fact
          about the data, which is exactly what the serif is reserved for. */}
      <p className="u-provenance mx-auto max-w-desc text-h2 text-ink-1">{lead}</p>

      {explain && <p className="u-ui mx-auto mt-2 max-w-desc text-ink-2">{explain}</p>}

      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
