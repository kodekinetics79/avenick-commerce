"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { signInWithCredentials } from "@avenick/auth/client";
import { safeReturnTo } from "@avenick/auth/safe-redirect";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Boxes, Eye, EyeOff, FileCheck2, Landmark, ScrollText } from "lucide-react";
import { Button, Divider, Input, PortalAccessShell, Surface } from "@avenick/ui";
import { platformName, portalUrl } from "@avenick/utils/portal-config";

/** Password recovery is owned by the customer portal's mail-enabled flow. */
const FORGOT_PASSWORD_URL = portalUrl("customer", "/auth/forgot-password");

export default function SellerLoginPage() {
  const t = useTranslations("sellerShell.login");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const searchParams = useSearchParams();
  const urlError = searchParams.get("code") ?? searchParams.get("error");
  const justRegistered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const authMessage = (code: string | null | undefined) =>
    !code ? "" : code === "rate_limited" ? t("rateLimited") : t("invalidCredentials");
  const [error, setError] = useState(authMessage(urlError));
  const brand = platformName();

  function changeLocale(nextLocale: "ar" | "en") {
    if (nextLocale === locale) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `AVENICK_LOCALE=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    window.location.reload();
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    const nextErrors = {
      ...(!trimmedEmail
        ? { email: t("emailRequired") }
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
          ? { email: t("emailInvalid") }
          : {}),
      ...(!password ? { password: t("passwordRequired") } : {}),
    };
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      (nextErrors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setLoading(true);
    setError("");
    const callbackUrl = safeReturnTo(searchParams.get("callbackUrl"), "/");
    try {
      const result = await signInWithCredentials(trimmedEmail, password, callbackUrl);
      if (!result.ok) {
        setError(authMessage(result.code ?? result.error));
        setPassword("");
        setLoading(false);
        passwordRef.current?.focus();
      } else {
        window.location.assign(callbackUrl);
      }
    } catch {
      setError(t("unexpectedError"));
      setLoading(false);
    }
  }

  const capabilities = [
    {
      icon: <Boxes className="h-4 w-4" />,
      title: t("capabilities.catalogue.title"),
      body: t("capabilities.catalogue.body"),
    },
    {
      icon: <ScrollText className="h-4 w-4" />,
      title: t("capabilities.quotes.title"),
      body: t("capabilities.quotes.body"),
    },
    {
      icon: <FileCheck2 className="h-4 w-4" />,
      title: t("capabilities.orders.title"),
      body: t("capabilities.orders.body"),
    },
    {
      icon: <Landmark className="h-4 w-4" />,
      title: t("capabilities.settlements.title"),
      body: t("capabilities.settlements.body"),
    },
  ];

  return (
    <PortalAccessShell
      brand={brand}
      portalName={t("portalName", { brand })}
      title={t("workspaceTitle")}
      description={t("workspaceBody")}
      capabilities={capabilities}
      accessTitle={t("accessTitle")}
      accessDescription={t("accessBody")}
      provenance={t("reviewDateline")}
      utility={
        <div
          className="flex items-center rounded-nested border border-border bg-surface-2 p-1 shadow-elev-1"
          aria-label={t("languageLabel")}
        >
          {(["en", "ar"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeLocale(option)}
              aria-pressed={locale === option}
              className={`u-focus min-h-10 cursor-pointer rounded-nested px-3 text-meta font-semibold transition-colors ${
                locale === option
                  ? "bg-ink-1 text-ink-inv"
                  : "text-ink-2 hover:bg-surface-1 hover:text-ink-1"
              }`}
            >
              {option === "en" ? "EN" : "العربية"}
            </button>
          ))}
        </div>
      }
    >
      {justRegistered && (
        <Surface rung={1} tone="success" role="status" className="mb-4 p-3">
          <p className="u-ui font-semibold text-ink-1">{t("registered.title")}</p>
          <p className="u-meta mt-0.5 text-ink-2">{t("registered.body")}</p>
        </Surface>
      )}

      <form onSubmit={handleLogin} className="space-y-4" aria-label={t("formLabel")} noValidate>
        <Input
          ref={emailRef}
          id="login-email"
          label={t("email")}
          name="email"
          type="email"
          inputMode="email"
          dir="ltr"
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
          label={t("password")}
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
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
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
          <p className="u-meta text-danger-ink" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full bg-ink-1 text-ink-inv [--key-edge:var(--ink-edge)] hover:bg-ink-1/90 active:bg-ink-1/90"
          loading={loading}
        >
          {t("submit")}
        </Button>
      </form>

      <Divider className="my-5" />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="u-meta text-ink-2">
          {t("newHere")}{" "}
          <Link
            href="/register"
            className="u-focus inline-flex min-h-10 items-center rounded-nested font-medium text-primary-ink hover:underline"
          >
            {t("apply")}
          </Link>
        </span>
        {FORGOT_PASSWORD_URL && (
          <a
            href={FORGOT_PASSWORD_URL}
            className="u-focus u-meta inline-flex min-h-10 items-center rounded-nested font-medium text-primary-ink hover:underline"
          >
            {t("forgotPassword")}
          </a>
        )}
      </div>
    </PortalAccessShell>
  );
}
