import type { Metadata } from "next";
import Link from "next/link";
import { platformName, portalUrl } from "@avenick/utils/portal-config";
import { Dateline, Divider, Eyebrow, Surface } from "@avenick/ui";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Apply to sell" };

/**
 * Public entry point for a new seller. Listed in the seller portal's public
 * paths, so the middleware lets an anonymous visitor through; the customer
 * site's "Become a seller" calls to action land here.
 *
 * The terms live on the customer site. Their URL is resolved here, on the
 * server, and handed to the form so the client bundle never reads portal env
 * itself; when the origin is unknown the form shows the checkbox without a
 * link rather than guessing a host.
 *
 * The chrome is the same door as /login and for the same reasons: no forced
 * `dark` class overriding the reader's own theme, no opaque ground covering the
 * one ambient field, no `blur-[120px]` colour orbs, no gradient monogram, no
 * `font-extrabold` — a weight this system does not have. Ruled ground, a brass
 * rule, a recessed monogram, and type carrying the rank.
 */
export default function RegisterPage() {
  const brand = platformName();
  const termsUrl = portalUrl("customer", "/terms");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Surface
          rung={1}
          aria-hidden="true"
          className="grid h-11 w-11 place-items-center rounded-nested text-h3 font-medium text-ink-1"
        >
          {brand.charAt(0).toUpperCase()}
        </Surface>
        <Divider drawn on className="mt-5 w-12" />
        <Eyebrow className="mt-4">{brand} Seller Central</Eyebrow>
        <h1 className="u-h1 mt-1 text-ink-1">Apply to sell on {brand}</h1>
        <p className="u-body mt-1.5 max-w-desc text-ink-2">
          Tell us about your business and who runs it. Applications are reviewed by the platform team before a store
          can trade.
        </p>
      </div>

      {/* The one raised object on the page. The ruling goes on an INNER element:
          the shoulder and the ruling are both painted by a ::before, and an
          element has only one, so combining `rim` and [data-rule-ground] on the
          same node silently drops the four-part light's shoulder. */}
      <Surface rung={3} rim className="overflow-hidden">
        <div data-rule-ground="" className="p-5 sm:p-6 [&>*]:relative">
          <RegisterForm termsUrl={termsUrl} />
        </div>
      </Surface>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <span className="u-meta text-ink-2">
          Already have a seller account?{" "}
          <Link href="/login" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            Sign in
          </Link>
        </span>
      </div>

      <Dateline className="mt-3">
        An application is a record on this platform from the moment it is submitted. Nothing about your business is
        published until the review is complete and a store is opened.
      </Dateline>
    </div>
  );
}
