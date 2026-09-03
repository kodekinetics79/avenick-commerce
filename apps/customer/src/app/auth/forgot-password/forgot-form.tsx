"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input, Button } from "@avenick/ui";

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
      <div className="flex items-start gap-2 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800" role="status">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        <p>If an account exists for that address, we have sent a reset link. It expires in {expiresIn}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Request a password reset / إعادة تعيين كلمة المرور">
      <div>
        <label htmlFor="forgot-email" className="block text-sm font-medium mb-1.5">Email / البريد الإلكتروني</label>
        <Input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" className="w-full" loading={loading}>Send reset link</Button>
    </form>
  );
}
