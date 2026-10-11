import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";

export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const take = Math.min(200, Number(searchParams.get("take")) || 100);
    const cursor = searchParams.get("cursor");
    const items = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    return NextResponse.json({ items: items.slice(0, take), nextCursor: items.length > take ? items[take - 1].id : null });
  });
}
