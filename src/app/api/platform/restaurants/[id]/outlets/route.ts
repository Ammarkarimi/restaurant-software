import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { fail } from "@/lib/api";
import { withPlatform } from "@/lib/platform";
import { linkOwnersTo, platformRestaurantDetail } from "@/lib/platform-restaurants";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ fromRestaurantId: z.string().min(1, "Choose the owner's other restaurant") });

/** The owner(s) of another restaurant can also manage this one (same owner, several outlets). */
export async function POST(request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    const { fromRestaurantId } = schema.parse(await request.json());
    if (fromRestaurantId === id) fail("Choose a different restaurant");
    await linkOwnersTo(id, fromRestaurantId);
    return NextResponse.json(await platformRestaurantDetail(id));
  });
}

/** Takes away one person's access to this outlet. */
export async function DELETE(request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    const accessId = new URL(request.url).searchParams.get("access");
    const access = accessId ? await rawPrisma.outletAccess.findUnique({ where: { id: accessId } }) : null;
    if (!access || (access.restaurantId !== id && !(await rawPrisma.staff.findFirst({ where: { id: access.staffId, restaurantId: id } })))) fail("Access not found", 404);
    await rawPrisma.outletAccess.delete({ where: { id: access.id } });
    return NextResponse.json(await platformRestaurantDetail(id));
  });
}
