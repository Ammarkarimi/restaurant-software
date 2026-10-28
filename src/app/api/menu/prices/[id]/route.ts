import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { priceListData, priceListSchema } from "@/lib/menu-server";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = priceListSchema.parse(await request.json());
    if (!(await prisma.priceList.findFirst({ where: { id } }))) fail("Price list not found", 404);
    const list = await prisma.priceList.update({ where: { id }, data: priceListData(body) });
    await logActivity(user, "Edited special prices", list.name);
    return NextResponse.json({ priceList: list });
  });
}

/** Switch on / off, or move up / down (the first matching list wins). */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = z.object({ active: z.boolean(), move: z.enum(["up", "down"]) }).partial().parse(await request.json());
    const list = await prisma.priceList.findFirst({ where: { id } });
    if (!list) fail("Price list not found", 404);
    if (body.move) {
      const all = await prisma.priceList.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
      const i = all.findIndex((l) => l.id === id);
      const j = body.move === "up" ? i - 1 : i + 1;
      if (j >= 0 && j < all.length) {
        [all[i], all[j]] = [all[j], all[i]];
        await prisma.$transaction(all.map((l, n) => prisma.priceList.update({ where: { id: l.id }, data: { sortOrder: n + 1 } })));
      }
    }
    if (body.active !== undefined) {
      await prisma.priceList.update({ where: { id }, data: { active: body.active } });
      await logActivity(user, body.active ? "Switched on special prices" : "Switched off special prices", list.name);
    }
    return NextResponse.json({ success: true });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const list = await prisma.priceList.findFirst({ where: { id } });
    if (!list) fail("Price list not found", 404);
    await prisma.priceList.delete({ where: { id } });
    await logActivity(user, "Deleted special prices", list.name);
    return NextResponse.json({ success: true });
  });
}
