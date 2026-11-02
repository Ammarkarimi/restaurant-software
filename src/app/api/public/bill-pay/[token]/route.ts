import { NextRequest, NextResponse } from "next/server";
import { prisma, rawPrisma, runForRestaurant } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { verifyBillShareToken } from "@/lib/share";
import { checkBillQr, createBillQr } from "@/lib/razorpay";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { handleError } from "@/lib/api";

async function forToken(token: string) {
  const orderId = verifyBillShareToken(decodeURIComponent(token));
  if (!orderId) return null;
  const owner = await rawPrisma.order.findUnique({ where: { id: orderId }, select: { restaurantId: true, restaurant: { select: { status: true } } } });
  return owner && owner.restaurant.status === "active" ? { orderId, restaurantId: owner.restaurantId } : null;
}

/** The guest's digital bill: a Razorpay UPI QR for what is still due. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const t = await forToken((await params).token);
    if (!t) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    if (!rateLimit(`bill-pay:${clientIp(request.headers)}`, 20, 10 * 60_000)) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
    const qr = await runForRestaurant(t.restaurantId, async () => {
      const s = await getSettings();
      if (!s.razorpayKeyId || !s.razorpayKeySecret) return null;
      return createBillQr(s, t.orderId, "Guest (bill link)");
    });
    if (!qr) return NextResponse.json({ error: "Online payment is not available" }, { status: 404 });
    return NextResponse.json({ qr: { id: qr.id, imageUrl: qr.imageUrl, amount: qr.amount, status: qr.status } });
  } catch (error) {
    return handleError(error);
  }
}

/** Has the guest's payment arrived? */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const t = await forToken((await params).token);
    const id = new URL(request.url).searchParams.get("qr");
    if (!t || !id) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    const status = await runForRestaurant(t.restaurantId, async () => {
      const req = await prisma.upiRequest.findFirst({ where: { id, orderId: t.orderId } });
      if (!req) return null;
      return (await checkBillQr(await getSettings(), req.id)).status;
    });
    return NextResponse.json({ status });
  } catch (error) {
    return handleError(error);
  }
}
