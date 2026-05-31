"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Input, Button } from "@avenick/ui";

export default function SellerLoginPage() {
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
        window.location.assign("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="dark relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 bg-grid mask-fade-b opacity-40" />
      <div className="absolute -top-20 start-1/3 h-96 w-96 rounded-full bg-primary/25 blur-[120px]" />
      <div className="absolute bottom-0 end-1/3 h-80 w-80 rounded-full bg-accent/20 blur-[120px]" />

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 text-white font-black text-lg shadow-glow mb-4">A</span>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Seller Central</h1>
          <p className="text-sm text-muted-foreground mt-1">Avenick Commerce — Modern Trade OS</p>
        </div>
        <div className="glass-strong rounded-2xl p-6 shadow-elevated">
          <form onSubmit={handleLogin} className="space-y-3.5">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-4">seller@avenick.test · Password123!</p>
        </div>
        <p className="text-center text-[11px] text-muted-foreground/70 mt-6">B2B-first. B2C-ready. Built for modern trade.</p>
      </div>
    </div>
  );
}
