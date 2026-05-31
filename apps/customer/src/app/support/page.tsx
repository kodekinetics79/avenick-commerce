"use client";

import { useState } from "react";
import { MessageSquare, Plus, Clock, CheckCircle, AlertCircle, X } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { MOCK_SUPPORT_TICKETS } from "@avenick/database";
import { Button, Input, Textarea } from "@avenick/ui";

const STATUS_CONFIG = {
  OPEN: { label: "Open", color: "bg-blue-100 text-blue-700", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  CLOSED: { label: "Closed", color: "bg-green-100 text-green-700", icon: CheckCircle },
  ESCALATED: { label: "Escalated", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

export default function SupportPage() {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const tickets = MOCK_SUPPORT_TICKETS;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setShowForm(false);
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-green-600" />
            <h1 className="text-2xl font-bold">Support</h1>
          </div>
          <Button variant="primary" size="sm" onClick={() => { setShowForm(true); setSubmitted(false); }}>
            <Plus className="h-4 w-4 mr-1" /> New Ticket
          </Button>
        </div>

        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-700 font-medium">Your ticket has been submitted. We&apos;ll respond within 24 hours.</p>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-2xl border border-border p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Open New Ticket</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <Input placeholder="Brief description of your issue" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Order ID (optional)</label>
                <Input placeholder="e.g. AC-2024-00142" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Details</label>
                <Textarea placeholder="Describe your issue in detail..." rows={4} required />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" className="flex-1">Submit Ticket</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">My Tickets</h2>
          {tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p>No tickets yet. Open one if you need help.</p>
            </div>
          ) : (
            tickets.map((ticket) => {
              const cfg = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.OPEN;
              const Icon = cfg.icon;
              return (
                <div key={ticket.id} className="bg-white rounded-2xl border border-border p-4 hover:border-green-200 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{ticket.id}</span>
                        {ticket.orderId && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            Order: {ticket.orderId}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-sm">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">Opened {ticket.createdAt} · Updated {ticket.lastUpdate}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${cfg.color}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </MainLayout>
  );
}
