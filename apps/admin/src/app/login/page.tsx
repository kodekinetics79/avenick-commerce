"use client";

import { useState, type FormEvent } from "react";
import { signInWithCredentials } from "@avenick/auth/client";
import { messageForSignInError as messageForError } from "@avenick/auth/sign-in-messages";
import { useSearchParams } from "next/navigation";
import { Input, Button, Dateline, Divider, Eyebrow, Surface } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";

/**
 * The console's front door, and the first surface anyone sees.
 *
 * Round one left it carrying every gesture the system has since banned by name:
 * an indigo→violet gradient tile with a font-black "A", two blur-[120px] orbs, a
 * `shadow-glow`, a forced `dark` class that overrode the operator's own theme on
 * this one page, and the marketing line "B2B-first. B2C-ready. Built for modern
 * trade." on an internal sign-in screen.
 *
 * What replaces them is the system's own vocabulary: the ambient ruled field the
 * root layout already mounts, one floating rung-4 slab with the four-part light
 * on it, the brass rule as the mark, and the platform name read from
 * configuration rather than written into the page. Nothing here claims anything.
 */
export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("code") ?? searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(messageForError(urlError));

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signInWithCredentials(email, password, "/dashboard");
      if (!res.ok) {
        setError(messageForError(res.code ?? res.error));
        setLoading(false);
      } else {
        window.location.assign("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    // No forced `dark`. The root layout's inline script has already applied the
    // operator's own theme by the time this paints, and overriding it here meant
    // one screen in the console disagreed with every other.
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          {/* The brass rule as the mark. It is the same gesture as the active nav
              item, the empty state's top edge and the commit rule — one gesture
              in different postures is most of what makes a system read as
              designed rather than assembled. */}
          <Divider drawn on className="mb-4 w-12" />
          <Eyebrow>Platform operations</Eyebrow>
          <h1 className="u-h2 mt-1 text-ink-1">{platformName()} admin console</h1>
          <p className="u-body mt-1.5 text-ink-2">Sign in with the account platform operations issued you.</p>
        </div>

        {/* Rung 4, and the only floating surface on the page: it is the one
            object here, and law A says a thing you act on stands off the ground.
            `rim` draws the fresnel shoulder around its perimeter. */}
        <Surface rung={4} rim className="p-5">
          <form onSubmit={handleLogin} className="space-y-3.5" aria-label="Sign in">
            {/* A placeholder is not an accessible name: it vanishes on input and
                is not exposed as a label by every assistive technology. These are
                real labels, and they are visible — a sign-in form is not the
                place to trade legibility for tidiness. */}
            <Input
              id="login-email"
              label="Admin email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="login-password"
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              // A failed sign-in is announced, not just coloured: role="alert"
              // is what makes it reach a screen-reader user who has just pressed
              // a button and heard nothing.
              <p className="u-ui text-danger-ink" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>
        </Surface>

        {/* No reset link on purpose: the public reset flow refuses admin
            accounts, so offering it here would be a control that does nothing. */}
        <Dateline className="mt-4">
          Administrator accounts are provisioned by platform operations. Password reset is not available from this
          screen.
        </Dateline>
      </div>
    </div>
  );
}
