import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { log } from "@avenick/observability";
import { portalUrl } from "@avenick/utils/portal-config";
import { MainLayout } from "@/components/layout/main-layout";
import { passwordResetTtlLabel, verifyPasswordResetToken } from "@/lib/password-reset";
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
export default function ResetPasswordPage({ searchParams }: { searchParams?: { token?: string | string[] } }) {
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
    <MainLayout>
      <div className="relative min-h-[78vh] flex items-center justify-center overflow-hidden px-4 py-16">
        <div className="absolute inset-0 bg-grid mask-fade-b opacity-50" />
        <div className="absolute -top-10 start-1/3 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute bottom-0 end-1/3 h-72 w-72 rounded-full bg-accent/15 blur-[120px]" />

        <div className="relative w-full max-w-sm animate-fade-up">
          <div className="text-center mb-8">
            <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 text-white font-black text-lg shadow-glow mb-4">A</span>
            <h1 className="text-2xl font-extrabold tracking-tight">Choose a new password</h1>
            <p className="text-muted-foreground text-sm mt-1">Reset links expire {passwordResetTtlLabel()} after they are requested.</p>
          </div>
          <div className="glass-strong rounded-2xl p-6 shadow-elevated">
            {!token && (
              <Unusable>
                This page needs the link from your reset email — the reset code is missing from the address.
              </Unusable>
            )}
            {token && preflight && !preflight.ok && preflight.reason === "no-secret" && (
              <p className="text-sm text-muted-foreground" role="alert">
                Password reset is not available from this environment.
              </p>
            )}
            {token && preflight && !preflight.ok && preflight.reason !== "no-secret" && (
              <Unusable>This reset link is invalid or has expired.</Unusable>
            )}
            {token && preflight?.ok && <ResetForm token={token} sellerSignInUrl={sellerSignInUrl} />}
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <p>Back to <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link></p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

/** A dead link is told so plainly, with the one action that fixes it. */
function Unusable({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3" role="alert">
      <div className="flex items-start gap-2 rounded-xl bg-danger/10 border border-danger/30 p-4 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-danger" />
        <p>{children}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        <Link href="/auth/forgot-password" className="text-primary font-medium hover:underline">Request a new reset link</Link>
      </p>
    </div>
  );
}
