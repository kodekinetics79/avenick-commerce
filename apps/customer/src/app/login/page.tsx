"use client";

import { useState } from "react";
import { signInWithCredentials } from "@avenick/auth/client";
import { messageForSignInErrorBilingual as messageForError } from "@avenick/auth/sign-in-messages";
import { safeReturnTo } from "@avenick/auth/safe-redirect";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input, Button } from "@avenick/ui";
import { AuthShell, FormErrorSlot } from "../auth/auth-shell";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("code") ?? searchParams.get("error");
  // Validated before use: an unchecked callbackUrl is an open redirect, since a
  // successful login would navigate the visitor to an attacker-chosen origin.
  const callbackUrl = safeReturnTo(searchParams.get("callbackUrl"), "/account/orders");
  // Set by the registration flow, which redirects here with ?registered=1.
  //
  // What this flag may NOT be used to say is "your account has been created".
  // Both registration endpoints deliberately answer identically whether or not
  // the address was already registered — that neutrality is what stops the
  // endpoint being a free membership oracle (see NEUTRAL_OUTCOME in
  // /api/auth/register/consumer/route.ts) — so the browser genuinely does not
  // know which branch ran. The sentence below is the one the server itself
  // chose, because it is the only one true in both.
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
      const res = await signInWithCredentials(email, password, callbackUrl);
      if (!res.ok) {
        setError(messageForError(res.code ?? res.error));
        setLoading(false);
      } else {
        window.location.assign(callbackUrl);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back"
      subtitle={
        justRegistered
          ? "Registration received. Sign in with that email address — if it was already registered, use your existing password."
          : "Sign in to see your orders, returns and support tickets."
      }
      footer={
        <p className="u-meta text-ink-3">
          No account yet?{" "}
          <Link href="/register" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            Register
          </Link>
        </p>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4" aria-label="Sign in / تسجيل الدخول">
        {/* htmlFor/id: the label was visually adjacent but not programmatically
            associated, so it was not announced. <Input label> emits both. */}
        <Input
          id="login-email"
          name="email"
          type="email"
          label="Email / البريد الإلكتروني"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
          <Input
            id="login-password"
            name="password"
            type="password"
            label="Password / كلمة المرور"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="mt-1.5">
            <Link
              href="/auth/forgot-password"
              className="u-focus u-meta rounded-nested font-medium text-primary-ink hover:underline"
            >
              Forgot password?
            </Link>
          </p>
        </div>
        <FormErrorSlot message={error} />
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
