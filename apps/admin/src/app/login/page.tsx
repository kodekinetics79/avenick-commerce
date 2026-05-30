"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Input, Button } from "@manzil/ui";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(urlError ? "Invalid email or password." : "");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Invalid email or password.");
        setLoading(false);
      } else {
        // Hard navigation guarantees the fresh session cookie is sent to /dashboard
        window.location.assign("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Admin Console</h1>
          <p className="text-slate-400">Avenick Commerce — Platform Operations</p>
        </div>
        <div className="bg-slate-800 rounded-2xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <Input type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400" />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400" />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" loading={loading}>Sign In</Button>
          </form>
          <p className="text-center text-xs text-slate-500 mt-4">admin@manzil.test / Password123!</p>
        </div>
      </div>
    </div>
  );
}
