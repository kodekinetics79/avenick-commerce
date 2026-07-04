"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It replaces
 * the entire document, so it must render its own <html>/<body> and cannot depend
 * on the app's stylesheet being present — styles are inlined. Kept minimal and
 * bilingual so even a total render failure is a graceful screen, never a blank one.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[customer] global error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", background: "#0b0f17", color: "#e8ecf3" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
          <div style={{ maxWidth: "460px" }}>
            <div style={{ width: 56, height: 56, margin: "0 auto 24px", borderRadius: 16, background: "linear-gradient(135deg,#f59e0b,#ea580c)", display: "grid", placeItems: "center", fontSize: 28 }}>⚠️</div>
            <h1 style={{ fontSize: "26px", fontWeight: 700, margin: "0 0 12px" }}>Something went wrong</h1>
            <p style={{ color: "#9aa4b2", lineHeight: 1.6, margin: "0 0 6px" }}>The application hit an unexpected error. Please try again.</p>
            <p style={{ color: "#9aa4b2", lineHeight: 1.6, margin: "0 0 24px" }} dir="rtl">واجه التطبيق خطأً غير متوقع. يُرجى المحاولة مرة أخرى.</p>
            <button
              onClick={reset}
              style={{ height: 44, padding: "0 24px", borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Try again / حاول مجدداً
            </button>
            {error.digest ? <p style={{ fontSize: 11, color: "#6b7482", fontFamily: "monospace", marginTop: 18 }}>ref: {error.digest}</p> : null}
          </div>
        </div>
      </body>
    </html>
  );
}
