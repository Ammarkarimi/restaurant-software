import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

const schema = z
  .object({
    name: z.string().trim().min(1, "Category name is required").max(60),
    active: z.boolean(),
    move: z.enum(["up", "down"]),
  })
  .partial();

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const category = await prisma.menuCategory.findFirst({ where: { id } });
    if (!category) fail("Category not found", 404);

    if (body.move) {
      // Renumber everything so the order is always clean, then swap with the neighbour.
      const all = await prisma.menuCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
      const index = all.findIndex((c) => c.id === id);
      const swapWith = body.move === "up" ? index - 1 : index + 1;
      if (swapWith >= 0 && swapWith < all.length) {
        [all[index], all[swapWith]] = [all[swapWith], all[index]];
        await prisma.$transaction(all.map((c, i) => prisma.menuCategory.update({ where: { id: c.id }, data: { sortOrder: i + 1 } })));
      }
    }
    const { move, ...data } = body;
    void move;
    if (Object.keys(data).length) {
      await prisma.menuCategory.update({ where: { id }, data });
      if (data.name && data.name !== category.name) await logActivity(user, "Renamed menu category", `${category.name} → ${data.name}`);
    }
    return NextResponse.json({ success: true });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const category = await prisma.menuCategory.findFirst({ where: { id }, include: { _count: { select: { items: true } } } });
    if (!category) fail("Category not found", 404);
    if (category._count.items > 0) fail(`Move or delete the ${category._count.items} item(s) in ${category.name} first.`);
    await prisma.menuCategory.delete({ where: { id } });
    await logActivity(user, "Deleted menu category", category.name);
    return NextResponse.json({ success: true });
  });
}
