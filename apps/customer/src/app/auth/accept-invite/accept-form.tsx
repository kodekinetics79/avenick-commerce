"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { RegisterBusinessSchema } from "@avenick/types/schemas";
import { Button, Field, Input, Surface } from "@avenick/ui";
import { AuthNotice, FormErrorSlot } from "../auth-shell";
import { identityCopy, type IdentityLocale } from "../identity-copy";
import { INVITE_REDEEM_ENDPOINT, type InviteRedeemResponse } from "./contract";

/**
 * The password rule, taken from the schema the SERVER validates against rather
 * than copied.
 *
 * `@avenick/types/schemas`, not the `@avenick/types` barrel: the barrel drags
 * Prisma into the client bundle, which is the trap this repo has hit twice.
 *
 * RegisterBusinessSchema is the right schema and RegisterConsumerSchema is not,
 * even though the two rules are identical today. Everyone who reaches this form
 * is joining a COMPANY account, and if business registration ever tightens its
 * rule this form must tighten with it — a person invited to a company must
 * never be able to set a password the company's own registration would refuse.
 */
const PasswordRule = RegisterBusinessSchema.shape.password;

/**
 * Choose a first password and become an active member.
 *
 * THE RULE IS SHOWN BEFORE THE BOXES. Not as a hint under a field that a person
 * reads after being rejected — as three lines, above, in the order the schema
 * checks them. The old invitation flow's whole failure mode was telling people
 * things too late; a password rule discovered by failing it is a smaller version
 * of the same discourtesy.
 *
 * THE CLIENT MIRRORS THE RULE, IT IS NEVER THE RULE. This validation exists to
 * save a round trip. The redeem endpoint re-parses the password against the same
 * schema, re-reads the account, re-checks the membership and settles the race
 * with a compare-and-set; nothing here is trusted by it.
 *
 * Each control is a <Field> with its FUNCTION child, so the hint/error line is
 * genuinely wired to the input by aria-describedby and a rejected password is
 * announced with its reason rather than as a bare "invalid". The line's height
 * is reserved whether or not it carries an error, so a failed check never pushes
 * the submit button out from under the pointer.
 */
export function AcceptForm({
  locale,
  token,
  companyName,
}: {
  locale: IdentityLocale;
  token: string;
  companyName: string;
}) {
  const t = identityCopy(locale).invite;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [formError, setFormError] = useState("");
  const [tokenDead, setTokenDead] = useState(false);
  const [joined, setJoined] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setPasswordError("");
    setConfirmError("");

    const rule = PasswordRule.safeParse(password);
    if (!rule.success) {
      // English reads the schema's own message, so what is shown before
      // submitting is exactly what the endpoint would send back. Arabic cannot:
      // that message is an English string, and an English sentence inside an
      // Arabic form is the half-translated tell this track exists to remove. So
      // Arabic gets the same RULE, in Arabic. The endpoint re-validates either
      // way; this branch has never been the gate.
      setPasswordError(locale === "ar" ? t.weak : (rule.error.issues[0]?.message ?? t.weak));
      return;
    }
    if (password !== confirm) {
      setConfirmError(t.mismatch);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(INVITE_REDEEM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data: InviteRedeemResponse = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setJoined(true);
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

  if (joined) {
    return (
      <div className="space-y-4">
        <AuthNotice icon={<CheckCircle2 className="h-4 w-4" />}>{t.done(companyName)}</AuthNotice>
        {/* Signed in, they belong in the buyer workspace, not in /account/orders.
            /login validates this parameter with safeReturnTo before using it. */}
        <Button asChild size="lg" className="w-full">
          <Link href="/login?callbackUrl=%2Fb2b">{t.signIn}</Link>
        </Button>
      </div>
    );
  }

  if (tokenDead) {
    // The link died between the page render and the submit — used in another
    // tab, expired on the boundary, or the administrator withdrew it. Same one
    // sentence as every other dead end, for the same reason.
    return (
      <div className="space-y-3">
        <p className="u-body text-danger-ink" role="alert">
          {t.usedToken}
        </p>
        <p className="u-meta text-ink-3">{t.askAgain}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label={t.formLabel}>
      <Surface rung={1} className="p-4">
        <p className="u-ui font-medium text-ink-1">{t.rulesTitle}</p>
        {/* The three checks the schema makes, in the order it makes them. */}
        <ul className="u-meta mt-2 space-y-1 text-ink-2">
          {[t.ruleLength, t.ruleUpper, t.ruleDigit].map((rule) => (
            <li key={rule} className="flex items-start gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-pill bg-current" aria-hidden="true" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </Surface>

      <Field
        id="invite-password"
        label={t.password}
        hint={t.passwordHint}
        error={passwordError || undefined}
        required
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            /* No `error`/`hint`/`label` on the control: <Input> renders its own
               message paragraph with its own id, and passing them here would
               print the sentence twice and mint a second element claiming the
               describedby target. <Field> owns the label and the message; the
               control keeps only the rejected-state border. */
            className={passwordError ? "border-danger-rule" : undefined}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError("");
            }}
            required
          />
        )}
      </Field>

      <Field
        id="invite-confirm"
        label={t.confirm}
        hint={t.confirmHint}
        error={confirmError || undefined}
        required
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className={confirmError ? "border-danger-rule" : undefined}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (confirmError) setConfirmError("");
            }}
            required
          />
        )}
      </Field>

      <FormErrorSlot message={formError} />
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        {t.submit}
      </Button>
    </form>
  );
}
