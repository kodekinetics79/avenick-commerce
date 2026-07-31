"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input, Button } from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { safeCallbackPath } from "@/lib/safe-callback-url";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const callbackUrl = safeCallbackPath(searchParams.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(urlError ? "Invalid email or password. / بيانات الدخول غير صحيحة." : "");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Invalid email or password. / بيانات الدخول غير صحيحة.");
        setLoading(false);
      } else {
        window.location.assign(callbackUrl);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <MainLayout>
      <div className="relative min-h-[78vh] flex items-center justify-center overflow-hidden px-4 py-16">
        <div className="absolute inset-0 bg-grid mask-fade-b opacity-50" />
        <div className="absolute -top-10 start-1/3 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute bottom-0 end-1/3 h-72 w-72 rounded-full bg-accent/15 blur-[120px]" />

        <div className="relative w-full max-w-sm animate-fade-up">
          <div className="text-center mb-8">
            <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 text-white font-black text-lg shadow-glow mb-4">A</span>
            <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm mt-1">B2B-first. B2C-ready. Built for modern trade.</p>
          </div>
          <div className="glass-strong rounded-2xl p-6 shadow-elevated">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium mb-1.5">Email / البريد الإلكتروني</label>
                <Input id="login-email" name="email" autoComplete="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-sm font-medium mb-1.5">Password / كلمة المرور</label>
                <Input id="login-password" name="password" autoComplete="current-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <p>Don&apos;t have an account? <Link href="/register" className="text-primary font-medium hover:underline">Register</Link></p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
