import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, isAdmin, withAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { customerSchema, normalizePhone } from "@/lib/customers";
import { isUniqueViolation } from "@/lib/orders";

const lookupFields = { id: true, name: true, phone: true, address: true, points: true, visits: true, lastVisitAt: true } as const;

/**
 * Owners: the customer list, searchable and sortable.
 * Cashiers: a quick lookup by phone or name while taking an order (a few matches only).
 */
export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const sp = new URL(request.url).searchParams;
    const q = sp.get("q")?.trim() ?? "";
    const digits = q.replace(/\D/g, "");
    const search: Prisma.CustomerWhereInput | undefined = q
      ? { OR: [...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []), { name: { contains: q, mode: "insensitive" } }] }
      : undefined;

    if (!isAdmin(user)) {
      if (q.length < 3) return NextResponse.json({ customers: [] });
      const customers = await prisma.customer.findMany({ where: search, select: lookupFields, orderBy: { lastVisitAt: { sort: "desc", nulls: "last" } }, take: 8 });
      return NextResponse.json({ customers });
    }

    const sort = sp.get("sort");
    const orderBy: Prisma.CustomerOrderByWithRelationInput =
      sort === "spent" ? { totalSpent: "desc" } : sort === "visits" ? { visits: "desc" } : sort === "points" ? { points: "desc" } : { lastVisitAt: { sort: "desc", nulls: "last" } };
    const [customers, stats] = await Promise.all([
      prisma.customer.findMany({ where: search, orderBy, take: q ? 50 : 300 }),
      prisma.customer.aggregate({ _count: true, _sum: { points: true, totalSpent: true } }),
    ]);
    const repeat = await prisma.customer.count({ where: { visits: { gte: 2 } } });
    return NextResponse.json({
      customers,
      stats: { count: stats._count, repeat, points: stats._sum.points ?? 0, spent: stats._sum.totalSpent ?? 0 },
    });
  });
}

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = customerSchema.parse(await request.json());
    const phone = normalizePhone(body.phone);
    if (!phone) fail("Enter a valid phone number");
    try {
      const customer = await prisma.customer.create({
        data: {
          restaurantId: user.restaurantId,
          phone,
          name: body.name || null,
          address: body.address || null,
          email: body.email || null,
          birthday: body.birthday || null,
          notes: body.notes || null,
        },
      });
      await logActivity(user, "Customer added", `${customer.name ?? ""} ${customer.phone}`.trim());
      return NextResponse.json({ customer }, { status: 201 });
    } catch (error) {
      if (isUniqueViolation(error)) fail("A customer with this phone number already exists");
      throw error;
    }
  });
}
