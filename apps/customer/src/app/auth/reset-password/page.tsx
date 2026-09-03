import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { log } from "@avenick/observability";
import { portalUrl } from "@avenick/utils/portal-config";
import { AuthNotice, AuthShell } from "../auth-shell";
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
    <AuthShell
      eyebrow="Password reset"
      title="Choose a new password"
      subtitle="Pick something you have not used on this account before."
      note={`Reset links expire ${passwordResetTtlLabel()} after they are requested.`}
      footer={
        <p className="u-meta text-ink-3">
          Back to{" "}
          <Link href="/login" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      {!token && (
        <Unusable>
          This page needs the link from your reset email — the reset code is missing from the address.
        </Unusable>
      )}
      {token && preflight && !preflight.ok && preflight.reason === "no-secret" && (
        <p className="u-ui text-ink-2" role="alert">
          Password reset is not available from this environment.
        </p>
      )}
      {token && preflight && !preflight.ok && preflight.reason !== "no-secret" && (
        <Unusable>This reset link is invalid or has expired.</Unusable>
      )}
      {token && preflight?.ok && <ResetForm token={token} sellerSignInUrl={sellerSignInUrl} />}
    </AuthShell>
  );
}

/** A dead link is told so plainly, with the one action that fixes it. */
function Unusable({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <AuthNotice tone="danger" icon={<AlertCircle className="h-4 w-4" />}>
        {children}
      </AuthNotice>
      <p className="u-meta text-ink-3">
        <Link
          href="/auth/forgot-password"
          className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
        >
          Request a new reset link
        </Link>
      </p>
    </div>
  );
}
