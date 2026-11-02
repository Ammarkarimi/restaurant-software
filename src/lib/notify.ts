// Sends owner alerts and daily reports on WhatsApp (Meta WhatsApp Cloud API) and email (Resend).
// The software provider sets these once for all restaurants:
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID       — from Meta Business (WhatsApp → API setup)
//   WHATSAPP_ALERT_TEMPLATE  (default owner_alert)  — approved template: "Alert from {{1}}: {{2}}"
//   WHATSAPP_REPORT_TEMPLATE (default daily_report) — approved template: "Daily report for {{1}}, {{2}}: {{3}}"
//   WHATSAPP_TEMPLATE_LANG   (default en)
// Business-started WhatsApp messages must use approved templates; set WHATSAPP_USE_TEMPLATES=false
// only while testing with a number that has messaged the business in the last 24 hours.
import { escapeHtml, sendEmail } from "./mail";

export function whatsappReady() {
  return Boolean(process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
}

export function emailReady() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** "98765 43210" → "919876543210" (WhatsApp wants the country code and digits only). */
export function waNumber(phone: string): string | null {
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

/** Template values may not hold new lines, tabs or long runs of spaces. */
function oneLine(text: string, max = 900) {
  const t = text.replace(/[\r\n\t]+/g, " · ").replace(/ {2,}/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

async function postWhatsapp(body: object) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`WhatsApp said: ${err?.error?.message || `error ${res.status}`}`);
  }
}

/** Sends a WhatsApp message: the approved template with `params`, or plain `text` when templates are off. */
export async function sendWhatsapp(phone: string, kind: "alert" | "report", params: string[], text: string) {
  const to = waNumber(phone);
  if (!to) throw new Error("The WhatsApp number is not valid");
  if (process.env.WHATSAPP_USE_TEMPLATES === "false") {
    return postWhatsapp({ messaging_product: "whatsapp", to, type: "text", text: { body: text.slice(0, 4000), preview_url: false } });
  }
  const name = kind === "alert" ? process.env.WHATSAPP_ALERT_TEMPLATE || "owner_alert" : process.env.WHATSAPP_REPORT_TEMPLATE || "daily_report";
  return postWhatsapp({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
      components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: oneLine(p) || "-" })) }],
    },
  });
}

export interface Notice {
  phone: string | null;
  email: string | null;
  kind: "alert" | "report";
  /** Values for the WhatsApp template. */
  params: string[];
  subject: string;
  /** Full text: WhatsApp (without templates) and the plain email. */
  text: string;
  html?: string;
}

/** Sends on every channel that is set up. Never throws; returns where it went, e.g. "whatsapp,email". */
export async function deliver(n: Notice): Promise<string | null> {
  const sent: string[] = [];
  if (n.phone && whatsappReady()) {
    try {
      await sendWhatsapp(n.phone, n.kind, n.params, n.text);
      sent.push("whatsapp");
    } catch (e) {
      console.error("WhatsApp send failed", (e as Error).message);
    }
  }
  if (n.email && emailReady()) {
    try {
      await sendEmail({ to: n.email, subject: n.subject, text: n.text, html: n.html ?? `<pre style="font-family:Arial,Helvetica,sans-serif;font-size:15px;white-space:pre-wrap">${escapeHtml(n.text)}</pre>` });
      sent.push("email");
    } catch (e) {
      console.error("Email send failed", (e as Error).message);
    }
  }
  return sent.length ? sent.join(",") : null;
}

/** A wa.me link that opens WhatsApp with the text ready to send (works without any set-up). */
export function waLink(phone: string | null, text: string) {
  const to = phone ? waNumber(phone) : null;
  return `https://wa.me/${to ?? ""}?text=${encodeURIComponent(text)}`;
}
