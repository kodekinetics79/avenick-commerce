"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInWithCredentials } from "@avenick/auth/client";
import { messageForSignInError } from "@avenick/auth/sign-in-messages";
import { safeReturnTo } from "@avenick/auth/safe-redirect";
import { Input, Button, Surface } from "@avenick/ui";
import { FormErrorSlot } from "../auth/auth-shell";
import { identityCopy, type IdentityLocale } from "../auth/identity-copy";

/**
 * The sign-in form: the only part of /login that has to run in the browser.
 *
 * The page around it is a Server Component now, so the shell, the display plate,
 * the masthead and the ledger are all rendered on the server and this island
 * carries nothing but the four controlled fields and the request.
 *
 * NOTHING ABOUT THE AUTHENTICATION PATH CHANGED. The same three imports, the
 * same order of operations, the same request, the same error mapping. In
 * particular:
 *
 *   callbackUrl is read here and validated by safeReturnTo BEFORE it is used —
 *   an unchecked callback is an open redirect, because a successful login would
 *   navigate the visitor to an attacker-chosen origin. It is read from
 *   useSearchParams in the browser, in this component, exactly as it was, so
 *   the value that is validated is the value that is navigated to. Do not move
 *   this read to the server page and hand the result down: that separates the
 *   check from the use, which is precisely the shape open-redirect bugs have.
 */
/**
 * The sign-in error, in the reader's language.
 *
 * THE PACKAGE STILL OWNS THE DECISION. The distinction that matters — throttled
 * versus wrong credentials — is made by @avenick/auth, because telling a
 * rate-limited user their password is wrong makes them retry against a budget
 * that is already exhausted and can send them to a reset they never needed. This
 * function never re-derives that; it calls the package and translates the answer.
 *
 * Round one called `messageForSignInErrorBilingual`, which returns
 * "Invalid email or password. / بيانات الدخول غير صحيحة." — both languages at
 * once, in the one place on the page a person is already frustrated. That is the
 * last slash-label on this screen and the function lives in packages/auth, which
 * this track does not own; the cross-track request is a
 * `messageForSignInError(code, locale)` overload there.
 *
 * The comparison is against the package's own output rather than a copied
 * string, so if it rewords the throttle message both sides move together. If it
 * ever changes the CODE, every outcome falls through to the generic credential
 * message — which is also the package's own fallback, and the reason it exists:
 * we never reveal whether an account exists.
 */
function localiseSignInError(
  code: string | null | undefined,
  locale: IdentityLocale,
  t: ReturnType<typeof identityCopy>["login"],
): string {
  const english = messageForSignInError(code);
  if (!english || locale === "en") return english;
  return english === messageForSignInError("rate_limited") ? t.errorThrottled : t.errorInvalid;
}

export function LoginForm({ locale }: { locale: IdentityLocale }) {
  const t = identityCopy(locale).login;
  const searchParams = useSearchParams();
  const urlError = searchParams.get("code") ?? searchParams.get("error");
  const callbackUrl = safeReturnTo(searchParams.get("callbackUrl"), "/account/orders");
  /*
   * Whether this sign-in is headed for the buyer workspace.
   *
   * Derived from the value safeReturnTo already returned rather than from the
   * raw query string, so the destination a person is TOLD about is the exact
   * path the browser will be sent to. Reading the parameter a second time to
   * write the sentence would let the two disagree — the page could promise the
   * buyer workspace and then land on /account/orders because the raw value had
   * failed validation.
   */
  const toWorkspace = callbackUrl === "/b2b" || callbackUrl.startsWith("/b2b/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => localiseSignInError(urlError, locale, t));

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signInWithCredentials(email, password, callbackUrl);
      if (!res.ok) {
        setError(localiseSignInError(res.code ?? res.error, locale, t));
        setLoading(false);
      } else {
        window.location.assign(callbackUrl);
      }
    } catch {
      setError(t.genericError);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4" aria-label={t.formLabel}>
      {/* htmlFor/id: the label was visually adjacent but not programmatically
          associated, so it was not announced. <Input label> emits both.
          The label is now ONE language — the reader's. Round one set every field
          to "Email / البريد الإلكتروني", which showed both languages to both
          audiences and is the clearest possible statement that the Arabic build
          is a setting rather than a design. */}
      <Input
        id="login-email"
        name="email"
        type="email"
        label={t.email}
        autoComplete="username"
        placeholder={t.emailPlaceholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div>
        <Input
          id="login-password"
          name="password"
          type="password"
          label={t.password}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="mt-1.5">
          <Link
            href="/auth/forgot-password"
            className="u-focus u-meta rounded-nested font-medium text-primary-ink hover:underline"
          >
            {t.forgot}
          </Link>
        </p>
      </div>
      <FormErrorSlot message={error} />
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        {t.submit}
      </Button>
      <CompanyDoor locale={locale} toWorkspace={toWorkspace} />
    </form>
  );
}

/**
 * The company door.
 *
 * WHAT WAS WRONG. This deployment has exactly one sign-in form and nothing on
 * the page said so. A company buyer arriving at /login saw "Sign in to see your
 * orders, returns and support tickets" — three consumer surfaces — with a
 * "Register" link beside it that leads to the personal/business chooser. The
 * owner could not find the company door because there was no company door: the
 * form WAS it, silently. Meanwhile /b2b bounces a member with no durable
 * membership to /b2b/register, so the one page that talks about company
 * accounts is a registration form an existing member must not fill in.
 *
 * WHY IT IS NOT A SECOND FORM. Two forms on a sign-in page is the worst
 * available answer: the credentials are identical, so a person who guesses
 * wrong is refused by a form that would have accepted them, and every refusal
 * reads as "wrong password" because @avenick/auth collapses every failure to
 * one message. There is one set of credentials, so there is one set of boxes.
 * What differs is only where you LAND, which is a callbackUrl and nothing more.
 *
 * It therefore lives inside this island rather than in the server page: the
 * validated callbackUrl is here, so the block can state the destination instead
 * of offering a link to a destination the visitor has already chosen. The page
 * around it still never reads the parameter — see the note on LoginPage.
 */
function CompanyDoor({ locale, toWorkspace }: { locale: IdentityLocale; toWorkspace: boolean }) {
  const t = identityCopy(locale).login;
  return (
    <Surface rung={1} className="space-y-1.5 p-4">
      <p className="u-ui font-medium text-ink-1">{t.companyTitle}</p>
      {/* The destination line replaces the link rather than joining it: once the
          callbackUrl already points at the workspace, a link back to the same
          page reads as a dead control. */}
      <p className="u-meta text-ink-2">{toWorkspace ? t.destinationB2B : t.companyBody}</p>
      <p className="u-meta flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-ink-3">
        {!toWorkspace && (
          <Link
            href="/login?callbackUrl=%2Fb2b"
            className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
          >
            {t.companyAction}
          </Link>
        )}
        <Link
          href="/b2b/register"
          className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
        >
          {t.companyRegister}
        </Link>
      </p>
    </Surface>
  );
}
