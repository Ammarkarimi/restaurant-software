import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { isUniqueViolation } from "@/lib/orders";
import { supplierSchema } from "@/lib/purchases";

type Params = { params: Promise<{ id: string }> };

/** A supplier with their purchases and the payments made to them. */
export async function GET(_request: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    const supplier = await prisma.supplier.findFirst({ where: { id } });
    if (!supplier) fail("Supplier not found", 404);
    const [purchases, payments] = await Promise.all([
      prisma.purchase.findMany({ where: { supplierId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.expense.findMany({ where: { supplierId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return NextResponse.json({ supplier, purchases, payments });
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = supplierSchema.parse(await request.json());
    if (!(await prisma.supplier.findFirst({ where: { id } }))) fail("Supplier not found", 404);
    try {
      const supplier = await prisma.supplier.update({ where: { id }, data: { name: body.name, phone: body.phone || null, gstin: body.gstin || null, address: body.address || null, notes: body.notes || null } });
      await logActivity(user, "Edited supplier", supplier.name);
      return NextResponse.json({ supplier });
    } catch (error) {
      if (isUniqueViolation(error)) fail(`You already have a supplier called ${body.name}`);
      throw error;
    }
  });
}

/** Suppliers with history are hidden, not deleted, so old purchases keep their name. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const supplier = await prisma.supplier.findFirst({ where: { id }, include: { _count: { select: { purchases: true, payments: true } } } });
    if (!supplier) fail("Supplier not found", 404);
    if (supplier._count.purchases || supplier._count.payments) await prisma.supplier.update({ where: { id }, data: { active: false } });
    else await prisma.supplier.delete({ where: { id } });
    await logActivity(user, "Removed supplier", supplier.name);
    return NextResponse.json({ success: true });
  });
}
