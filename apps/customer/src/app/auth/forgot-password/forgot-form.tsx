"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input, Button } from "@avenick/ui";
import { AuthNotice, FormErrorSlot } from "../auth-shell";

/**
 * Posts to /api/auth/password-reset/request and shows the one sentence that
 * is true whether or not the address has an account. `expiresIn` is handed in
 * by the server page from the real TTL constant — this component must not
 * carry its own copy of the number.
 */
export function ForgotForm({ expiresIn }: { expiresIn: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data: { success?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDone(true);
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthNotice icon={<CheckCircle2 className="h-4 w-4" />}>
        If an account exists for that address, we have sent a reset link. It expires in {expiresIn}.
      </AuthNotice>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Request a password reset / إعادة تعيين كلمة المرور">
      <Input
        id="forgot-email"
        name="email"
        type="email"
        label="Email / البريد الإلكتروني"
        autoComplete="username"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <FormErrorSlot message={error} />
      <Button type="submit" className="w-full" loading={loading}>
        Send reset link
      </Button>
    </form>
  );
}
