"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { RegisterConsumerSchema } from "@avenick/types/schemas";
import { Input, Button } from "@avenick/ui";
import { AuthNotice, FormErrorSlot } from "../auth-shell";
import { identityCopy, type IdentityLocale } from "../identity-copy";

/**
 * The same password rule the accept route enforces, so the message shown before
 * submitting is the one the route would send back. The route re-validates.
 */
const PasswordRule = RegisterConsumerSchema.shape.password;

/**
 * Sibling of ResetForm and deliberately not a shared component.
 *
 * They render the same two inputs and differ in every sentence around them, in
 * the endpoint they post to, and in what a dead token means: a reset can be
 * re-requested by the person holding it, an invitation cannot — only the
 * company admin who sent it can send another. Folding them together would mean
 * a component whose copy, action and recovery path are all props, which is a
 * longer way to write both.
 */
export function AcceptInvitationForm({ locale, token }: { locale: IdentityLocale; token: string }) {
  const t = identityCopy(locale).invitation;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [formError, setFormError] = useState("");
  const [tokenDead, setTokenDead] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setPasswordError("");
    setConfirmError("");
    const rule = PasswordRule.safeParse(password);
    if (!rule.success) {
      // Arabic gets the same RULE stated in Arabic rather than the schema's
      // English message — see the note in ResetForm.
      setPasswordError(locale === "ar" ? t.weak : (rule.error.issues[0]?.message ?? t.weak));
      return;
    }
    if (password !== confirm) {
      setConfirmError(t.mismatch);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/invitation/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data: { success?: boolean; code?: string; error?: string } = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDone(true);
      } else if (data.code === "invalid-token") {
        setTokenDead(true);
      } else {
        setFormError(data.error ?? t.genericError);
      }
    } catch {
      setFormError(t.genericError);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <AuthNotice icon={<CheckCircle2 className="h-4 w-4" />}>{t.done}</AuthNotice>
        <Button asChild size="lg" className="w-full">
          <Link href="/login">{t.signIn}</Link>
        </Button>
      </div>
    );
  }

  if (tokenDead) {
    return (
      <div className="space-y-3">
        <p className="u-body text-danger-ink" role="alert">
          {t.usedToken}
        </p>
        {/* No self-service recovery link: nothing this person can click will
            issue another invitation. Naming the one action that works is more
            use than a button that cannot help them. */}
        <p className="u-meta text-ink-3">{t.askAdmin}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" aria-label={t.formLabel}>
      <Input
        id="invitation-password"
        name="password"
        type="password"
        label={t.password}
        autoComplete="new-password"
        placeholder="••••••••"
        hint={t.passwordHint}
        error={passwordError || undefined}
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (passwordError) setPasswordError("");
        }}
        required
      />
      <Input
        id="invitation-confirm"
        name="confirm"
        type="password"
        label={t.confirm}
        autoComplete="new-password"
        placeholder="••••••••"
        hint={t.confirmHint}
        error={confirmError || undefined}
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          if (confirmError) setConfirmError("");
        }}
        required
      />
      <FormErrorSlot message={formError} />
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        {t.submit}
      </Button>
    </form>
  );
}
