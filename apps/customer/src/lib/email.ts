/**
 * Minimal Resend integration via the HTTP API (no SDK dependency).
 * No-ops gracefully when RESEND_API_KEY isn't configured so local/demo
 * environments keep working.
 *
 * Nothing in here logs the recipient. RESEND_API_KEY is an optional
 * integration (render.yaml lists it alongside Checkout/Twilio as "added later
 * in the dashboard"), so the skip branch below is the DEFAULT path, not an
 * edge case — logging `to` there wrote a customer email address to stdout on
 * every single invite. Lines carry a `recipientRef` pseudonym instead: enough
 * to answer "did we try to send to this person?" without the address itself.
 *
 * Nothing in here invents a sender or a host either. The From address and the
 * portal origin come from the shared resolver (@avenick/utils/portal-config);
 * when either is unset the mail is not sent and the reason is logged at error,
 * because a link to a guessed hostname or a From that the provider rejects is
 * a failure dressed up as a success.
 */
// node:crypto keeps this module Node-runtime only. That is already true (it is
// reached solely from "use server" actions and the auth API routes), but see
// the note in @avenick/database's barrel: importing a node:crypto module from
// middleware or an edge route breaks the bundle. Keep this file off those paths.
import { createHash, createHmac } from "node:crypto";
// The rate-limit subpath, not the barrel: the barrel re-exports the NextAuth
// config, which drags next-auth (and its `next/server` import) into every
// module that only wants a throttle — including server actions under vitest.
import { checkRateLimit, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";
import { emailSender, platformName, selfOrigin } from "@avenick/utils/portal-config";
import { passwordResetTtlLabel } from "./password-reset";
// The invitation link is minted, not formatted: only lib/invite-acceptance can
// decide that an address is still an open invitation, and it re-decides the
// same thing when the link is used.
import { inviteAcceptUrl } from "./invite-acceptance";
import { inviteTtlLabel } from "./invite-token";

/** Identifies which mail this is, so log lines stay diagnosable. */
const TEMPLATE = "b2b-company-invite";
const ALREADY_REGISTERED_TEMPLATE = "already-registered-notice";
const PASSWORD_RESET_TEMPLATE = "password-reset";

/** Domain separation, so this pseudonym can never collide with another use. */
const REF_DOMAIN = "avenick:log:recipient:v1";

/**
 * Why a mail was not sent. Callers mostly only read `sent`; the reason exists
 * so a log line or a test can tell "provider not wired up" (the normal local
 * state) apart from "misconfigured" (an operator's problem).
 */
export type EmailSkipReason =
  | "provider-not-configured"
  | "sender-not-configured"
  | "origin-not-configured"
  | "suppressed"
  /**
   * The address is not an open invitation, so no acceptance link could be
   * minted for it — already accepted, revoked, or never invited. An invitation
   * mail without a working link is what the old `/register?email=` link was,
   * and that mail is what left every invitee locked out; not sending is the
   * honest answer, and the caller already reports "we could not send it".
   */
  | "invite-not-open"
  | "provider-rejected"
  | "request-failed";

export type EmailOutcome = { sent: true } | { sent: false; reason: EmailSkipReason };

/**
 * A stable, non-identifying reference to a recipient, safe for logs.
 *
 * Keyed with the app secret when one is present: an *unkeyed* hash of an email
 * address is trivially reversed by hashing a candidate list, which would make
 * the pseudonym worthless the moment logs leaked — the exact scenario it
 * exists for. Falls back to a plain digest in local/dev where no secret is
 * set. Secret resolution matches @avenick/auth `remote-session`.
 *
 * Exported for the password-reset request route, which needs to log "an admin
 * address asked for a reset" without writing the address.
 */
export function recipientRef(address: string): string {
  try {
    const normalised = address.trim().toLowerCase();
    const payload = `${REF_DOMAIN}:${normalised}`;
    const key = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
    const digest = key
      ? createHmac("sha256", key).update(payload, "utf8").digest("hex")
      : createHash("sha256").update(payload, "utf8").digest("hex");
    return digest.slice(0, 12);
  } catch {
    // A log label must never be the reason an invitation fails to send.
    return "unavailable";
  }
}

/**
 * Whether this deployment can send mail at all: the provider key and a valid
 * sender. Address-independent, so a route can check it BEFORE reading any
 * input and refuse loudly for every caller alike. The password-reset request
 * route needs exactly that — its "we have sent a link" sentence is only true
 * when a link could have been sent, and a 500 that is the same for everyone
 * says nothing about which addresses have accounts.
 */
export function mailDeliveryConfigured():
  | { ok: true }
  | { ok: false; reason: Extract<EmailSkipReason, "provider-not-configured" | "sender-not-configured"> } {
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: "provider-not-configured" };
  if (!emailSender()) return { ok: false, reason: "sender-not-configured" };
  return { ok: true };
}

