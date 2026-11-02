// Razorpay UPI QR codes: one QR per bill, for the exact amount. When the guest pays, Razorpay tells
// us (webhook) — or the counter screen asks — and the bill closes by itself as a UPI payment.
// Each restaurant uses its own Razorpay account (Settings → UPI & Zomato / Swiggy). Razorpay must
// switch on "QR Codes" (upi_qr) for the account.
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { fail } from "./api";
import { settleOrder } from "./settle";
import { loadOrder, totalsOf } from "./orders";
import type { SettingsRecord } from "./settings";

const API = "https://api.razorpay.com/v1";

function auth(s: Pick<SettingsRecord, "razorpayKeyId" | "razorpayKeySecret">) {
  if (!s.razorpayKeyId || !s.razorpayKeySecret) fail("Razorpay is not connected. Add your keys in Settings → UPI & Zomato / Swiggy.");
  return `Basic ${Buffer.from(`${s.razorpayKeyId}:${s.razorpayKeySecret}`).toString("base64")}`;
}

async function call<T>(s: Pick<SettingsRecord, "razorpayKeyId" | "razorpayKeySecret">, path: string, init: { method?: string; body?: object } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: auth(s), "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    const why = data.error?.description || `error ${res.status}`;
    if (res.status === 401) fail("Razorpay did not accept the keys. Check the Key ID and Key Secret in Settings.", 502);
    fail(`Razorpay said: ${why}`, 502);
  }
  return data;
}

interface RzpQr {
  id: string;
  image_url: string;
  status: string;
  close_by?: number;
}
interface RzpPayment {
  id: string;
  amount: number;
  status: string;
  method?: string;
  vpa?: string;
}

/** A QR for the bill's exact amount (reused while it is still open and the amount is the same). */
export async function createBillQr(settings: SettingsRecord, orderId: string, createdBy: string) {
  const order = await loadOrder(orderId);
  if (order.status === "settled" || order.status === "cancelled") fail("This bill is already closed.");
  const amount = totalsOf(order).total;
  if (amount <= 0) fail("There is nothing to pay on this bill.");
  const open = await prisma.upiRequest.findFirst({ where: { orderId, status: "pending" }, orderBy: { createdAt: "desc" } });
  if (open && Math.abs(open.amount - amount) < 0.01 && Date.now() - open.createdAt.getTime() < 100 * 60_000) return open;
  if (open) await closeQr(settings, open.id, open.qrId);

  const qr = await call<RzpQr>(settings, "/payments/qr_codes", {
    method: "POST",
    body: {
      type: "upi_qr",
      name: settings.restaurantName.slice(0, 40),
      usage: "single_use",
      fixed_amount: true,
      payment_amount: Math.round(amount * 100),
      description: `Order #${order.number}${order.billNumber ? ` Bill ${order.billNumber}` : ""}`.slice(0, 100),
      close_by: Math.floor(Date.now() / 1000) + 2 * 3600 - 60,
      notes: { restaurantId: settings.restaurantId, orderId, orderNumber: String(order.number) },
    },
  });
  return prisma.upiRequest.create({
    data: { restaurantId: settings.restaurantId, orderId, qrId: qr.id, amount, imageUrl: qr.image_url, createdBy },
  });
}

async function closeQr(settings: SettingsRecord, id: string, qrId: string) {
  await prisma.upiRequest.update({ where: { id }, data: { status: "closed" } });
  try {
    await call(settings, `/payments/qr_codes/${qrId}/close`, { method: "POST" });
  } catch {
    // already closed or paid: nothing to do
  }
}

export async function closeBillQrs(settings: SettingsRecord, orderId: string) {
  const open = await prisma.upiRequest.findMany({ where: { orderId, status: "pending" } });
  for (const r of open) await closeQr(settings, r.id, r.qrId);
}

/**
 * The guest paid this QR: close the bill as a UPI payment. Safe to call twice (webhook and the
 * counter screen may both notice) — only the first one closes the bill.
 */
export async function applyQrPayment(qrId: string, payment: { id: string; amount: number }) {
  const req = await prisma.upiRequest.findFirst({ where: { qrId } });
  if (!req || req.status !== "pending") return { applied: false, request: req };
  const claimed = await prisma.upiRequest.updateMany({ where: { id: req.id, status: "pending" }, data: { status: "paid", paymentId: payment.id, paidAt: new Date() } });
  if (claimed.count !== 1) return { applied: false, request: req };
  const amount = payment.amount / 100;
  try {
    await settleOrder({ id: null, name: "UPI (Razorpay)", role: "system" }, req.orderId, [{ method: "upi", amount, reference: payment.id }], { expectTotal: amount });
    return { applied: true, request: { ...req, status: "paid" } };
  } catch (error) {
    // Paid, but the bill changed meanwhile: keep the money visible so the cashier settles by hand.
    await prisma.upiRequest.update({ where: { id: req.id }, data: { status: "received" } });
    console.error("UPI payment could not close the bill", (error as Error).message);
    return { applied: false, request: { ...req, status: "received" } };
  }
}

/** Asks Razorpay whether the QR was paid (for when the webhook is not set up or is slow). */
export async function checkBillQr(settings: SettingsRecord, id: string) {
  const req = await prisma.upiRequest.findFirst({ where: { id } });
  if (!req) fail("QR code not found", 404);
  if (req.status !== "pending") return req;
  const list = await call<{ items: RzpPayment[] }>(settings, `/payments/qr_codes/${req.qrId}/payments`);
  const paid = list.items.find((p) => p.status === "captured" || p.status === "authorized");
  if (paid) await applyQrPayment(req.qrId, paid);
  return prisma.upiRequest.findFirstOrThrow({ where: { id } });
}

/** Razorpay signs each webhook with the restaurant's webhook secret. */
export function validWebhook(rawBody: string, signature: string | null, secret: string | null) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
