import Link from "next/link";
import { cookies } from "next/headers";
import { AlertCircle, Building2, ShieldCheck } from "lucide-react";
import { log } from "@avenick/observability";
import { Surface } from "@avenick/ui";
import { AuthNotice, AuthShell } from "../auth-shell";
import { identityCopy, LOCALE_COOKIE, toIdentityLocale, type IdentityLocale } from "../identity-copy";
import { INVITE_TOKEN_PARAM } from "./contract";
import { previewInvite } from "./invite-preflight";
import { AcceptForm } from "./accept-form";

import type { Metadata } from "next";

/**
 * Accept a company invitation: /auth/accept-invite?token=…
 *
 * THE DOOR THAT DID NOT EXIST. `inviteMember` writes a User with
 * `status: PENDING` and no `passwordHash`, and a matching CompanyMember. Every
 * other entrance is then correctly locked against that person: /register
 * answers neutrally because the address is taken, /login refuses an account with
 * no hash AND refuses a non-ACTIVE one, and /auth/forgot-password refuses a
 * pending account by name ("invited, never activated") because a mailbox proves
 * ownership, not standing. Four correct refusals and no way in. Nothing in the
 * product ever wrote ACTIVE to an invited user. This page is the missing door,
 * and it is deliberately the ONLY thing that opens it.
 *
 * WHAT IT STATES BEFORE IT ASKS. The company and the role are read from the
 * database by ./invite-preflight and never from the URL: an invitation email is
 * the one artefact an attacker can compose freely, and "set a password" without
 * a named counterparty is a phishing screen with our own brand on it. The
 * password rule is stated in full ABOVE the boxes rather than fired back as a
 * rejection, because a rule a person reads first is a rule they meet first.
 *
 * WHAT IT REFUSES TO REVEAL. Every dead end — expired, forged, already used,
 * withdrawn, no such account — renders one sentence. This page is reachable by
 * anyone holding a URL, so telling those apart would make it the membership
 * oracle that /register, /login and /auth/forgot-password each go out of their
 * way not to be.
 *
 * The token is never logged. It is a credential.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: identityCopy(locale).invite.title };
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const locale = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = identityCopy(locale).invite;

  const raw = searchParams?.[INVITE_TOKEN_PARAM];
  const token = typeof raw === "string" && raw.length > 0 ? raw : null;
  const preview = await previewInvite(token, locale);

  if (!preview.ok && preview.reason === "no-secret") {
    // An operator fault, not a statement about any account: without AUTH_SECRET
    // an HMAC is a hash anyone can compute, so no invitation can be trusted here.
    log.error("accept-invite page: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, {
      path: "/auth/accept-invite",
    });
  }

  return (
    <AuthShell
      locale={locale}
      eyebrow={t.eyebrow}
      title={t.title}
      subtitle={preview.ok ? t.subtitle(preview.companyName) : t.subtitleUnusable}
      note={preview.ok ? t.note(expiryLabel(locale, preview.expiresAt)) : undefined}
      footer={
        <p className="u-meta text-ink-3">
          {t.backTo}{" "}
          <Link href="/login" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            {t.signIn}
          </Link>
        </p>
      }
    >
      {!preview.ok && preview.reason === "missing" && <Unusable locale={locale}>{t.missingToken}</Unusable>}
      {!preview.ok && preview.reason === "no-secret" && (
        <p className="u-body text-ink-2" role="alert">
          {t.noSecret}
        </p>
      )}
      {!preview.ok && preview.reason === "dead" && <Unusable locale={locale}>{t.deadToken}</Unusable>}
      {preview.ok && token && (
        <div className="space-y-6">
          <Joining locale={locale} companyName={preview.companyName} role={preview.role} />
          <AcceptForm locale={locale} token={token} companyName={preview.companyName} />
        </div>
      )}
    </AuthShell>
  );
}

/**
 * Who you are about to become, and where.
 *
 * Rung 1 — recessed, the surface for context rather than for action — so it
 * cannot be mistaken for the thing to press. Both values come from the row the
 * administrator wrote; the role in particular is INHERITED and is not a control,
 * because User.role and CompanyMember.role must stay equal or `isDurableB2BMember`
 * locks this person out of the workspace the moment they get in. The sentence
 * under it says so, so nobody reads a missing dropdown as a missing feature.
 */
function Joining({
  locale,
  companyName,
  role,
}: {
  locale: IdentityLocale;
  companyName: string;
  role: string;
}) {
  const t = identityCopy(locale).invite;
  const roleLabel = t.roleLabels[role] ?? t.roleUnknown;
  const roleDescription = t.roleDescriptions[role];

  return (
    <Surface rung={1} className="p-4 sm:p-5">
      <p className="u-micro text-ink-3">{t.joining}</p>
      <dl className="mt-3 space-y-3">
        <div className="flex items-start gap-2.5">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="u-micro text-ink-3">{t.companyLabel}</dt>
            {/* break-words: a filed company name is not a design constraint and
                must not push the card sideways at 390px. */}
            <dd className="u-ui mt-0.5 break-words font-medium text-ink-1">{companyName}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="u-micro text-ink-3">{t.roleLabel}</dt>
            <dd className="u-ui mt-0.5 font-medium text-ink-1">{roleLabel}</dd>
            {roleDescription && <dd className="u-meta mt-0.5 text-ink-2">{roleDescription}</dd>}
          </div>
        </div>
      </dl>
      <p className="u-meta mt-3 border-t border-hairline pt-3 text-ink-3">{t.roleSetByAdmin}</p>
    </Surface>
  );
}

/**
 * A link that cannot be used, told plainly, with the ONE action that fixes it.
 *
 * That action is a person, not a page. /auth/forgot-password is nailed shut
 * against an account that was invited and never activated — deliberately, and
 * correctly — so offering "request a new link" here would send an already-stuck
 * invitee to a form that answers neutrally and mails nothing. The administrator
 * who invited them is the only party who can issue another invitation.
 */
function Unusable({ locale, children }: { locale: IdentityLocale; children: React.ReactNode }) {
  const t = identityCopy(locale).invite;
  return (
    <div className="space-y-3">
      <AuthNotice tone="danger" icon={<AlertCircle className="h-4 w-4" />}>{children}</AuthNotice>
      <p className="u-meta text-ink-3">{t.askAgain}</p>
    </div>
  );
}

/**
 * The instant the signed token stops being accepted, written out.
 *
 * UTC, and it says UTC. The page renders on the server, so a bare wall-clock
 * time would be the deployment's zone presented as the reader's — a promise
 * that is wrong by hours for exactly the audience this platform sells to.
 * Western digits in both locales, per DESIGN_SYSTEM.md §2.3.
 */
function expiryLabel(locale: IdentityLocale, at: Date): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(at);
}
