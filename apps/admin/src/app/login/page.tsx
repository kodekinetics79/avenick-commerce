"use client";

import { useRef, useState, type FormEvent } from "react";
import { signInWithCredentials } from "@avenick/auth/client";
import { messageForSignInError as messageForError } from "@avenick/auth/sign-in-messages";
import { safeReturnTo } from "@avenick/auth/safe-redirect";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, FileSearch2, Landmark, ShieldCheck, Store } from "lucide-react";
import { Button, Input, PortalAccessShell } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("code") ?? searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(messageForError(urlError));
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const brand = platformName();

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    const nextErrors = {
      ...(!trimmedEmail
        ? { email: "Enter your admin email." }
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
          ? { email: "Enter a valid email address." }
          : {}),
      ...(!password ? { password: "Enter your password." } : {}),
    };
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      (nextErrors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setLoading(true);
    setError("");
    const callbackUrl = safeReturnTo(searchParams.get("callbackUrl"), "/dashboard");
    try {
      const result = await signInWithCredentials(trimmedEmail, password, callbackUrl);
      if (!result.ok) {
        setError(messageForError(result.code ?? result.error));
        setPassword("");
        setLoading(false);
        passwordRef.current?.focus();
      } else {
        window.location.assign(callbackUrl);
      }
    } catch {
      setError("Sign-in could not be completed. Check your connection and try again.");
      setLoading(false);
    }
  }

  const capabilities = [
    {
      icon: <Store className="h-4 w-4" />,
      title: "Marketplace oversight",
      body: "Review the operational state of customers, sellers, products, and orders.",
    },
    {
      icon: <ShieldCheck className="h-4 w-4" />,
      title: "Seller review",
      body: "Work through supplier applications and compliance records.",
    },
    {
      icon: <Landmark className="h-4 w-4" />,
      title: "Settlement control",
      body: "Inspect payout, commission, and order exceptions by currency.",
    },
    {
      icon: <FileSearch2 className="h-4 w-4" />,
      title: "Documented actions",
      body: "Keep operational decisions attached to the marketplace record.",
    },
  ];

  return (
    <PortalAccessShell
      brand={brand}
      portalName={`${brand} Admin Console`}
      title="Operate the marketplace from one accountable command surface."
      description="Review suppliers, orders, settlements, risk, and marketplace performance without losing the evidence behind an action."
      capabilities={capabilities}
      accessTitle="Sign in to platform operations"
      accessDescription="Use the administrator account issued by platform operations."
      provenance="Administrator accounts are provisioned by platform operations. Password reset is not available from this screen."
    >
      <form onSubmit={handleLogin} className="space-y-4" aria-label="Admin sign in" noValidate>
        <Input
          ref={emailRef}
          id="login-email"
          label="Admin email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          error={fieldErrors.email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
          }}
          required
        />
        <Input
          ref={passwordRef}
          id="login-password"
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (fieldErrors.password)
              setFieldErrors((current) => ({ ...current, password: undefined }));
          }}
          required
          endIcon={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="u-focus grid h-10 w-10 cursor-pointer place-items-center rounded-nested text-ink-3 hover:bg-ink-1/[0.06] hover:text-ink-1"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          }
        />
        {error && (
          <p className="u-ui text-danger-ink" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full bg-ink-1 text-ink-inv [--key-edge:var(--ink-edge)] hover:bg-ink-1/90 active:bg-ink-1/90"
          loading={loading}
        >
          Sign in
        </Button>
      </form>
    </PortalAccessShell>
  );
}
