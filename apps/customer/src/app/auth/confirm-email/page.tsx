import Link from "next/link";
import { cookies } from "next/headers";
import { AlertCircle } from "lucide-react";
import { log } from "@avenick/observability";
import { AuthNotice, AuthShell } from "../auth-shell";
import { identityCopy, LOCALE_COOKIE, resetTtlLabel, toIdentityLocale, type IdentityLocale } from "../identity-copy";
import {
  EMAIL_VERIFICATION_TTL_SECONDS,
  emailVerificationTtlLabel,
  verifyEmailVerificationToken,
} from "@/lib/email-verification";
import { ConfirmEmailForm } from "./confirm-form";

/**
 * Public; reached from the link in the confirmation email (`?token=`).
 *
 * This is the middle step of joining a company that already exists: the domain
 * gate has matched, and this page turns "somebody typed an address at that
 * domain" into "somebody reads mail at that address". Only then does a human at
 * the company get asked anything.
 *
 * The signature and expiry are checked here, before the button renders, so a
 * stale link is told so at once. Whether the application still exists and is
 * still awaiting confirmation needs the database and is decided by the verify
 * route on submit. Nothing about the token is logged: it is a credential.
 */
export default async function ConfirmEmailPage({ searchParams }: { searchParams?: { token?: string | string[] } }) {
  const locale = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = identityCopy(locale).confirmEmail;
  // The English label is DERIVED from the constant the verifier enforces, and
  // the Arabic is built from the same seconds rather than translated from that
  // label — a translated "1 day" is a copy of a copy, and would go stale the
  // moment the TTL changed. Same helper the reset page uses.
  const ttl = resetTtlLabel(locale, EMAIL_VERIFICATION_TTL_SECONDS, emailVerificationTtlLabel());

  const raw = searchParams?.token;
  const token = typeof raw === "string" && raw.length > 0 ? raw : null;
  const preflight = token ? verifyEmailVerificationToken(token) : null;

  if (preflight && !preflight.ok && preflight.reason === "no-secret") {
    log.error("confirm-email page: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, {
      path: "/auth/confirm-email",
    });
  }

  return (
    <AuthShell
      locale={locale}
      eyebrow={t.eyebrow}
      title={t.title}
      subtitle={t.subtitle}
      note={t.note(ttl)}
      footer={
        <p className="u-meta text-ink-3">
          {t.backTo}{" "}
          <Link href="/login" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            {t.signIn}
          </Link>
        </p>
      }
    >
      {!token && <Unusable locale={locale}>{t.missingToken}</Unusable>}
      {token && preflight && !preflight.ok && preflight.reason === "no-secret" && (
        <p className="u-body text-ink-2" role="alert">
          {t.noSecret}
        </p>
      )}
      {token && preflight && !preflight.ok && preflight.reason !== "no-secret" && (
        <Unusable locale={locale}>{t.deadToken}</Unusable>
      )}
      {token && preflight?.ok && <ConfirmEmailForm locale={locale} token={token} />}
    </AuthShell>
  );
}

/** A dead link is told so plainly, with the one action that fixes it. */
function Unusable({ locale, children }: { locale: IdentityLocale; children: React.ReactNode }) {
  const t = identityCopy(locale).confirmEmail;
  return (
    <div className="space-y-3">
      <AuthNotice tone="danger" icon={<AlertCircle className="h-4 w-4" />}>
        {children}
      </AuthNotice>
      <p className="u-meta text-ink-3">
        <Link href="/b2b/join" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
          {t.applyAgain}
        </Link>
      </p>
    </div>
  );
}
