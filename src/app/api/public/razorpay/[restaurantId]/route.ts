import { NextRequest, NextResponse } from "next/server";
import { rawPrisma, runForRestaurant } from "@/lib/db";
import { applyQrPayment, validWebhook } from "@/lib/razorpay";

/**
 * Razorpay webhook (event "qr_code.credited"): a guest paid a bill's UPI QR, so the bill closes.
 * Set it up in Razorpay → Settings → Webhooks with this address and the restaurant's webhook secret.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  const raw = await request.text();
  const settings = await rawPrisma.restaurantSettings.findUnique({ where: { restaurantId }, select: { razorpayWebhookSecret: true } });
  if (!settings || !validWebhook(raw, request.headers.get("x-razorpay-signature"), settings.razorpayWebhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let event: { event?: string; payload?: { payment?: { entity?: { id: string; amount: number; status: string } }; qr_code?: { entity?: { id: string } } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const payment = event.payload?.payment?.entity;
  const qrId = event.payload?.qr_code?.entity?.id;
  if (event.event === "qr_code.credited" && payment && qrId && (payment.status === "captured" || payment.status === "authorized")) {
    const result = await runForRestaurant(restaurantId, () => applyQrPayment(qrId, payment));
    return NextResponse.json({ ok: true, applied: result.applied });
  }
  return NextResponse.json({ ok: true, ignored: event.event ?? "unknown" });
}
