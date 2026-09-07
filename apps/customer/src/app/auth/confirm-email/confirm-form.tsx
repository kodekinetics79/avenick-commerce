"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@avenick/ui";
import { AuthNotice, FormErrorSlot } from "../auth-shell";
import { identityCopy, type IdentityLocale } from "../identity-copy";

type Result = { companyName: string; administratorsNotified: number };

/**
 * A BUTTON, not an automatic confirmation on page load.
 *
 * Corporate mail security scans links before a person ever sees them, and an
 * Aramco-shaped mail gateway is exactly the deployment this flow is built for.
 * A GET that confirmed on render would be tripped by the scanner: the request
 * would advance to "awaiting approval", the administrators would be emailed,
 * and the applicant would arrive at a page telling them the link was already
 * used. One click keeps the mutation behind a real human action.
 */
export function ConfirmEmailForm({ locale, token }: { locale: IdentityLocale; token: string }) {
  const t = identityCopy(locale).confirmEmail;
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [tokenDead, setTokenDead] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register/join/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data: { success?: boolean; code?: string; error?: string; data?: Result } = await res
        .json()
        .catch(() => ({}));
      if (res.ok && data.success && data.data) {
        setResult(data.data);
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

  if (result) {
    // A company with no active administrator gets a different sentence, not a
    // cheerful one with a caveat: nobody is coming, and the applicant needs to
    // go and find a colleague rather than wait on an email that will not arrive.
    const message =
      result.administratorsNotified > 0 ? t.done(result.companyName) : t.doneNoAdmins(result.companyName);
    return (
      <div className="space-y-4">
        <AuthNotice icon={<CheckCircle2 className="h-4 w-4" />}>{message}</AuthNotice>
        <p className="u-meta text-ink-3">{t.whatNext}</p>
      </div>
    );
  }

  if (tokenDead) {
    return (
      <div className="space-y-3">
        <p className="u-body text-danger-ink" role="alert">
          {t.deadToken}
        </p>
        <p className="u-meta text-ink-3">
          <Link href="/b2b/join" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            {t.applyAgain}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FormErrorSlot message={formError} />
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        {t.submit}
      </Button>
      <p className="u-meta text-ink-3">{t.whatNext}</p>
    </form>
  );
}
