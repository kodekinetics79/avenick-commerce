/**
 * Minimal Resend integration via the HTTP API (no SDK dependency).
 * No-ops gracefully when RESEND_API_KEY isn't configured so local/demo
 * environments keep working.
 */
export async function sendInviteEmail(opts: {
  to: string;
  companyName: string;
  inviterName: string;
  role: string;
}): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "Avenick Commerce <noreply@avenick.com>";
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:13100";
  const acceptUrl = `${appUrl}/register?email=${encodeURIComponent(opts.to)}`;

  if (!key) {
    console.log(`[email] RESEND_API_KEY not set — skipping invite email to ${opts.to}`);
    return { sent: false };
  }

  const roleLabel = opts.role.replace("COMPANY_", "").toLowerCase();
  const html = `
  <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0a0a0b">
    <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:24px">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;font-weight:900;text-align:center;line-height:32px">A</div>
      <strong style="font-size:18px">avenick</strong>
    </div>
    <h1 style="font-size:22px;margin:0 0 8px">You've been invited to ${opts.companyName}</h1>
    <p style="color:#52525b;font-size:14px;line-height:1.6">
      ${opts.inviterName} has invited you to join <strong>${opts.companyName}</strong> on Avenick Commerce
      as a <strong>${roleLabel}</strong>. Set your password to start purchasing on behalf of your company.
    </p>
    <a href="${acceptUrl}" style="display:inline-block;margin:20px 0;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px">Accept invitation</a>
    <p style="color:#a1a1aa;font-size:12px">If you weren't expecting this, you can ignore this email.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: `You're invited to ${opts.companyName} on Avenick Commerce`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend send failed:", res.status, await res.text().catch(() => ""));
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email] Resend request error:", e);
    return { sent: false };
  }
}
