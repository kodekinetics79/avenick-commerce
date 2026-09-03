import Link from "next/link";
import { cookies } from "next/headers";
import { PASSWORD_RESET_TTL_SECONDS, passwordResetTtlLabel } from "@/lib/password-reset";
import { AuthShell } from "../auth-shell";
import { identityCopy, LOCALE_COOKIE, resetTtlLabel, toIdentityLocale } from "../identity-copy";
import { ForgotForm } from "./forgot-form";

/**
 * Public. Hosts password reset for every non-admin account, including seller
 * portal users — the seller portal links here. The page is a server component
 * so the expiry the form promises is read from the same constant the token
 * verifier enforces; the form itself never imports the (node:crypto) module.
 *
 * The TTL is localised here rather than translated: `passwordResetTtlLabel()`
 * derives the English form from PASSWORD_RESET_TTL_SECONDS, and resetTtlLabel()
 * derives the Arabic from the same number. Translating the English string would
 * make the Arabic a copy of a copy, and a promise that can drift from the
 * expiry the verifier actually enforces is a truth defect, not a wording one.
 */
export default async function ForgotPasswordPage() {
  const locale = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = identityCopy(locale).forgot;
  const ttl = resetTtlLabel(locale, PASSWORD_RESET_TTL_SECONDS, passwordResetTtlLabel());

  return (
    <AuthShell
      locale={locale}
      eyebrow={t.eyebrow}
      title={t.title}
      subtitle={t.subtitle}
      // A fact about the system rather than a reassuring guess.
      note={t.note(ttl)}
      footer={
        <p className="u-meta text-ink-3">
          {t.remembered}{" "}
          <Link href="/login" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            {t.signIn}
          </Link>
        </p>
      }
    >
      <ForgotForm locale={locale} expiresIn={ttl} />
    </AuthShell>
  );
}
