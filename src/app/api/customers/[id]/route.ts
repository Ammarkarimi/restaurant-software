import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { customerSchema, normalizePhone } from "@/lib/customers";
import { round2 } from "@/lib/billing";
import { isUniqueViolation } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

async function find(id: string) {
  const customer = await prisma.customer.findFirst({ where: { id } });
  if (!customer) fail("Customer not found", 404);
  return customer;
}

/** A customer with their recent bills. */
export async function GET(_request: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    const customer = await find(id);
    const orders = await prisma.order.findMany({
      where: { customerId: id },
      select: { id: true, number: true, billNumber: true, type: true, status: true, total: true, settledAt: true, pointsEarned: true, pointsRedeemed: true, table: { select: { name: true } } },
      orderBy: { settledAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ customer, orders });
  });
}

const patchSchema = customerSchema.partial().extend({
  // Give or take back points by hand, e.g. a goodwill gesture.
  pointsChange: z.coerce.number().int().min(-10_000_000).max(10_000_000).optional(),
  pointsReason: z.string().trim().max(200).optional(),
  // Most they may owe when paying later; null = only the owner / manager can let them owe.
  creditLimit: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const customer = await find(id);
    const phone = body.phone !== undefined ? normalizePhone(body.phone) : customer.phone;
    if (!phone) fail("Enter a valid phone number");
    if (body.pointsChange && !body.pointsReason) fail("Please give a reason for changing the points");
    const text = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
    try {
      const updated = await prisma.customer.update({
        where: { id },
        data: {
          phone,
          name: text(body.name),
          address: text(body.address),
          email: text(body.email),
          birthday: text(body.birthday),
          notes: text(body.notes),
          ...(body.pointsChange && { points: Math.max(0, round2(customer.points + body.pointsChange)) }),
          ...(body.creditLimit !== undefined && { creditLimit: body.creditLimit }),
        },
      });
      if (body.creditLimit !== undefined && body.creditLimit !== customer.creditLimit) {
        await logActivity(user, "Changed credit limit", `${updated.name ?? updated.phone}: ${body.creditLimit === null ? "none" : body.creditLimit}`);
      }
      if (body.pointsChange) {
        await logActivity(user, "Changed loyalty points", `${updated.name ?? updated.phone}: ${body.pointsChange > 0 ? "+" : ""}${body.pointsChange} (${body.pointsReason})`);
      }
      return NextResponse.json({ customer: updated });
    } catch (error) {
      if (isUniqueViolation(error)) fail("Another customer already has this phone number");
      throw error;
    }
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const customer = await find(id);
    await prisma.customer.delete({ where: { id } });
    await logActivity(user, "Customer removed", `${customer.name ?? ""} ${customer.phone}`.trim());
    return NextResponse.json({ success: true });
  });
}
