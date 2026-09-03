import Link from "next/link";
import { passwordResetTtlLabel } from "@/lib/password-reset";
import { AuthShell } from "../auth-shell";
import { ForgotForm } from "./forgot-form";

/**
 * Public. Hosts password reset for every non-admin account, including seller
 * portal users — the seller portal links here. The page is a server component
 * so the expiry the form promises is read from the same constant the token
 * verifier enforces; the form itself never imports the (node:crypto) module.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Password reset"
      title="Forgot your password?"
      subtitle="Enter your email and we will send you a link to choose a new one."
      // The TTL is read from the constant the verifier enforces, so this line is
      // a fact about the system rather than a reassuring guess.
      note={`A reset link is valid for ${passwordResetTtlLabel()} from the moment it is requested.`}
      footer={
        <p className="u-meta text-ink-3">
          Remembered it?{" "}
          <Link href="/login" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <ForgotForm expiresIn={passwordResetTtlLabel()} />
    </AuthShell>
  );
}
