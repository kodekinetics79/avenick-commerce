"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { RegisterConsumerSchema } from "@avenick/types/schemas";
import { Input, Button } from "@avenick/ui";
import { AuthNotice, FormErrorSlot } from "../auth-shell";

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
const PASSWORD_HINT = "At least 8 characters, with an uppercase letter and a number.";
const CONFIRM_HINT = "Type the same password again.";

export function ResetForm({ token, sellerSignInUrl }: { token: string; sellerSignInUrl: string | null }) {
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
      setPasswordError(rule.error.issues[0]?.message ?? "Choose a stronger password.");
      return;
    }
    if (password !== confirm) {
      setConfirmError("Passwords do not match.");
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
        setFormError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (portal) {
    return (
      <div className="space-y-4">
        <AuthNotice icon={<CheckCircle2 className="h-4 w-4" />}>
          Your password has been updated. Sign in with your new password.
        </AuthNotice>
        {portal === "customer" && (
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
        {portal === "seller" && sellerSignInUrl && (
          <Button asChild className="w-full">
            <a href={sellerSignInUrl}>Sign in to the seller portal</a>
          </Button>
        )}
        {/* The seller portal's address is not known to this deployment, so
            there is nothing honest to link to; say where to go instead. */}
        {portal === "seller" && !sellerSignInUrl && (
          <p className="u-ui text-center text-ink-2">Sign in to the seller portal</p>
        )}
      </div>
    );
  }

  if (tokenDead) {
    return (
      <div className="space-y-3">
        <p className="u-ui text-danger-ink" role="alert">
          This reset link is invalid, has expired, or has already been used.
        </p>
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

  return (
    <form onSubmit={handleSubmit} className="space-y-3" aria-label="Choose a new password / كلمة مرور جديدة">
      <Input
        id="reset-password"
        name="password"
        type="password"
        label="New password / كلمة المرور الجديدة"
        autoComplete="new-password"
        placeholder="••••••••"
        hint={PASSWORD_HINT}
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
        label="Confirm password / تأكيد كلمة المرور"
        autoComplete="new-password"
        placeholder="••••••••"
        hint={CONFIRM_HINT}
        error={confirmError || undefined}
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          if (confirmError) setConfirmError("");
        }}
        required
      />
      <FormErrorSlot message={formError} />
      <Button type="submit" className="w-full" loading={loading}>
        Update password
      </Button>
    </form>
  );
}
