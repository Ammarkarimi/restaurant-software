import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { fail } from "@/lib/api";
import { withPlatform } from "@/lib/platform";
import { deleteRestaurantData, platformRestaurantDetail, restaurantFields } from "@/lib/platform-restaurants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    return NextResponse.json(await platformRestaurantDetail(id));
  });
}

const updateSchema = z.object({ ...restaurantFields, status: z.enum(["active", "suspended"]) }).partial();

export async function PATCH(request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const restaurant = await rawPrisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) fail("Restaurant not found", 404);

    const text = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
    await rawPrisma.restaurant.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.status && { status: body.status }),
        ...(body.monthlyFee !== undefined && { monthlyFee: body.monthlyFee }),
        ...(body.billingStart && { billingStart: body.billingStart }),
        city: text(body.city),
        contactName: text(body.contactName),
        contactPhone: text(body.contactPhone),
        contactEmail: text(body.contactEmail),
        notes: text(body.notes),
      },
    });
    return NextResponse.json(await platformRestaurantDetail(id));
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    const { confirmName } = z.object({ confirmName: z.string() }).parse(await request.json());
    const restaurant = await rawPrisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) fail("Restaurant not found", 404);
    if (confirmName.trim().toLowerCase() !== restaurant.name.trim().toLowerCase()) {
      fail("Type the restaurant's name exactly to confirm deleting it");
    }
    await deleteRestaurantData(id);
    return NextResponse.json({ success: true });
  });
}
