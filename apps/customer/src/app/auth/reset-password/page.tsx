import Link from "next/link";
import { cookies } from "next/headers";
import { AlertCircle } from "lucide-react";
import { log } from "@avenick/observability";
import { portalUrl } from "@avenick/utils/portal-config";
import { AuthNotice, AuthShell } from "../auth-shell";
import { identityCopy, LOCALE_COOKIE, resetTtlLabel, toIdentityLocale, type IdentityLocale } from "../identity-copy";
import { PASSWORD_RESET_TTL_SECONDS, passwordResetTtlLabel, verifyPasswordResetToken } from "@/lib/password-reset";
import { ResetForm } from "./reset-form";

/**
 * Public; reached from the link in the reset email (`?token=`).
 *
 * The signature and expiry are checked here, before the form renders, so a
 * stale or mangled link is told so at once rather than after typing a
 * password twice. Whether the token is still unredeemed and the account still
 * eligible needs the database and is decided by the redeem route on submit.
 * Nothing about the token is logged: it is a credential.
 */
export default async function ResetPasswordPage({ searchParams }: { searchParams?: { token?: string | string[] } }) {
  const locale = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = identityCopy(locale).reset;
  const ttl = resetTtlLabel(locale, PASSWORD_RESET_TTL_SECONDS, passwordResetTtlLabel());

  const raw = searchParams?.token;
  const token = typeof raw === "string" && raw.length > 0 ? raw : null;
  const preflight = token ? verifyPasswordResetToken(token) : null;

  if (preflight && !preflight.ok && preflight.reason === "no-secret") {
    log.error("reset-password page: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, { path: "/auth/reset-password" });
  }

  // The seller portal is a separate deployment; a seller who resets here is
  // sent back to it. Resolved on the server so the client form carries a
  // finished URL (or an honest null) rather than the resolver.
  const sellerSignInUrl = portalUrl("seller", "/login");

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
      {token && preflight?.ok && <ResetForm locale={locale} token={token} sellerSignInUrl={sellerSignInUrl} />}
    </AuthShell>
  );
}

/** A dead link is told so plainly, with the one action that fixes it. */
function Unusable({ locale, children }: { locale: IdentityLocale; children: React.ReactNode }) {
  const t = identityCopy(locale).reset;
  return (
    <div className="space-y-3">
      <AuthNotice tone="danger" icon={<AlertCircle className="h-4 w-4" />}>
        {children}
      </AuthNotice>
      <p className="u-meta text-ink-3">
        <Link
          href="/auth/forgot-password"
          className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
        >
          {t.requestNew}
        </Link>
      </p>
    </div>
  );
}
