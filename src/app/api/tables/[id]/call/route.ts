import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";

/** Staff answered the guest's call: clear it from the Tables screen. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const table = await prisma.diningTable.findFirst({ where: { id } });
    if (!table) fail("Table not found", 404);
    await prisma.diningTable.update({ where: { id }, data: { callType: null, callAt: null } });
    return NextResponse.json({ ok: true });
  });
}
