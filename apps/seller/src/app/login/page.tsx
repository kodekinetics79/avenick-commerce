"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithCredentials } from "@avenick/auth/client";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { BrandMark, Button, Dateline, Divider, Eyebrow, Input, Surface } from "@avenick/ui";
import { platformName, portalUrl } from "@avenick/utils/portal-config";

/**
 * Password reset lives on the customer site (the only portal with a mailer).
 * The link is rendered only when that portal's origin is configured for this
 * environment; a guessed host would send a seller to a page that is not there.
 */
const FORGOT_PASSWORD_URL = portalUrl("customer", "/auth/forgot-password");

/**
 * THE DOOR. It is the first surface a supplier ever sees, and it was the last
 * one still written in round zero.
 *
 * What was here: a wrapper that forced `class="dark"` on itself (so the theme
 * this portal lets a user choose was overridden on exactly the page where they
 * choose nothing), an opaque `bg-background` that covered the ambient field the
 * root layout mounts, a `bg-grid` cross-hatch, two 384px `blur-[120px]` colour
 * orbs — the visible-orb failure the single ruled field exists to avoid — an
 * indigo→violet gradient monogram, `font-extrabold` and `font-black` (weights
 * that do not exist in this system), `shadow-glow`, `.glass-strong`, and a
 * strapline making a claim about the product.
 *
 * What replaced it is the register's own vocabulary: the page ground and the one
 * ambient field showing through, a recessed monogram plate, a brass hairline,
 * ruled ground behind the card, and type carrying the rank instead of colour.
 * Nothing here claims anything.
 */
export default function SellerLoginPage() {
  const t = useTranslations("sellerShell.login");
  const searchParams = useSearchParams();
  const urlError = searchParams.get("code") ?? searchParams.get("error");
  const justRegistered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const authMessage = (code: string | null | undefined) =>
    !code ? "" : code === "rate_limited" ? t("rateLimited") : t("invalidCredentials");
  const [error, setError] = useState(authMessage(urlError));
  const brand = platformName();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signInWithCredentials(email, password, "/");
      if (!res.ok) {
        setError(authMessage(res.code ?? res.error));
        setLoading(false);
      } else {
        window.location.assign("/");
      }
    } catch {
      setError(t("unexpectedError"));
      setLoading(false);
    }
  }

  return (
    // No background: <body> paints --surface-0 and the ambient field sits behind
    // it at z-index -1. An opaque wrapper here would cover both, which is how a
    // tinted ground silently becomes flat white again.
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          {/* The mark, at the size the plate used to be. It draws its own
              light, so it no longer needs a Surface to sit on. */}
          <BrandMark name={brand} size={44} />
          {/* The brass rule, drawn from the inline start. Same gesture as the
              active nav entry, the certificate's top edge and the ladder's active
              band — one rule in different postures. */}
          <Divider drawn on className="mt-5 w-12" />
          <Eyebrow className="mt-4">{t("portalName", { brand })}</Eyebrow>
          <h1 className="u-h1 mt-1 text-ink-1">{t("title")}</h1>
          <p className="u-body mt-1.5 max-w-desc text-ink-2">{t("description")}</p>
        </div>

        {/* Rung 3 — this is the one raised, actionable object on the page, and
            the portal's budget is one rung-3 surface per viewport. Ruled ground
            behind it, which is the register's own texture rather than a grid.

            The ruling sits on an INNER element, never on the plate itself. Both
            the shoulder and the ruling are painted by a ::before, and an element
            has only one: [data-rule-ground]::before is declared after
            [data-rim]::before, so putting both on one node silently replaces the
            shoulder's conic gradient with the ruling — the four-part light stops
            shipping on precisely the surfaces composed most carefully, and
            nothing in the markup shows it. Rim on the plate, ruling inside it. */}
        <Surface rung={3} rim className="overflow-hidden">
          <div data-rule-ground="" className="p-5 sm:p-6 [&>*]:relative">
            {/* The register route answers the same way for a new and an already
                registered address, so this sentence has to be true for both. */}
            {justRegistered && (
              <Surface rung={1} tone="success" role="status" className="mb-4 p-3">
                <Eyebrow className="mb-0.5">{t("registered.title")}</Eyebrow>
                <p className="u-meta text-ink-1">{t("registered.body")}</p>
              </Surface>
            )}

            <form
              onSubmit={handleLogin}
              className="space-y-3.5"
              aria-label={t("formLabel")}
              noValidate
            >
              {/* Placeholders are not accessible names: they vanish on input and
                  are not exposed as labels by every assistive technology. */}
              <label htmlFor="login-email" className="sr-only">
                {t("email")}
              </label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder={t("email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="login-password" className="sr-only">
                {t("password")}
              </label>
              <Input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                endIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                    aria-pressed={showPassword}
                    className="u-focus grid h-7 w-7 place-items-center rounded-nested text-ink-3 hover:bg-ink-1/[0.06] hover:text-ink-1"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                }
              />
              {error && (
                <p className="u-meta text-danger-ink" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" loading={loading}>
                {t("submit")}
              </Button>
            </form>

            <Divider className="my-4" />

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="u-meta text-ink-2">
                {t("newHere")}{" "}
                <Link
                  href="/register"
                  className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
                >
                  {t("apply")}
                </Link>
              </span>
              {FORGOT_PASSWORD_URL && (
                <a
                  href={FORGOT_PASSWORD_URL}
                  className="u-focus u-meta rounded-nested font-medium text-primary-ink hover:underline"
                >
                  {t("forgotPassword")}
                </a>
              )}
            </div>
          </div>
        </Surface>

        {/* The old strapline — "B2B-first. B2C-ready. Built for modern trade." —
            was marketing on a sign-in box. This states something a supplier can
            act on instead. */}
        <Dateline className="mt-5">{t("reviewDateline")}</Dateline>
      </div>
    </div>
  );
}
