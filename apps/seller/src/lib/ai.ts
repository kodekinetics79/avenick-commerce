/**
 * Claude-powered drafting for sellers (RFQ replies + listing copy).
 * Calls the Anthropic Messages API via HTTP (no SDK dependency). Falls back to
 * a sensible template when ANTHROPIC_API_KEY isn't configured, so the feature
 * works in local/demo environments.
 */

type Kind = "rfq" | "listing";

const SYSTEM: Record<Kind, string> = {
  rfq: "You are a professional B2B sales rep for a GCC industrial marketplace seller. Draft a concise, courteous quote reply to a buyer's RFQ. Be specific about availability, lead time, and a clear next step. Keep it under 120 words. No placeholders.",
  listing: "You are an e-commerce copywriter for a GCC industrial marketplace. Write a crisp, benefit-led product listing: a 1-line headline and a 2-3 sentence description with key specs/use-cases. Avoid hype and placeholders.",
};

export async function generateDraft(kind: Kind, context: string): Promise<{ text: string; ai: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY;
  const clean = context.trim().slice(0, 2000);

  if (!key) {
    // Template fallback — still useful, clearly editable.
    const text =
      kind === "rfq"
        ? `Thank you for your enquiry regarding "${clean || "your requested items"}".\n\nWe can fulfil this order — the items are in stock with an estimated lead time of 3–5 business days, delivered across the GCC. Pricing is competitive for the requested volume and we're happy to discuss tiered rates for larger quantities.\n\nShall we proceed with a formal quotation? Reply here and we'll send it within the hour.`
        : `${clean || "Premium product"} — built for the job.\n\nEngineered for reliability and everyday performance, this item meets GCC compliance standards and ships fast from verified stock. Ideal for industrial, facilities, and trade buyers who need dependable supply at scale.`;
    return { text, ai: false };
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
      console.error("[ai] anthropic error", res.status);
      return { text: "Couldn't reach the AI service. Please try again.", ai: false };
    }
    const data = await res.json();
    const text = (data?.content?.[0]?.text as string) ?? "";
    return { text: text.trim(), ai: true };
  } catch (e) {
    console.error("[ai] request failed", e);
    return { text: "Couldn't reach the AI service. Please try again.", ai: false };
  }
}
