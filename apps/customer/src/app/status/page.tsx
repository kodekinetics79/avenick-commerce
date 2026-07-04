"use client";

import { useEffect, useState } from "react";

// Deliberately standalone: no MainLayout, no backend data layer, no shared data
// fetching. A status page must render even when the rest of the app is degraded,
// so it only calls the lightweight public /api/status endpoint and nothing else.

type ComponentStatus = "operational" | "degraded" | "down";

interface StatusComponent {
  name: string;
  status: ComponentStatus;
  detail?: string;
}
interface StatusSummary {
  status: ComponentStatus;
  app: string;
  components: StatusComponent[];
  uptimeSeconds: number;
  timestamp: string;
}

const COLOR: Record<ComponentStatus, string> = {
  operational: "#16a34a",
  degraded: "#d97706",
  down: "#dc2626",
};
const LABEL: Record<ComponentStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
};

export default function StatusPage() {
  const [data, setData] = useState<StatusSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const json = (await res.json()) as StatusSummary;
        if (active) {
          setData(json);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    load();
    const t = setInterval(load, 15_000); // refresh every 15s
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  const overall: ComponentStatus = error ? "down" : (data?.status ?? "operational");

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Avenick — System Status</h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 16,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          marginBottom: 24,
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 999, background: COLOR[overall] }} />
        <strong style={{ fontSize: 18 }}>
          {error ? "Unable to reach status endpoint" : `All systems ${LABEL[overall].toLowerCase()}`}
        </strong>
      </div>

      {data && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          {data.components.map((c, i) => (
            <div
              key={c.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
              }}
            >
              <span style={{ textTransform: "capitalize" }}>{c.name.replace(/-/g, " ")}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, color: COLOR[c.status] }}>
                {c.detail && <small style={{ color: "#9ca3af" }}>{c.detail}</small>}
                <span style={{ width: 8, height: 8, borderRadius: 999, background: COLOR[c.status] }} />
                {LABEL[c.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {data && (
        <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 16 }}>
          Last updated {new Date(data.timestamp).toLocaleTimeString()} · refreshes every 15s
        </p>
      )}
    </div>
  );
}
