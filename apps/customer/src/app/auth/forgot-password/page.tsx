import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { passwordResetTtlLabel } from "@/lib/password-reset";
import { ForgotForm } from "./forgot-form";

/**
 * Public. Hosts password reset for every non-admin account, including seller
 * portal users — the seller portal links here. The page is a server component
 * so the expiry the form promises is read from the same constant the token
 * verifier enforces; the form itself never imports the (node:crypto) module.
 */
export default function ForgotPasswordPage() {
  return (
    <MainLayout>
      <div className="relative min-h-[78vh] flex items-center justify-center overflow-hidden px-4 py-16">
        <div className="absolute inset-0 bg-grid mask-fade-b opacity-50" />
        <div className="absolute -top-10 start-1/3 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute bottom-0 end-1/3 h-72 w-72 rounded-full bg-accent/15 blur-[120px]" />

        <div className="relative w-full max-w-sm animate-fade-up">
          <div className="text-center mb-8">
            <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 text-white font-black text-lg shadow-glow mb-4">A</span>
            <h1 className="text-2xl font-extrabold tracking-tight">Forgot your password?</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your email and we will send you a link to choose a new one.</p>
          </div>
          <div className="glass-strong rounded-2xl p-6 shadow-elevated">
            <ForgotForm expiresIn={passwordResetTtlLabel()} />
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <p>Remembered it? <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link></p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
