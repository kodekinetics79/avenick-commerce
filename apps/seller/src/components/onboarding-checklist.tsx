import Link from "next/link";
import { db } from "@avenick/database";
import { cn } from "@avenick/utils";
import { Button, Dateline, Eyebrow, Meter, Num, Surface } from "@avenick/ui";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { hasPayoutDetails, missingProfileFields, type ProfileFields } from "@/app/onboarding/readiness";

/**
 * Server component — computes real store-setup completion and renders a
 * guided checklist. Returns null once everything is done.
 *
 * Every step now states WHAT it read, because a checklist that only shows ticks
 * is asking to be trusted rather than earning it. Two of the ticks used to be
 * unearned: the business profile was hardcoded `done: true`, and any non-null
 * `bankDetails` counted as payout-ready even when it was an empty JSON object.
 * Both tests now come from ../app/onboarding/readiness, which is the same module
 * /onboarding reads, so the two surfaces can no longer disagree about whether
 * the same store is set up.
 */
export async function OnboardingChecklist({
  seller,
}: {
  seller: ProfileFields & { id: string; bankDetails: unknown };
}) {
  const [productCount, docCount, orderCount] = await Promise.all([
    // deletedAt: null, matching /onboarding's identical count. Without it a
    // seller whose only product had been deleted was told this step was done —
    // an unearned tick is a fabricated claim like any other, and the two pages
    // disagreeing about the same store is exactly what readiness.ts exists to
    // stop.
    db.product.count({ where: { sellerId: seller.id, deletedAt: null } }),
    db.sellerDocument.count({ where: { sellerId: seller.id } }),
    db.orderItem.count({ where: { sellerId: seller.id } }),
  ]);

  const missingProfile = missingProfileFields(seller);
  const payoutReady = hasPayoutDetails(seller.bankDetails);

  const steps = [
    {
      label: "Complete business profile",
      cta: "Complete profile",
      done: missingProfile.length === 0,
      href: "/settings",
      // The counted rows, named. A step that says "done" without saying what it
      // read is the kind of claim this codebase spent a hardening programme
      // removing.
      detail: missingProfile.length === 0 ? "Arabic name, description and logo on file." : `Still missing: ${missingProfile.join(", ")}.`,
    },
    {
      label: "Add your first product",
      cta: "Add a product",
      done: productCount > 0,
      href: "/products",
      detail: `${productCount} product${productCount === 1 ? "" : "s"} in your catalogue.`,
    },
    {
      label: "Upload compliance documents",
      cta: "Upload documents",
      done: docCount > 0,
      href: "/documents",
      detail: docCount > 0 ? `${docCount} document${docCount === 1 ? "" : "s"} filed. Each is reviewed before it counts as approved.` : "Nothing filed yet.",
    },
    {
      label: "Set up payout details",
      cta: "Add payout details",
      done: payoutReady,
      href: "/settings",
      detail: payoutReady ? "Bank details are recorded for settlement." : "No bank details recorded, so payouts cannot be settled.",
    },
    {
      label: "Make your first sale",
      cta: "Review your listings",
      done: orderCount > 0,
      href: "/orders",
      detail: orderCount > 0 ? `${orderCount} order line${orderCount === 1 ? "" : "s"} received.` : "No buyer has ordered from you yet.",
    },
  ];

  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  if (done === steps.length) return null;

  const next = steps.find((s) => !s.done);

  return (
    // Rung 1. Setup progress is context for the dashboard rather than an object
    // on it, and the one raised thing here is the action that moves it forward.
    <Surface rung={1} className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Store setup</Eyebrow>
          <h2 className="u-h3 mt-0.5 text-ink-1">Get your store live</h2>
        </div>
        {next && (
          <Button variant="primary" size="sm" asChild>
            <Link href={next.href}>
              {next.cta}
              {/* A direction-implying icon must flip in Arabic. */}
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Num value={pct} unit="%" />
        <Meter
          className="flex-1"
          value={done}
          max={steps.length}
          tone="accent"
          label={`Store setup: ${done} of ${steps.length} steps complete`}
        />
      </div>
      <Dateline className="mt-1.5">
        {done} of {steps.length} steps complete · each one read from your own rows
      </Dateline>

      <ul className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className="u-focus flex items-start gap-2 rounded-nested py-1.5 transition-colors duration-hover ease-standard hover:bg-ink-1/[0.03]"
            >
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
              )}
              <span className="min-w-0">
                {/* ink-2 for a finished step, not ink-3: ink-3 is the label and
                    metadata step and measures about 4.4:1 on this rung-1 ground,
                    which is under the 4.5:1 body-text floor. A done step is
                    de-emphasised by dropping one ink stop, never by going below
                    readable. */}
                <span className={cn("u-ui block font-medium", step.done ? "text-ink-2" : "text-ink-1")}>{step.label}</span>
                <span className="u-meta block text-ink-2">{step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