/**
 * The From header, or null with an error logged.
 *
 * Only consulted once RESEND_API_KEY is known to be set: a missing sender in
 * an environment that cannot send anyway is not a misconfiguration worth an
 * error line on every call.
 */
function senderOrNull(template: string, ref: string): string | null {
  const from = emailSender();
  if (from) return from;
  log.error("email skipped: RESEND_FROM_EMAIL is unset or not a valid sender", undefined, {
    template,
    recipientRef: ref,
    reason: "sender-not-configured" satisfies EmailSkipReason,
  });
  return null;
}

/** This portal's public origin for links in the mail, or null with an error logged. */
function originOrNull(template: string, ref: string): string | null {
  const origin = selfOrigin("customer");
  if (origin) return origin;
  log.error("email skipped: customer portal origin is not configured", undefined, {
    template,
    recipientRef: ref,
    reason: "origin-not-configured" satisfies EmailSkipReason,
  });
  return null;
}

/**
 * The provider's own error classifier, and nothing else.
 *
 * Resend answers with `{ statusCode, name, message }`. `name`
 * ("validation_error", "missing_api_key", "invalid_from_address") is the part
 * that actually tells an operator what to fix; `message` is free text that
 * quotes the recipient address back at us, which is why the body is no longer
 * logged verbatim. Never throws — diagnostics must not create failures.
 */
async function providerErrorName(res: Response): Promise<string> {
  try {
    const parsed: unknown = JSON.parse(await res.text());
    if (parsed && typeof parsed === "object") {
      const name = (parsed as { name?: unknown }).name;
      if (typeof name === "string" && name.length <= 64) return name;
    }
  } catch {
    /* fall through */
  }
  return "unclassified";
}

/** Resend's message id, for support to trace a delivery. Never throws. */
async function providerMessageId(res: Response): Promise<string | undefined> {
  try {
    const parsed: unknown = await res.json();
    const id = (parsed as { id?: unknown } | null)?.id;
    return typeof id === "string" ? id : undefined;
  } catch {
    return undefined;
  }
}

/** The shared header block every template opens with. */
function brandHeader(): string {
  return `
    <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:24px">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;font-weight:900;text-align:center;line-height:32px">A</div>
      <strong style="font-size:18px">${platformName()}</strong>
    </div>`;
}

/**
 * One POST to the provider, with the outcome logged the same way for every
 * template. The recipient is only ever in the request body; log lines carry
 * `ref` and the fields the caller passes (template, purpose).
 */
async function deliver(
  key: string,
  message: { from: string; to: string; subject: string; html: string },
  fields: { template: string; purpose?: string; recipientRef: string },
): Promise<EmailOutcome> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: message.from, to: [message.to], subject: message.subject, html: message.html }),
    });
    if (!res.ok) {
      log.error("email send failed", undefined, {
        provider: "resend",
        ...fields,
        status: res.status,
        providerError: await providerErrorName(res),
      });
      return { sent: false, reason: "provider-rejected" };
    }
    // Accepted the moment the response came back 2xx. Reading the id is
    // best-effort and cannot downgrade that outcome — reporting `sent: false`
    // for a mail Resend did accept would be a worse lie than a missing id.
    log.info("email sent", { provider: "resend", ...fields, messageId: await providerMessageId(res) });
    return { sent: true };
  } catch (e) {
    log.error("email request error", e, { provider: "resend", ...fields });
    return { sent: false, reason: "request-failed" };
  }
}

