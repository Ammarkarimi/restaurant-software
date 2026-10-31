// Emails to the software provider, sent with Resend (https://resend.com) over its HTTP API.
// Nothing is sent until RESEND_API_KEY and ENQUIRY_EMAIL_TO are set.

const FROM = process.env.EMAIL_FROM?.trim() || "RestoOwl <onboarding@resend.dev>";

export function enquiryEmail() {
  const to = process.env.ENQUIRY_EMAIL_TO?.trim() || null;
  return { to, ready: Boolean(to && process.env.RESEND_API_KEY) };
}

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendEmail(message: { to: string; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email is not set up yet: RESEND_API_KEY is missing.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [message.to], subject: message.subject.replace(/\s+/g, " "), html: message.html, text: message.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`The email service said: ${body?.message || `error ${res.status}`}`);
  }
}

interface LeadDetails {
  name: string;
  phone: string;
  restaurantName: string | null;
  city: string | null;
  message: string | null;
  createdAt: Date;
}

/** The "new demo request" email: every detail, plus Call / WhatsApp / owner panel links. */
export function leadEmail(lead: LeadDetails, siteUrl: string) {
  let wa = lead.phone.replace(/\D/g, "");
  if (wa.length === 10) wa = `91${wa}`;
  const when = lead.createdAt.toLocaleString("en-IN", { timeZone: process.env.PLATFORM_TIMEZONE || "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const panel = `${siteUrl}/platform/enquiries`;
  const rows: [string, string | null][] = [
    ["Name", lead.name],
    ["Phone / WhatsApp", lead.phone],
    ["Restaurant", lead.restaurantName],
    ["City", lead.city],
    ["Message", lead.message],
    ["Asked on", when],
  ];
  const subject = `New demo request: ${lead.name}${lead.restaurantName ? ` — ${lead.restaurantName}` : ""}${lead.city ? `, ${lead.city}` : ""}`;
  const button = (href: string, label: string, color: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border-radius:8px;background:${color};color:#fff;font-weight:600;text-decoration:none">${label}</a>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a;max-width:560px">
<h2 style="margin:0 0 4px;color:#ea580c">New demo request</h2>
<p style="margin:0 0 16px;color:#475569">Someone filled in “Ask for a free demo” on your website.</p>
<table cellpadding="6" style="border-collapse:collapse;margin-bottom:16px">
${rows
  .filter(([, v]) => v)
  .map(([k, v]) => `<tr><td style="color:#64748b;vertical-align:top;white-space:nowrap">${k}</td><td style="white-space:pre-line"><b>${escapeHtml(v!)}</b></td></tr>`)
  .join("\n")}
</table>
${button(`tel:${lead.phone.replace(/[^\d+]/g, "")}`, "Call", "#0f172a")}${button(`https://wa.me/${wa}`, "WhatsApp", "#059669")}${button(panel, "Open Enquiries", "#ea580c")}
</div>`;
  const text = `New demo request\n\n${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")}\n\nWhatsApp: https://wa.me/${wa}\nOpen Enquiries: ${panel}\n`;
  return { subject, html, text };
}
