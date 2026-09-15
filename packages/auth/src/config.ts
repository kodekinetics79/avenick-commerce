import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { UserRole } from "@avenick/database";
import { LoginSchema } from "@avenick/types";
import { verifyCredentials } from "./credentials";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "./rate-limit";
import { SESSION_ISSUED_AT_CLAIM } from "./session-revocation";

type AppName = "customer" | "seller" | "admin";

/**
 * Distinguishes throttling from a wrong password.
 *
 * Returning null for both told a rate-limited user their credentials were
 * invalid. They then retry — spending more of the very budget that is
 * exhausted — and may reset a password that was never wrong. It also hid the
 * control from anyone diagnosing a login problem.
 *
 * Surfacing "too many attempts" leaks nothing about whether an account exists,
 * because the limit is keyed on the client IP as well as the identifier.
 */
export class RateLimitedSignin extends CredentialsSignin {
  override code = "rate_limited";
}

function buildAuthConfig(app: AppName): NextAuthConfig {
  const p = `avenick.${app}`;
  return {
    providers: [
      Credentials({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials, request) {
          const parsed = LoginSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const { email, password } = parsed.data;

          // Throttle brute-force attempts per identifier and per client IP.
          const ip = clientIpFrom(request.headers ?? new Headers());
          const [byEmail, byIp] = await Promise.all([
            checkRateLimit(RATE_LIMITS.login, email.toLowerCase()),
            checkRateLimit(RATE_LIMITS.loginIp, ip),
          ]);
          if (!byEmail.ok || !byIp.ok) throw new RateLimitedSignin();

          // Shared with POST /api/v1/auth/token. Two sign-in doors that each
          // implemented their own lookup would drift, and the weaker of the two
          // would become the way in — see credentials.ts.
          const user = await verifyCredentials({ email, password });
          if (!user) return null;

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            language: user.language,
            image: user.avatar ?? null,
          };
        },
      }),
    ],
    cookies: {
      sessionToken: { name: `${p}.session-token` },
      callbackUrl: { name: `${p}.callback-url` },
      csrfToken: { name: `${p}.csrf-token` },
    },
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          token["role"] = (user as { role: UserRole }).role;
          token["language"] = (user as { language: string }).language;
          /**
           * WHEN THE CREDENTIAL WAS PRESENTED — the half of the revocation
           * check that lives in the token.
           *
           * `User.sessionsValidAfter` can now say "every session older than
           * this instant is dead", but a cutoff is useless without a date to
           * compare it to, and this token had none. The JWT's own `iat` is not
           * it: next-auth re-encodes the session cookie as it is read, so `iat`
           * slides forward with ordinary use and a stolen cookie would keep
           * minting itself a fresh one — the exact thing the cutoff is meant to
           * stop.
           *
           * This claim is written ONLY inside `if (user)`, which next-auth
           * enters just once, at sign-in. Every later invocation carries the
           * existing token through untouched, so the value stays pinned to the
           * moment a password was actually checked, for the whole 30-day life
           * of the session.
           */
          token[SESSION_ISSUED_AT_CLAIM] = Math.floor(Date.now() / 1000);
        }
        return token;
      },
      session({ session, token }) {
        if (session.user) {
          session.user.id = token.sub as string;
          (session.user as unknown as { role: UserRole }).role = token["role"] as UserRole;
          (session.user as unknown as { language: string }).language = token["language"] as string;
        }
        /**
         * Surfaced on the session ROOT rather than on `session.user`, for two
         * reasons: it describes the session and not the person, and
         * `/api/auth/session` serialises this object verbatim — which is how a
         * split Vercel/Render deployment reads it back in `remote-session.ts`.
         * Hidden inside `user` it would still travel, but it would read as a
         * property of the account, and the next person to widen the user
         * projection would drop it.
         */
        (session as unknown as Record<string, unknown>)[SESSION_ISSUED_AT_CLAIM] =
          token[SESSION_ISSUED_AT_CLAIM];
        return session;
      },
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    trustHost: true,
  };
}

export function createAuth(app: AppName) {
  return NextAuth(buildAuthConfig(app));
}

// Default shared instance kept for backward compat — apps should use createAuth(appName)
export const { handlers, auth, signIn, signOut } = createAuth("customer");
