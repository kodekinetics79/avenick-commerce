"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Building2 } from "lucide-react";
import { Input, Button, Textarea } from "@manzil/ui";
import { MainLayout } from "@/components/layout/main-layout";

type Mode = "select" | "consumer" | "business";

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", companyNameEn: "", companyNameAr: "", crNumber: "", vatNumber: "", industry: "INDUSTRIAL_SUPPLIES", country: "AE", city: "" });

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const endpoint = mode === "consumer" ? "/api/auth/register/consumer" : "/api/auth/register/business";
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (data.success) {
      router.push("/login?registered=1");
    } else {
      setError(data.error ?? "Registration failed");
    }
    setLoading(false);
  }

  return (
    <MainLayout>
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-orange-600 mb-1">إنشاء حساب</h1>
            <p className="text-muted-foreground">Create your Avenick Commerce account</p>
          </div>

          {mode === "select" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => setMode("consumer")} className="bg-white rounded-2xl border-2 border-border hover:border-orange-400 p-6 text-center transition-all group">
                <User className="h-10 w-10 mx-auto mb-3 text-orange-500 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold">Personal Account</h3>
                <p className="text-sm text-muted-foreground mt-1">حساب شخصي</p>
              </button>
              <button onClick={() => setMode("business")} className="bg-white rounded-2xl border-2 border-border hover:border-orange-400 p-6 text-center transition-all group">
                <Building2 className="h-10 w-10 mx-auto mb-3 text-orange-500 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold">Business Account</h3>
                <p className="text-sm text-muted-foreground mt-1">حساب تجاري B2B</p>
              </button>
            </div>
          )}

          {(mode === "consumer" || mode === "business") && (
            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
              <button onClick={() => setMode("select")} className="text-sm text-orange-600 hover:underline mb-4 flex items-center gap-1">← Back</button>
              <h2 className="font-semibold mb-4">{mode === "consumer" ? "Personal Account" : "Business Account"}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="First name" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
                  <Input placeholder="Last name" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
                </div>
                <Input type="email" placeholder="Email address" value={form.email} onChange={(e) => set("email", e.target.value)} required />
                <Input type="password" placeholder="Password (min 8 chars, uppercase + number)" value={form.password} onChange={(e) => set("password", e.target.value)} required />
                <Input type="tel" placeholder="Phone (+971...)" value={form.phone} onChange={(e) => set("phone", e.target.value)} />

                {mode === "business" && (
                  <>
                    <hr className="my-2" />
                    <p className="text-sm font-medium text-muted-foreground">Company Details</p>
                    <Input placeholder="Company name (English)" value={form.companyNameEn} onChange={(e) => set("companyNameEn", e.target.value)} required />
                    <Input placeholder="اسم الشركة بالعربي" value={form.companyNameAr} onChange={(e) => set("companyNameAr", e.target.value)} dir="rtl" />
                    <Input placeholder="Commercial Registration Number" value={form.crNumber} onChange={(e) => set("crNumber", e.target.value)} required />
                    <Input placeholder="VAT Number (optional)" value={form.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                      <select value={form.country} onChange={(e) => set("country", e.target.value)} className="h-10 rounded-xl border border-input px-3 text-sm">
                        <option value="AE">UAE</option><option value="SA">Saudi Arabia</option><option value="QA">Qatar</option>
                        <option value="KW">Kuwait</option><option value="BH">Bahrain</option><option value="OM">Oman</option>
                      </select>
                      <Input placeholder="City" value={form.city} onChange={(e) => set("city", e.target.value)} required />
                    </div>
                  </>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" loading={loading}>Create Account</Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Already have an account? <Link href="/login" className="text-orange-600 hover:underline">Sign in</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
