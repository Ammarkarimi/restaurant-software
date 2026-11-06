import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { banquetPackageSchema } from "@/lib/banquet";

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = banquetPackageSchema.parse(await request.json());
    const settings = await getSettings();
    const last = await prisma.banquetPackage.aggregate({ _max: { sortOrder: true } });
    const pkg = await prisma.banquetPackage.create({ data: { restaurantId: settings.restaurantId, ...body, menu: JSON.stringify(body.menu), sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await logActivity(user, "Added banquet package", `${pkg.name} (₹${pkg.pricePerPlate} a plate)`);
    return NextResponse.json({ package: pkg }, { status: 201 });
  });
}
