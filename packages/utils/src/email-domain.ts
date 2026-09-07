/**
 * The domain half of an email address, and whether it belongs to anybody.
 *
 * This exists for one decision: a person types a commercial registration number
 * and an email address, and the system has to answer "does this address plausibly
 * belong to that company?" before it spends a human's attention on the question.
 * The domain is the only part of an address that carries an organisation's name,
 * so the domain is what is checked.
 *
 * Pure string work — no node:crypto, no database, no environment. It is reached
 * from server routes AND from the registration form's client-side hint, so it
 * must stay safe to bundle for the browser.
 */

/**
 * Mailbox providers that belong to the public rather than to an employer.
 *
 * The list is not here to block anyone from registering. It is here to stop a
 * company from ever being RECOGNISED at one of these domains: a company whose
 * founding admin signed up with a gmail.com address must not come to claim
 * gmail.com, because that would let every Gmail user on earth pass the "do you
 * work here?" gate for that company. Such a company keeps an empty domain list
 * and stays invite-only — a narrower door, not a broken one.
 *
 * Disposable-address services are in the same list for the same reason and not
 * because throwaway addresses are unwelcome in themselves.
 *
 * Kept in step with the identical list in the SQL backfill of
 * 20260906120000_company_join_requests. Two copies is the deliberate price of a
 * backfill that cannot import TypeScript; the list changes about once a decade.
 */
const PUBLIC_MAILBOX_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
  "gmx.com", "gmx.net", "mail.com", "zoho.com", "yandex.com", "yandex.ru",
  "qq.com", "163.com", "126.com", "naver.com", "hushmail.com",
  "mailinator.com", "yopmail.com", "guerrillamail.com", "10minutemail.com",
  "tempmail.com", "temp-mail.org", "trashmail.com", "sharklasers.com",
  "dispostable.com", "getnada.com", "maildrop.cc", "fakeinbox.com",
]);

/**
 * The lower-cased domain of an address, or null if there isn't exactly one.
 *
 * Deliberately strict rather than forgiving. This value decides whether someone
 * is let near a company's account, so an address this function cannot read
 * confidently must produce null and be refused, never a best guess. An address
 * with two "@" signs, an empty domain, or a domain with no dot is not something
 * to interpret.
 */
export function emailDomainOf(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || !domain) return null;
  // A bare hostname ("aramco") is not a domain anyone receives mail at, and a
  // leading or trailing dot is a malformed one.
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return null;
  if (/\s/.test(domain)) return null;
  return domain;
}

/** Whether a domain is a public mailbox provider rather than an organisation's. */
export function isPublicMailboxDomain(domain: string): boolean {
  return PUBLIC_MAILBOX_DOMAINS.has(domain.trim().toLowerCase());
}

/**
 * The domain to recognise a company at, given the address of the person who
 * registered it — or null when there is nothing safe to record.
 *
 * Null is the common, correct outcome for a small company that signed up from a
 * personal address, and callers must treat it as "this company has no domain",
 * never as an error worth showing the applicant.
 */
export function claimableDomainOf(email: string): string | null {
  const domain = emailDomainOf(email);
  if (!domain || isPublicMailboxDomain(domain)) return null;
  return domain;
}

/**
 * Whether an address may apply to join a company recognised at `domains`.
 *
 * A company with no recognised domains admits nobody by this route, which is
 * why the empty list is checked first and answered false rather than true.
 */
export function domainMatchesCompany(email: string, domains: readonly string[]): boolean {
  if (domains.length === 0) return false;
  const domain = emailDomainOf(email);
  if (!domain) return false;
  return domains.some((d) => d.trim().toLowerCase() === domain);
}
