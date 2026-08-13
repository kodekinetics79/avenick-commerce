"use client";

export type CredentialsSignInResult = {
  ok: boolean;
  error?: string;
};

/**
 * Authenticate against the portal's current origin.
 *
 * next-auth/react derives its browser API origin from NEXTAUTH_URL. In the split Vercel/Render
 * topology that value is the production alias, which would send preview credentials and cookies
 * to a different host. Relative requests keep the CSRF and session cookies on the exact portal
 * deployment while its /api rewrite continues to use the governed backend.
 */
export async function signInWithCredentials(
  email: string,
  password: string,
  callbackUrl = "/",
): Promise<CredentialsSignInResult> {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!csrfResponse.ok) throw new Error("Unable to initialize sign-in");

  const csrf = (await csrfResponse.json()) as { csrfToken?: string };
  if (!csrf.csrfToken) throw new Error("Unable to initialize sign-in");

  const response = await fetch("/api/auth/callback/credentials", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, callbackUrl }),
  });

  const data = (await response.json()) as { url?: string };
  const resultUrl = new URL(data.url ?? callbackUrl, "http://portal.local");
  const error = resultUrl.searchParams.get("error") ?? undefined;

  return { ok: response.ok && !error, error };
}
