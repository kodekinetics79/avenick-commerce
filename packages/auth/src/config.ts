import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db, UserRole, UserStatus } from "@avenick/database";
import { LoginSchema } from "@avenick/types";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "./rate-limit";

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

          const user = await db.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
              id: true,
              email: true,
              passwordHash: true,
              firstName: true,
              lastName: true,
              role: true,
              status: true,
              language: true,
              avatar: true,
            },
          });

          if (!user || !user.passwordHash) return null;
          if (user.status !== UserStatus.ACTIVE) return null;

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

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
        }
        return token;
      },
      session({ session, token }) {
        if (session.user) {
          session.user.id = token.sub as string;
          (session.user as unknown as { role: UserRole }).role = token["role"] as UserRole;
          (session.user as unknown as { language: string }).language = token["language"] as string;
        }
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
