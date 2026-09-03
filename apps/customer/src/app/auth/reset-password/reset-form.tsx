"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { RegisterConsumerSchema } from "@avenick/types/schemas";
import { Input, Button } from "@avenick/ui";

/**
 * The client-side check uses registration's own password rule so the message
 * a person sees before submitting is the one the redeem route would send back;
 * the route re-validates regardless.
 */
const PasswordRule = RegisterConsumerSchema.shape.password;

type Portal = "customer" | "seller";

export function ResetForm({ token, sellerSignInUrl }: { token: string; sellerSignInUrl: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenDead, setTokenDead] = useState(false);
  const [portal, setPortal] = useState<Portal | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const rule = PasswordRule.safeParse(password);
    if (!rule.success) {
      setError(rule.error.issues[0]?.message ?? "Choose a stronger password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
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
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (portal) {
    return (
      <div className="space-y-4" role="status">
        <div className="flex items-start gap-2 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <p>Your password has been updated. Sign in with your new password.</p>
        </div>
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
          <p className="text-sm text-muted-foreground text-center">Sign in to the seller portal</p>
        )}
      </div>
    );
  }

  if (tokenDead) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-sm text-danger">This reset link is invalid, has expired, or has already been used.</p>
        <p className="text-sm text-muted-foreground">
          <Link href="/auth/forgot-password" className="text-primary font-medium hover:underline">Request a new reset link</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Choose a new password / كلمة مرور جديدة">
      <div>
        <label htmlFor="reset-password" className="block text-sm font-medium mb-1.5">New password / كلمة المرور الجديدة</label>
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters, an uppercase letter and a number"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="reset-confirm" className="block text-sm font-medium mb-1.5">Confirm password / تأكيد كلمة المرور</label>
        <Input
          id="reset-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" className="w-full" loading={loading}>Update password</Button>
    </form>
  );
}
