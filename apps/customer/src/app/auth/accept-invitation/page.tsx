import Link from "next/link";
import { cookies } from "next/headers";
import { AlertCircle } from "lucide-react";
import { log } from "@avenick/observability";
import { AuthNotice, AuthShell } from "../auth-shell";
import { identityCopy, LOCALE_COOKIE, toIdentityLocale, type IdentityLocale } from "../identity-copy";
import { invitationTtlLabel, verifyInvitationToken } from "@/lib/invitation";
import { AcceptInvitationForm } from "./accept-form";

/**
 * Public; reached from the link in a company invitation email (`?token=`).
 *
 * Before this page existed, that email pointed at /register — a page which,
 * for an address a company admin had already created a row for, could only
 * answer "that address is already registered". The invitation was a door with
 * no handle on the inside: the account stayed PENDING, and sign-in refuses
 * anything that is not ACTIVE. This is the inside handle.
 *
 * The signature and expiry are checked here, before the form renders, so a
 * stale link is told so at once rather than after typing a password twice.
 * Whether the account is still PENDING and the invitation still unaccepted
 * needs the database and is decided by the accept route on submit. Nothing
 * about the token is logged: it is a credential.
 */
export default async function AcceptInvitationPage({ searchParams }: { searchParams?: { token?: string | string[] } }) {
  const locale = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = identityCopy(locale).invitation;

  const raw = searchParams?.token;
  const token = typeof raw === "string" && raw.length > 0 ? raw : null;
  const preflight = token ? verifyInvitationToken(token) : null;

  if (preflight && !preflight.ok && preflight.reason === "no-secret") {
    log.error("accept-invitation page: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, {
      path: "/auth/accept-invitation",
    });
  }

  return (
    <AuthShell
      locale={locale}
      eyebrow={t.eyebrow}
      title={t.title}
      subtitle={t.subtitle}
      note={t.note(invitationTtlLabel())}
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
      {token && preflight?.ok && <AcceptInvitationForm locale={locale} token={token} />}
    </AuthShell>
  );
}

/**
 * A dead invitation is told so plainly. There is no "request a new one" link
 * because there is no endpoint that would honour it: only the company admin who
 * sent the invitation can send another, so that is what the page says.
 */
function Unusable({ locale, children }: { locale: IdentityLocale; children: React.ReactNode }) {
  const t = identityCopy(locale).invitation;
  return (
    <div className="space-y-3">
      <AuthNotice tone="danger" icon={<AlertCircle className="h-4 w-4" />}>
        {children}
      </AuthNotice>
      <p className="u-meta text-ink-3">{t.askAdmin}</p>
    </div>
  );
}
