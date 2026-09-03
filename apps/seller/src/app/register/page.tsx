import type { Metadata } from "next";
import Link from "next/link";
import { platformName, portalUrl } from "@avenick/utils/portal-config";
import { getTranslations } from "next-intl/server";
import { Dateline, Divider, Eyebrow, Surface } from "@avenick/ui";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sellerRelations");
  return { title: t("register.metaTitle") };
}

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
export default async function RegisterPage() {
  const t = await getTranslations("sellerRelations");
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
        {/* platformName() stays dynamic inside the translated string; the brand
            is never a literal in either language. */}
        <Eyebrow className="mt-4">{t("register.brandEyebrow", { brand })}</Eyebrow>
        <h1 className="u-h1 mt-1 text-ink-1">{t("register.title", { brand })}</h1>
        <p className="u-body mt-1.5 max-w-desc text-ink-2">{t("register.intro")}</p>
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
          {t("register.haveAccount")}{" "}
          <Link href="/login" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            {t("register.signIn")}
          </Link>
        </span>
      </div>

      <Dateline className="mt-3">{t("register.provenance")}</Dateline>
    </div>
  );
}
