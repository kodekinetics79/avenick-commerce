import bcrypt from "bcryptjs";
import { db, type UserRole } from "@avenick/database";

/**
 * THE ONE PLACE AN EMAIL AND A PASSWORD BECOME A USER.
 *
 * There are now two front doors to the same credential: the NextAuth
 * Credentials provider in `config.ts`, which the three web portals sign in
 * through, and `POST /api/v1/auth/token`, which the mobile app exchanges for a
 * bearer pair. If each implemented its own lookup they would drift — one would
 * lowercase the address and the other would not, one would check
 * `status === ACTIVE` and the other would forget, one would accept an account
 * with a null `passwordHash` — and the weaker of the two would become the way
 * in. So both call this, and it is the only bcrypt comparison in the codebase's
 * sign-in path.
 *
 * It deliberately does NOT rate limit. The two callers throttle on the same
 * `RATE_LIMITS.login` / `RATE_LIMITS.loginIp` buckets with the same keys, so
 * the budgets are shared, but WHERE that check happens differs: the provider
 * does it before parsing, the route does it through the v1 wrapper. Putting it
 * here as well would spend each budget twice.
 */

/** Everything either caller needs, read once. */
export const CREDENTIAL_USER_SELECT = {
  id: true,
  email: true,
  passwordHash: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  language: true,
  avatar: true,
  deletedAt: true,
  sessionsValidAfter: true,
} as const;

export interface CredentialUser {
  id: string;
  email: string;
  passwordHash: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: string;
  language: string;
  avatar: string | null;
  deletedAt: Date | null;
  sessionsValidAfter: Date | null;
}

/**
 * A real bcrypt hash of a value nobody knows, compared against when there is no
 * account or no password on file.
 *
 * Returning early in that case makes the endpoint an account-existence oracle
 * you can read with a stopwatch: a miss answers in a millisecond and a hit
 * answers in the ~250ms bcrypt takes at cost 12. Doing the work anyway costs a
 * failed login some time it was going to spend if the address had been real,
 * and costs a legitimate user nothing.
 *
 * Hardcoded rather than hashed at startup: generating one at cost 12 on module
 * load would add a quarter of a second to every cold start of all three
 * portals, and the value is not a secret — it is a decoy.
 */
const ABSENT_ACCOUNT_HASH = "$2a$12$PqtOb5SW81XqbWDpg98xrewX2GvsHyAOBDWRb0OkO9Zbp5j/o8l0y";

/**
 * Compare a password against a stored hash. The single call site for bcrypt in
 * the sign-in path; nothing else should re-implement it.
 */
export function verifyPassword(password: string, passwordHash: string | null): Promise<boolean> {
  return bcrypt.compare(password, passwordHash ?? ABSENT_ACCOUNT_HASH);
}

/**
 * Look the account up and check the password.
 *
 * Returns null for every failure — unknown address, no password set, wrong
 * password, deleted or not-yet-active account — and the caller must not tell
 * them apart in its response. "No account with that email" and "wrong password"
 * are two different answers to someone testing a leaked credential list, and
 * the difference is worth more to them than to the person who mistyped.
 */
export async function verifyCredentials(input: {
  email: string;
  password: string;
}): Promise<CredentialUser | null> {
  const email = input.email.trim().toLowerCase();
  const user = (await db.user.findUnique({
    where: { email },
    select: CREDENTIAL_USER_SELECT,
  })) as CredentialUser | null;

  // Unconditional, before any decision is returned: see ABSENT_ACCOUNT_HASH.
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? null);

  if (!user || !user.passwordHash) return null;
  if (user.status !== "ACTIVE" || user.deletedAt) return null;
  if (!passwordOk) return null;
  return user;
}
