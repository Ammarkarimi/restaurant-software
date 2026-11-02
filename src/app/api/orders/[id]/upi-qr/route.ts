import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { checkBillQr, closeBillQrs, createBillQr } from "@/lib/razorpay";
import { prisma } from "@/lib/db";
import { loadOrder, serializeOrder } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

const view = (r: { id: string; amount: number; imageUrl: string; status: string; paymentId: string | null }) => ({ id: r.id, amount: r.amount, imageUrl: r.imageUrl, status: r.status, paymentId: r.paymentId });

/** Makes (or reuses) a Razorpay UPI QR for the bill's exact amount. */
export async function POST(_request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const qr = await createBillQr(await getSettings(), id, user.name);
    return NextResponse.json({ qr: view(qr) });
  });
}

/** Has the guest paid? Checks with Razorpay; when paid the bill is already closed. */
export async function GET(request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    const qrId = new URL(request.url).searchParams.get("qr");
    const req = qrId ? await prisma.upiRequest.findFirst({ where: { id: qrId, orderId: id } }) : null;
    if (!req) return NextResponse.json({ qr: null });
    const fresh = await checkBillQr(await getSettings(), req.id);
    const order = fresh.status === "paid" ? serializeOrder(await loadOrder(id)) : null;
    return NextResponse.json({ qr: view(fresh), order });
  });
}

/** The guest will pay another way: close the QR so it cannot be paid by mistake later. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    await closeBillQrs(await getSettings(), id);
    return NextResponse.json({ ok: true });
  });
}