export async function sendInviteEmail(opts: {
  to: string;
  companyName: string;
  inviterName: string;
  role: string;
}): Promise<EmailOutcome> {
  const key = process.env.RESEND_API_KEY;
  const ref = recipientRef(opts.to);

  if (!key) {
    log.info("email skipped: RESEND_API_KEY not set", { template: TEMPLATE, recipientRef: ref });
    return { sent: false, reason: "provider-not-configured" };
  }

  const from = senderOrNull(TEMPLATE, ref);
  if (!from) return { sent: false, reason: "sender-not-configured" };
  const appUrl = originOrNull(TEMPLATE, ref);
  if (!appUrl) return { sent: false, reason: "origin-not-configured" };
  // THE LINK IS THE INVITATION. This used to be `/register?email=<address>` —
  // an email address in a query string, which /register does not even read, and
  // which carried no credential of any kind. The invitee arrived at the
  // account-type chooser as a cold visitor, could not register (their address
  // was already taken by the PENDING row), could not sign in (no password hash,
  // not ACTIVE) and could not reset a password they had never had. Every door
  // was correctly shut; none of them was a door.
  //
  // It is now a signed, expiring, single-use acceptance token — and it is
  // minted by lib/invite-acceptance against COMMITTED state, so this mail
  // cannot carry a working link to anything but a genuinely open invitation. A
  // link is a credential, so it is built after the guards above (it must not be
  // in scope for a skip branch to log) and is never logged.
  const acceptUrl = await inviteAcceptUrl({ email: opts.to, origin: appUrl });
  if (!acceptUrl) {
    log.info("invite email skipped: no open invitation for this address", { template: TEMPLATE, recipientRef: ref });
    return { sent: false, reason: "invite-not-open" };
  }

  // Company and inviter names are typed by users at registration; they land
  // inside HTML here, so they are escaped like any other untrusted text.
  const companyName = escapeHtml(opts.companyName);
  const inviterName = escapeHtml(opts.inviterName);
  const roleLabel = escapeHtml(opts.role.replace("COMPANY_", "").toLowerCase());
  const brand = platformName();
  const html = `
  <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0a0a0b">
    ${brandHeader()}
    <h1 style="font-size:22px;margin:0 0 8px">You've been invited to ${companyName}</h1>
    <p style="color:#52525b;font-size:14px;line-height:1.6">
      ${inviterName} has invited you to join <strong>${companyName}</strong> on ${brand}
      as a <strong>${roleLabel}</strong>. Set your password to start purchasing on behalf of your company.
    </p>
    <a href="${acceptUrl}" style="display:inline-block;margin:20px 0;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px">Accept invitation</a>
    <p style="color:#52525b;font-size:13px;line-height:1.6">
      This link expires in ${escapeHtml(inviteTtlLabel())} and can only be used once.
      If it has expired, ask ${inviterName} to invite you again.
    </p>
    <p style="color:#a1a1aa;font-size:12px">If you weren't expecting this, you can ignore this email.</p>
  </div>`;

  return deliver(
    key,
    { from, to: opts.to, subject: `You're invited to ${opts.companyName} on ${brand}`, html },
    { template: TEMPLATE, recipientRef: ref },
  );
}

/**
 * Carry the truth out of band, to the one party entitled to it.
 *
 * The registration endpoints answer identically whether or not an address is
 * already taken (a 409 there was a free membership oracle), so the account's
 * real owner is told by email instead — which also tells them someone tried,
 * which a 409 never did.
 *
 * Capped per TARGET address, not per caller: the caller is whoever is hammering
 * the route, and their IP is already throttled separately. The cap sits on the
 * send itself so every call site (pre-check branch, P2002 race branch, consumer
 * and business registration) is covered without having to remember it.
 *
 * Configuration is checked before the cap is consumed: a notice that could not
 * have been sent must not spend the one-a-day budget the real one needs.
 */
