"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input, Button } from "@avenick/ui";
import { AuthNotice, FormErrorSlot } from "../auth-shell";
import { identityCopy, type IdentityLocale } from "../identity-copy";

/**
 * Posts to /api/auth/password-reset/request and shows the one sentence that
 * is true whether or not the address has an account. `expiresIn` is handed in
 * by the server page from the real TTL constant, already localised — this
 * component must not carry its own copy of the number or its own translation
 * of it.
 */
export function ForgotForm({ locale, expiresIn }: { locale: IdentityLocale; expiresIn: string }) {
  const t = identityCopy(locale).forgot;
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
        setError(data.error ?? t.genericError);
      }
    } catch {
      setError(t.genericError);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthNotice icon={<CheckCircle2 className="h-4 w-4" />}>
        {t.sent(expiresIn)}
      </AuthNotice>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label={t.formLabel}>
      <Input
        id="forgot-email"
        name="email"
        type="email"
        label={t.email}
        autoComplete="username"
        placeholder={identityCopy(locale).login.emailPlaceholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <FormErrorSlot message={error} />
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        {t.submit}
      </Button>
    </form>
  );
}
