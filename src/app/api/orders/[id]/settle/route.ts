import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { serializeOrder } from "@/lib/orders";
import { paymentsSchema, settleOrder } from "@/lib/settle";

const schema = z.object({ payments: paymentsSchema });

/** Takes payment (cash, UPI, card or a mix) and closes the bill. The table becomes free. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const result = await settleOrder(user, id, body.payments);
    return NextResponse.json({ order: serializeOrder(result.order), kotNumber: result.kotNumber });
  });
}
