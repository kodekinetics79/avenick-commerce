"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithCredentials } from "@avenick/auth/client";
import { messageForSignInError as messageForError } from "@avenick/auth/sign-in-messages";
import { useSearchParams } from "next/navigation";
import { Input, Button } from "@avenick/ui";
import { portalUrl } from "@avenick/utils/portal-config";

/**
 * Password reset lives on the customer site (the only portal with a mailer).
 * The link is rendered only when that portal's origin is configured for this
 * environment; a guessed host would send a seller to a page that is not there.
 */
const FORGOT_PASSWORD_URL = portalUrl("customer", "/auth/forgot-password");

export default function SellerLoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("code") ?? searchParams.get("error");
  const justRegistered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(messageForError(urlError));

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signInWithCredentials(email, password, "/");
      if (!res.ok) {
        setError(messageForError(res.code ?? res.error));
        setLoading(false);
      } else {
        window.location.assign("/");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="dark relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 bg-grid mask-fade-b opacity-40" />
      <div className="absolute -top-20 start-1/3 h-96 w-96 rounded-full bg-primary/25 blur-[120px]" />
      <div className="absolute bottom-0 end-1/3 h-80 w-80 rounded-full bg-accent/20 blur-[120px]" />

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 text-white font-black text-lg shadow-glow mb-4">A</span>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Seller Central</h1>
          <p className="text-sm text-muted-foreground mt-1">Avenick Commerce — Modern Trade OS</p>
        </div>
        <div className="glass-strong rounded-2xl p-6 shadow-elevated">
          {/* The register route answers the same way for a new and an already
              registered address, so this sentence has to be true for both. */}
          {justRegistered && (
            <p className="mb-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success" role="status">
              Application received. Sign in with that email address to follow its review — if it was already
              registered, use your existing password.
            </p>
          )}
          <form onSubmit={handleLogin} className="space-y-3.5" aria-label="Sign in">
            {/* Placeholders are not accessible names: they vanish on input and
                are not exposed as labels by every assistive technology. */}
            <label htmlFor="login-email" className="sr-only">Email</label>
            <Input id="login-email" name="email" type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="login-password" className="sr-only">Password</label>
            <Input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-danger text-sm" role="alert">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              New here?{" "}
              <Link href="/register" className="text-primary hover:underline">Apply to sell</Link>
            </span>
            {FORGOT_PASSWORD_URL && (
              <a href={FORGOT_PASSWORD_URL} className="text-primary hover:underline">Forgot password?</a>
            )}
          </div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground/70 mt-6">B2B-first. B2C-ready. Built for modern trade.</p>
      </div>
    </div>
  );
}
