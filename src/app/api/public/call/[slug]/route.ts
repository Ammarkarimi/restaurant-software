import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, runForRestaurant } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findPublicRestaurant, tableForToken } from "@/lib/public-menu";

const schema = z.object({ table: z.string().min(1).max(64), type: z.enum(["waiter", "bill"]) });

/** "Call waiter" / "Ask for the bill" from the table QR code: the table lights up on the Tables screen. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!rateLimit(`qr-call:${clientIp(request.headers)}`, 10, 10 * 60_000)) fail("Please wait a moment, the staff are on their way.", 429);
    const body = schema.parse(await request.json());
    const found = await findPublicRestaurant(slug);
    if (!found) fail("This menu is not available", 404);
    return await runForRestaurant(found.restaurant.id, async () => {
      const table = await tableForToken(body.table);
      if (!table) fail("This QR code is no longer valid. Please ask the staff.", 404);
      await prisma.diningTable.update({ where: { id: table.id }, data: { callType: body.type, callAt: new Date() } });
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return handleError(error);
  }
}