export async function sendAlreadyRegisteredNotice(opts: {
  to: string;
  /** Which registration surface triggered it; logged, never sent. */
  source: "consumer" | "business";
}): Promise<EmailOutcome> {
  const key = process.env.RESEND_API_KEY;
  const ref = recipientRef(opts.to);
  const purpose = `register.${opts.source}.already-registered`;

  if (!key) {
    log.info("email skipped: RESEND_API_KEY not set", { template: ALREADY_REGISTERED_TEMPLATE, purpose, recipientRef: ref });
    return { sent: false, reason: "provider-not-configured" };
  }

  const from = senderOrNull(ALREADY_REGISTERED_TEMPLATE, ref);
  if (!from) return { sent: false, reason: "sender-not-configured" };
  const appUrl = originOrNull(ALREADY_REGISTERED_TEMPLATE, ref);
  if (!appUrl) return { sent: false, reason: "origin-not-configured" };

  const suppression = await checkRateLimit(RATE_LIMITS.alreadyRegisteredNotice, opts.to.trim().toLowerCase());
  if (!suppression.ok) {
    log.info("already-registered notice suppressed: sent to this address within the window", {
      template: ALREADY_REGISTERED_TEMPLATE,
      purpose,
      recipientRef: ref,
      resetAt: new Date(suppression.resetAt).toISOString(),
    });
    return { sent: false, reason: "suppressed" };
  }

  const brand = platformName();
  const html = `
  <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0a0a0b">
    ${brandHeader()}
    <h1 style="font-size:22px;margin:0 0 8px">You already have a ${brand} account</h1>
    <p style="color:#52525b;font-size:14px;line-height:1.6">
      Someone just tried to create a ${brand} account with this email address.
      You already have one, so no new account was created and nothing has changed.
      Sign in with your existing password.
    </p>
    <a href="${appUrl}/login" style="display:inline-block;margin:20px 0;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px">Sign in</a>
    <p style="color:#52525b;font-size:13px;line-height:1.6">
      Forgotten your password? <a href="${appUrl}/auth/forgot-password" style="color:#4f46e5">Request a reset link</a>.
      If you still cannot get in, <a href="${appUrl}/support" style="color:#4f46e5">contact support</a>.
    </p>
    <p style="color:#a1a1aa;font-size:12px">If this wasn't you, you can ignore this email. Your account was not changed.</p>
  </div>`;

  return deliver(
    key,
    { from, to: opts.to, subject: `You already have a ${brand} account`, html },
    { template: ALREADY_REGISTERED_TEMPLATE, purpose, recipientRef: ref },
  );
}

/**
 * The reset link itself. The caller (the password-reset request route) has
 * already decided the account is eligible and built `resetUrl` from the shared
 * resolver; this function only carries it. The URL embeds a credential — the
 * signed token — so like the address it is never logged, not even on failure.
 */
export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
  firstName: string;
}): Promise<EmailOutcome> {
  const key = process.env.RESEND_API_KEY;
  const ref = recipientRef(opts.to);

  if (!key) {
    log.info("email skipped: RESEND_API_KEY not set", { template: PASSWORD_RESET_TEMPLATE, recipientRef: ref });
    return { sent: false, reason: "provider-not-configured" };
  }

  const from = senderOrNull(PASSWORD_RESET_TEMPLATE, ref);
  if (!from) return { sent: false, reason: "sender-not-configured" };

  const brand = platformName();
  const greeting = opts.firstName.trim() ? `Hi ${escapeHtml(opts.firstName.trim())},` : "Hi,";
  const html = `
  <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0a0a0b">
    ${brandHeader()}
    <h1 style="font-size:22px;margin:0 0 8px">Reset your ${brand} password</h1>
    <p style="color:#52525b;font-size:14px;line-height:1.6">
      ${greeting} someone asked to reset the password for the ${brand} account registered to this
      email address. If that was you, choose a new password with the button below.
    </p>
    <a href="${opts.resetUrl}" style="display:inline-block;margin:20px 0;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px">Choose a new password</a>
    <p style="color:#52525b;font-size:13px;line-height:1.6">
      This link expires in ${passwordResetTtlLabel()} and can be used once.
    </p>
    <p style="color:#a1a1aa;font-size:12px">If you did not ask for this, you can ignore this email. Your password has not changed.</p>
  </div>`;

  return deliver(
    key,
    { from, to: opts.to, subject: `Reset your ${brand} password`, html },
    { template: PASSWORD_RESET_TEMPLATE, recipientRef: ref },
  );
}

/** User-entered text (names) lands inside template HTML; never raw. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
