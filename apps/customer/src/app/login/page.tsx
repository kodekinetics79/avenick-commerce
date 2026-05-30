"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input, Button } from "@manzil/ui";
import { MainLayout } from "@/components/layout/main-layout";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/account/orders";
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
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-orange-600 mb-1">Welcome to Avenick Commerce</h1>
            <p className="text-muted-foreground text-sm">B2B-first. B2C-ready. Built for modern trade.</p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email / البريد الإلكتروني</label>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password / كلمة المرور</label>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" loading={loading}>Sign In</Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <p>Don&apos;t have an account? <Link href="/register" className="text-orange-600 hover:underline">Register</Link></p>
              <p className="mt-1 text-xs">Test: buyer@manzil.test / Password123!</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
