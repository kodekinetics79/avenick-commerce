"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Input, Button } from "@manzil/ui";

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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-500 mb-1">Seller Central</h1>
          <p className="text-gray-400">Avenick Commerce — Modern Trade OS</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>Sign In</Button>
          </form>
          <p className="text-center text-xs text-gray-500 mt-4">Test: seller@manzil.test / Password123!</p>
        </div>
      </div>
    </div>
  );
}
