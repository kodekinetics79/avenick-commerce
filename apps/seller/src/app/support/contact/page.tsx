"use client";

import { useState } from "react";
import { SellerLayout } from "@/components/layout/seller-layout";
import { MessageSquare, Send, CheckCircle } from "lucide-react";

const CATEGORIES = [
  { value: "account", label: "Account Issue" },
  { value: "compliance", label: "Compliance / Documents" },
  { value: "payment", label: "Payment / Payout" },
  { value: "product", label: "Product Listing" },
  { value: "order", label: "Order Issue" },
  { value: "technical", label: "Technical Problem" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low — General inquiry" },
  { value: "NORMAL", label: "Normal — Need help soon" },
  { value: "HIGH", label: "High — Affecting business" },
  { value: "URGENT", label: "Urgent — Critical issue" },
];

export default function ContactAdminPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("account");
  const [priority, setPriority] = useState("NORMAL");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1000);
  }

  if (submitted) {
    return (
      <SellerLayout sellerName="Seller" tier="VERIFIED">
        <div className="max-w-lg mx-auto py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Message Sent!</h1>
          <p className="text-muted-foreground mb-6">
            Your message has been sent to the Avenick admin team. They typically respond within 24 hours.
          </p>
          <button
            type="button"
            onClick={() => { setSubmitted(false); setSubject(""); setMessage(""); }}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Send Another Message
          </button>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout sellerName="Seller" tier="VERIFIED">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Contact Admin</h1>
            <p className="text-sm text-muted-foreground">Send a message to the Avenick support team</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category + Priority */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-semibold mb-4">Message Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <label className="block text-sm font-medium mb-1.5">Subject <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue…"
              required
              className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Message */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <label className="block text-sm font-medium mb-1.5">Message <span className="text-red-500">*</span></label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue in detail. Include order numbers, product IDs, or any relevant information…"
              required
              rows={6}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending…
              </span>
            ) : (
              <><Send className="h-4 w-4" /> Send Message to Admin</>
            )}
          </button>
        </form>
      </div>
    </SellerLayout>
  );
}
