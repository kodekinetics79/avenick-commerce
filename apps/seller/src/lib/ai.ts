/**
 * Claude-powered drafting for sellers (RFQ replies + listing copy).
 * Calls the Anthropic Messages API via HTTP (no SDK dependency). Falls back to
 * an explicit unavailable response when ANTHROPIC_API_KEY isn't configured.
 * Commercial availability, lead time, compliance, and stock must never be
 * invented by a drafting fallback.
 */
import { log } from "@avenick/observability";

type Kind = "rfq" | "listing";

const SYSTEM: Record<Kind, string> = {
  rfq: "You are a professional B2B sales rep for a GCC industrial marketplace seller. Draft a concise, courteous quote reply to a buyer's RFQ. Be specific about availability, lead time, and a clear next step. Keep it under 120 words. No placeholders.",
  listing: "You are an e-commerce copywriter for a GCC industrial marketplace. Write a crisp, benefit-led product listing: a 1-line headline and a 2-3 sentence description with key specs/use-cases. Avoid hype and placeholders.",
};

export async function generateDraft(kind: Kind, context: string): Promise<{ text: string; ai: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY;
  const clean = context.trim().slice(0, 2000);

  if (!key) {
    return { text: "AI drafting is not configured in this environment.", ai: false };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM[kind],
        messages: [{ role: "user", content: clean || "Draft a helpful message." }],
      }),
    });
    if (!res.ok) {
      log.error("ai draft failed", undefined, { provider: "anthropic", status: res.status, kind });
      return { text: "Couldn't reach the AI service. Please try again.", ai: false };
    }
    const data = await res.json();
    const text = (data?.content?.[0]?.text as string) ?? "";
    return { text: text.trim(), ai: true };
  } catch (e) {
    log.error("ai request failed", e, { provider: "anthropic", kind });
    return { text: "Couldn't reach the AI service. Please try again.", ai: false };
  }
}
