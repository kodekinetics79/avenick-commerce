import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { Skeleton } from "@avenick/ui";
import { AuthShell } from "../auth/auth-shell";
import { identityCopy, LOCALE_COOKIE, toIdentityLocale } from "../auth/identity-copy";
import { LoginForm } from "./login-form";

/**
 * Sign in.
 *
 * The page is a Server Component; only <LoginForm> is an island. Round one made
 * the whole route "use client" to reach useSearchParams, which pulled the shell,
 * the plate and the ledger into the browser bundle for no reason. Law 8: extract
 * a small client island, never promote the page.
 *
 * `?registered=1` is set by the registration flow. What this flag may NOT be
 * used to say is "your account has been created". Both registration endpoints
 * deliberately answer identically whether or not the address was already
 * registered — that neutrality is what stops the endpoint being a free
 * membership oracle (see NEUTRAL_OUTCOME in
 * /api/auth/register/consumer/route.ts) — so the browser genuinely does not know
 * which branch ran. The sentence chosen below is the one true in both.
 *
 * `callbackUrl` is deliberately NOT read here. It is read and validated inside
 * the island, where it is used; see the note on LoginForm.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { registered?: string | string[] };
}) {
  const locale = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = identityCopy(locale).login;
  const justRegistered = searchParams?.registered === "1";

  return (
    <AuthShell
      locale={locale}
      eyebrow={t.eyebrow}
      title={t.title}
      subtitle={justRegistered ? t.subtitleRegistered : t.subtitle}
      footer={
        <p className="u-meta text-ink-3">
          {t.noAccount}{" "}
          <Link href="/register" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            {t.register}
          </Link>
        </p>
      }
    >
      {/* useSearchParams needs a boundary. The fallback occupies the form's own
          box, so the card does not resize under the reader when the island
          hydrates — a shell that changes height on hydration is the cheapest
          possible way to look unfinished. */}
      <Suspense fallback={<SignInSkeleton />}>
        <LoginForm locale={locale} />
      </Suspense>
    </AuthShell>
  );
}

/** Same box as the real form: two fields, a reserved error line, one button. */
function SignInSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-[var(--control-h-md)] w-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-[var(--control-h-md)] w-full" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="min-h-[2.5rem]" />
      <Skeleton className="h-[var(--control-h-lg)] w-full" />
    </div>
  );
}
