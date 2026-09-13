"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Building2, ChevronRight, User } from "lucide-react";
import { Divider, Input, Button } from "@avenick/ui";
import { AuthShell, FormErrorSlot } from "../auth/auth-shell";
import { identityCopy, toIdentityLocale } from "../auth/identity-copy";
import { platformName } from "@avenick/utils/portal-config";
// Subpath import, not the "@avenick/auth" barrel: the barrel pulls the whole
// auth runtime into a client bundle. safe-redirect is a pure string function.
import { safeReturnTo } from "@avenick/auth/safe-redirect";

type Mode = "select" | "consumer";

/**
 * The account-type chooser's rows share one shape whether a row opens the form
 * below or leaves for another page.
 *
 * `last:border-b-0`: the group opens with a rule and each row closes with one,
 * and AuthShell's footer opens with a rule of its own 28px further down — so
 * the last row's rule drew a second hairline parallel to the footer's, the
 * doubled closing line the chooser showed under "Business account".
 */
const CHOOSER_ROW =
  "u-focus u-drawn-host u-state-wash relative flex w-full items-center gap-3 border-b border-hairline px-1 py-4 text-start last:border-b-0";

export default function RegisterPage() {
  const router = useRouter();
  // The provider in the root layout carries the same AVENICK_LOCALE value the
  // server pages read, so the client and server halves of this track can never
  // disagree about which language they are in.
  const locale = toIdentityLocale(useLocale());
  const t = identityCopy(locale).register;

  const [mode, setMode] = useState<Mode>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /*
   * The other way out of this page. A buyer sent here from checkout who turns
   * out to HAVE an account presses "Sign in" in the footer, and that link has to
   * carry the destination too, or the shorter of the two routes back to the
   * basket is the one that loses it.
   *
   * Initialised to the bare path and corrected after mount, so the server and
   * the first client render agree; reading the query string during render would
   * mismatch. The button below is a real link at every moment — never a dead one
   * waiting for an effect.
   */
  const [signInHref, setSignInHref] = useState("/login");
  useEffect(() => {
    const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get("callbackUrl"), "");
    if (returnTo) setSignInHref(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
  }, []);
  // `language` is sent because absence is not neutral: RegisterConsumerSchema
  // declares `.default("AR")`, so every account this page created used to be
  // recorded as preferring Arabic, whatever language its owner had been
  // reading. The honest value is the locale the applicant is actually in, which
  // is what /b2b/register sends as well.
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", language: locale === "ar" ? "AR" : "EN" });

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    // THE FAILED STATE IS A DESIGNED STATE. The fetch and the res.json() had no
    // catch, so a dropped connection or a non-JSON 502 rejected out of this
    // handler and setLoading(false) never ran: the applicant was left staring
    // at a spinner on a permanently disabled button with nothing to read and
    // nothing to press. Every other form on this track already catches.
    try {
      const res = await fetch("/api/auth/register/consumer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        /*
         * THE DESTINATION SURVIVES REGISTRATION.
         *
         * A buyer who filled a basket and pressed checkout is sent to
         * /login?callbackUrl=/checkout, follows "Register" (which now carries
         * that parameter), and lands back on /login to sign in. Dropping it
         * here put a newly registered buyer on /account/orders with a full
         * basket and no indication of how to return to it — the abandonment is
         * at the exact moment they had decided to buy.
         *
         * Read from the live query string rather than useSearchParams: this
         * page is one client component with no Suspense boundary, and reaching
         * for that hook here would either force a refactor or deopt the route.
         * The value is only needed at submit, when window is certain.
         *
         * Validated with the same helper the login island uses. A registration
         * form is a fine place to aim an open redirect from, precisely because
         * the visitor is about to authenticate for real.
         */
        const raw = new URLSearchParams(window.location.search).get("callbackUrl");
        const returnTo = safeReturnTo(raw, "");
        router.push(
          returnTo
            ? `/login?registered=1&callbackUrl=${encodeURIComponent(returnTo)}`
            : "/login?registered=1",
        );
      } else {
        setError(data.error ?? t.failed);
      }
    } catch {
      setError(t.failed);
    } finally {
      setLoading(false);
    }
  }

  /**
   * The two account types, as a hairline-divided pair of rows rather than two
   * 6rem tiles with icons that scaled 10% on hover. A chooser is a list of
   * choices; making each one a floating card gave them the same visual weight as
   * the page itself, and `transition-all` animated their layout on every frame.
   *
   * It is also no longer a nested <Surface rung={2}> inside the shell's own
   * rung-2 card — a box inside a box, which is the exact failure the two line
   * weights exist to prevent. It is a ruled list on the ground it already sits
   * on, and the brass rule that draws in on hover is the same .u-drawn gesture
   * as active nav.
   *
   * Each line says what the choice actually COSTS you — the business route needs
   * a commercial registration number — because that is the fact that decides it.
   *
   * THE BUSINESS ROW LEAVES THIS PAGE. It used to open a second company form
   * here that posted to the same /api/auth/register/business endpoint as
   * /b2b/register, and the two had drifted: person-first against company-first,
   * "Email" against "Work email", two wordings of the password rule, no
   * preferred language — and no "already registered by a colleague? join the
   * existing company" route, so a colleague whose commercial registration was
   * already on the platform met a refusal with nowhere to go. /b2b/register is
   * the maintained form and carries that route, so this row is a link to it,
   * and the endpoint this page posts to is the consumer one alone. No
   * callbackUrl is carried: /b2b/register does not read one, and a new company
   * is pending verification before any destination could open anyway.
   */
  const rowContent = (Icon: typeof User, title: string, body: string) => (
    <>
      <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="u-ui block font-medium text-ink-1">{title}</span>
        <span className="u-meta mt-0.5 block text-ink-2">{body}</span>
      </span>
      {/* A direction-implying icon has to flip in Arabic. */}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 rtl:rotate-180" aria-hidden="true" />
      {/* The brass rule, drawn from the inline start on HOVER. Same gesture,
          same 160ms, same origin token as everything else brass in the
          product — one gesture in a new posture, never a sixth gesture with its
          own timing.
          Keyboard focus is carried by the two-stop .u-focus ring, not by this
          rule: `.u-drawn-host` in globals.css matches :hover only. Teaching it
          :focus-visible is a one-line change in packages/ui and is filed as a
          cross-track request — do not hand-roll a second focus indicator here
          to work around it. */}
      <Divider drawn className="absolute inset-x-0 bottom-[-1px]" />
    </>
  );

  return (
    <AuthShell
      locale={locale}
      eyebrow={t.eyebrow}
      title={mode === "select" ? t.title : t.titleConsumer}
      subtitle={mode === "select" ? t.subtitle(platformName()) : undefined}
      footer={
        <p className="u-meta text-ink-3">
          {t.hasAccount}{" "}
          <Link href={signInHref} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            {t.signIn}
          </Link>
        </p>
      }
    >
      {mode === "select" && (
        <div role="group" aria-label={t.chooserLabel} className="border-t border-hairline">
          <button type="button" onClick={() => setMode("consumer")} className={CHOOSER_ROW}>
            {rowContent(User, t.consumerTitle, t.consumerBody)}
          </button>
          <Link href="/b2b/register" className={CHOOSER_ROW}>
            {rowContent(Building2, t.businessTitle, t.businessBody)}
          </Link>
        </div>
      )}

      {mode === "consumer" && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setMode("select")}
            className="u-focus u-meta inline-flex items-center gap-1.5 rounded-nested font-medium text-primary-ink hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            {t.changeType}
          </button>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                id="reg-first-name"
                label={t.firstName}
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
              />
              <Input
                id="reg-last-name"
                label={t.lastName}
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
              />
            </div>
            <Input
              id="reg-email"
              type="email"
              label={t.email}
              autoComplete="email"
              placeholder={t.emailPlaceholder}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
            {/* The password rule used to live in the placeholder, where it
                disappeared the moment you started typing. A hint stays put, and
                its line is also the space an error will occupy. */}
            <Input
              id="reg-password"
              type="password"
              label={t.password}
              autoComplete="new-password"
              placeholder="••••••••"
              hint={t.passwordHint}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
            <Input
              id="reg-phone"
              type="tel"
              label={t.phone}
              autoComplete="tel"
              hint={t.phoneHint}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />

            <FormErrorSlot message={error} />
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              {t.submit}
            </Button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
