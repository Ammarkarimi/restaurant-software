import { NextRequest, NextResponse } from "next/server";
import { currentRestaurantId, prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { isUniqueViolation } from "@/lib/orders";
import { supplierSchema } from "@/lib/purchases";

/** Suppliers with what the restaurant owes each. */
export async function GET() {
  return withAdmin(async () => {
    const suppliers = await prisma.supplier.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { _count: { select: { purchases: true } } } });
    return NextResponse.json({ suppliers });
  });
}

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = supplierSchema.parse(await request.json());
    try {
      const supplier = await prisma.supplier.create({
        data: { restaurantId: currentRestaurantId(), name: body.name, phone: body.phone || null, gstin: body.gstin || null, address: body.address || null, notes: body.notes || null },
      });
      await logActivity(user, "Added supplier", supplier.name);
      return NextResponse.json({ supplier }, { status: 201 });
    } catch (error) {
      if (isUniqueViolation(error)) fail(`You already have a supplier called ${body.name}`);
      throw error;
    }
  });
}
