"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithCredentials } from "@avenick/auth/client";
import { messageForSignInError as messageForError } from "@avenick/auth/sign-in-messages";
import { useSearchParams } from "next/navigation";
import { Button, Dateline, Divider, Eyebrow, Input, Surface } from "@avenick/ui";
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
  const searchParams = useSearchParams();
  const urlError = searchParams.get("code") ?? searchParams.get("error");
  const justRegistered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(messageForError(urlError));
  const brand = platformName();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signInWithCredentials(email, password, "/");
      if (!res.ok) {
        setError(messageForError(res.code ?? res.error));
        setLoading(false);
      } else {
        window.location.assign("/");
      }
    } catch {
      setError("Something went wrong. Please try again.");
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
          {/* A recessed plate with the initial in ink — not the indigo→violet
              gradient tile. The ambient field is the only gradient in the system,
              and a gradient monogram is the single most copied SaaS tell there
              is. */}
          <Surface
            rung={1}
            aria-hidden="true"
            className="grid h-11 w-11 place-items-center rounded-nested text-h3 font-medium text-ink-1"
          >
            {brand.charAt(0).toUpperCase()}
          </Surface>
          {/* The brass rule, drawn from the inline start. Same gesture as the
              active nav entry, the certificate's top edge and the ladder's active
              band — one rule in different postures. */}
          <Divider drawn on className="mt-5 w-12" />
          <Eyebrow className="mt-4">{brand} Seller Central</Eyebrow>
          <h1 className="u-h1 mt-1 text-ink-1">Sign in</h1>
          <p className="u-body mt-1.5 max-w-desc text-ink-2">
            The supplier back office for this account: your catalog, your orders, your documents and your settlements.
          </p>
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
                <Eyebrow className="mb-0.5">Application received</Eyebrow>
                <p className="u-meta text-ink-1">
                  Sign in with that email address to follow its review — if it was already registered, use your existing
                  password.
                </p>
              </Surface>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5" aria-label="Sign in">
              {/* Placeholders are not accessible names: they vanish on input and
                  are not exposed as labels by every assistive technology. */}
              <label htmlFor="login-email" className="sr-only">Email</label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="login-password" className="sr-only">Password</label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && (
                <p className="u-meta text-danger-ink" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" loading={loading}>
                Sign in
              </Button>
            </form>

            <Divider className="my-4" />

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="u-meta text-ink-2">
                New here?{" "}
                <Link href="/register" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
                  Apply to sell
                </Link>
              </span>
              {FORGOT_PASSWORD_URL && (
                <a
                  href={FORGOT_PASSWORD_URL}
                  className="u-focus u-meta rounded-nested font-medium text-primary-ink hover:underline"
                >
                  Forgot password?
                </a>
              )}
            </div>
          </div>
        </Surface>

        {/* The old strapline — "B2B-first. B2C-ready. Built for modern trade." —
            was marketing on a sign-in box. This states something a supplier can
            act on instead. */}
        <Dateline className="mt-5">
          Applications are reviewed by the platform team before a store can trade. Signing in with an application's
          email address shows where that review stands.
        </Dateline>
      </div>
    </div>
  );
}
