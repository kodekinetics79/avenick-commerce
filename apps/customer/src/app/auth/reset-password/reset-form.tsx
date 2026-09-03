"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { RegisterConsumerSchema } from "@avenick/types/schemas";
import { Input, Button } from "@avenick/ui";
import { AuthNotice, FormErrorSlot } from "../auth-shell";
import { identityCopy, type IdentityLocale } from "../identity-copy";

/**
 * The client-side check uses registration's own password rule so the message
 * a person sees before submitting is the one the redeem route would send back;
 * the route re-validates regardless.
 */
const PasswordRule = RegisterConsumerSchema.shape.password;

type Portal = "customer" | "seller";

/**
 * Both fields carry a permanent hint line, which is what reserves the space an
 * inline error will later occupy. A validation message therefore appears in
 * place instead of pushing the submit button down the page, and it appears
 * against the field it is about rather than as one anonymous line at the bottom
 * of the form. The validation itself is unchanged: same rule, same order, same
 * request.
 */
export function ResetForm({
  locale,
  token,
  sellerSignInUrl,
}: {
  locale: IdentityLocale;
  token: string;
  sellerSignInUrl: string | null;
}) {
  const t = identityCopy(locale).reset;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [formError, setFormError] = useState("");
  const [tokenDead, setTokenDead] = useState(false);
  const [portal, setPortal] = useState<Portal | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setPasswordError("");
    setConfirmError("");
    const rule = PasswordRule.safeParse(password);
    if (!rule.success) {
      // The English build shows the schema's own message, so what a person reads
      // before submitting is exactly what the redeem route would send back. The
      // Arabic build cannot: that message is an English string, and an English
      // sentence appearing inside an Arabic form is the half-translated tell
      // this round exists to remove. So Arabic gets the same RULE, stated in
      // Arabic — the same fact, not a different one. The route re-validates
      // either way; this branch has never been the gate.
      setPasswordError(locale === "ar" ? t.weak : (rule.error.issues[0]?.message ?? t.weak));
      return;
    }
    if (password !== confirm) {
      setConfirmError(t.mismatch);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data: { success?: boolean; portal?: Portal; code?: string; error?: string } = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPortal(data.portal === "seller" ? "seller" : "customer");
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

  if (portal) {
    return (
      <div className="space-y-4">
        <AuthNotice icon={<CheckCircle2 className="h-4 w-4" />}>{t.done}</AuthNotice>
        {portal === "customer" && (
          <Button asChild size="lg" className="w-full">
            <Link href="/login">{t.signIn}</Link>
          </Button>
        )}
        {portal === "seller" && sellerSignInUrl && (
          <Button asChild size="lg" className="w-full">
            <a href={sellerSignInUrl}>{t.signInSeller}</a>
          </Button>
        )}
        {/* The seller portal's address is not known to this deployment, so
            there is nothing honest to link to; say where to go instead. */}
        {portal === "seller" && !sellerSignInUrl && (
          <p className="u-body text-center text-ink-2">{t.signInSeller}</p>
        )}
      </div>
    );
  }

  if (tokenDead) {
    return (
      <div className="space-y-3">
        <p className="u-body text-danger-ink" role="alert">
          {t.usedToken}
        </p>
        <p className="u-meta text-ink-3">
          <Link
            href="/auth/forgot-password"
            className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
          >
            {t.requestNew}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" aria-label={t.formLabel}>
      <Input
        id="reset-password"
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
        id="reset-confirm"
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
