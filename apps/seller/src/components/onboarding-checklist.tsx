import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("sellerShell.onboarding");
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
      key: "profile",
      label: t("steps.profile.label"),
      cta: t("steps.profile.cta"),
      done: missingProfile.length === 0,
      href: "/settings",
      // The counted rows, named. A step that says "done" without saying what it
      // read is the kind of claim this codebase spent a hardening programme
      // removing. The field names interpolated into steps.profile.missing come
      // from missingProfileFields() in ../app/onboarding/readiness, which still
      // returns them in English: they need to become keys at that source before
      // this line can be fully Arabic.
      detail:
        missingProfile.length === 0
          ? t("steps.profile.done")
          : t("steps.profile.missing", { fields: missingProfile.join(", ") }),
    },
    {
      key: "product",
      label: t("steps.product.label"),
      cta: t("steps.product.cta"),
      done: productCount > 0,
      href: "/products",
      detail: t("steps.product.detail", { count: productCount, n: String(productCount) }),
    },
    {
      key: "documents",
      label: t("steps.documents.label"),
      cta: t("steps.documents.cta"),
      done: docCount > 0,
      href: "/documents",
      detail: docCount > 0 ? t("steps.documents.filed", { count: docCount, n: String(docCount) }) : t("steps.documents.none"),
    },
    {
      key: "payout",
      label: t("steps.payout.label"),
      cta: t("steps.payout.cta"),
      done: payoutReady,
      href: "/settings",
      detail: payoutReady ? t("steps.payout.done") : t("steps.payout.missing"),
    },
    {
      key: "sale",
      label: t("steps.sale.label"),
      cta: t("steps.sale.cta"),
      done: orderCount > 0,
      href: "/orders",
      detail: orderCount > 0 ? t("steps.sale.received", { count: orderCount, n: String(orderCount) }) : t("steps.sale.none"),
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
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 className="u-h3 mt-0.5 text-ink-1">{t("title")}</h2>
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
          label={t("meterLabel", { done: String(done), total: String(steps.length) })}
        />
      </div>
      <Dateline className="mt-1.5">
        {t("dateline", { done: String(done), total: String(steps.length) })}
      </Dateline>

      <ul className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <li key={step.key}>
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
