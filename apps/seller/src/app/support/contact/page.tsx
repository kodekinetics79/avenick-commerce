"use client";

import { SellerLayout } from "@/components/layout/seller-layout";
import { MessageSquare, CircleOff } from "lucide-react";

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

        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <CircleOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">Support messaging is unavailable</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Seller-to-admin ticket creation is not connected in this environment. Existing tickets remain visible in
            the support register; this form will be enabled only when submissions are persisted and auditable.
          </p>
        </div>
        <form className="hidden" aria-hidden="true">
          {/* Category + Priority */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-semibold mb-4">Message Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Category</label>
                <select
                  defaultValue="account"
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
                  defaultValue="NORMAL"
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
              placeholder="Brief summary of your issue…"
              required
              className="w-full h-10 px-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Message */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <label className="block text-sm font-medium mb-1.5">Message <span className="text-red-500">*</span></label>
            <textarea
              placeholder="Describe your issue in detail. Include order numbers, product IDs, or any relevant information…"
              required
              rows={6}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <button
            type="submit"
            disabled
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm"
          >
            Support unavailable
          </button>
        </form>
      </div>
    </SellerLayout>
  );
}
