import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentRestaurantId, prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";

const schema = z.object({ name: z.string().trim().min(1, "Category name is required").max(60) });

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const { name } = schema.parse(await request.json());
    const all = await prisma.menuCategory.findMany({ select: { name: true, sortOrder: true } });
    if (all.some((c) => c.name.toLowerCase() === name.toLowerCase())) fail(`There is already a category called ${name}`);
    const category = await prisma.menuCategory.create({
      data: { restaurantId: currentRestaurantId(), name, sortOrder: all.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1 },
    });
    await logActivity(user, "Added menu category", name);
    return NextResponse.json({ category }, { status: 201 });
  });
}
