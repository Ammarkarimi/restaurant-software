import { z } from "zod";
import { rawPrisma } from "./db";
import { fail } from "./api";
import { todayKey } from "./dates";
import { PLATFORM_TIMEZONE, slugify } from "./platform";
import { addMonths, isMonth, monthOf, subscriptionSummary } from "./subscription";

export const SUBSCRIPTION_METHODS = ["upi", "bank_transfer", "cash", "card", "cheque", "other"] as const;

export function platformToday() {
  return todayKey(PLATFORM_TIMEZONE);
}

export function currentMonth() {
  return monthOf(platformToday());
}

const optionalText = z.string().trim().max(200).optional().nullable();
const month = z.string().refine(isMonth, "Choose a month");

export const restaurantFields = {
  name: z.string().trim().min(2, "Restaurant name is required").max(120),
  city: optionalText,
  contactName: optionalText,
  contactPhone: optionalText,
  contactEmail: z.string().trim().email("Email is not valid").optional().nullable().or(z.literal("")),
  monthlyFee: z.coerce.number().min(0, "Fee cannot be negative").max(10_000_000),
  billingStart: month,
  notes: z.string().trim().max(2000).optional().nullable(),
};

/** A short unique name for the restaurant, used internally (and for future online ordering links). */
export async function chooseSlug(name: string) {
  const base = slugify(name);
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await rawPrisma.restaurant.findUnique({ where: { slug } }))) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function assertEmailFree(email: string) {
  // Sign-in emails are unique across every restaurant.
  if (await rawPrisma.staff.findUnique({ where: { email } })) {
    fail("This email already signs in to a restaurant. Please use a different email for the owner.");
  }
}

/**
 * The active owner / manager accounts of one restaurant can also manage another
 * (one owner, several outlets). Returns the people who got access.
 */
export async function linkOwnersTo(restaurantId: string, fromRestaurantId: string) {
  const [target, owners] = await Promise.all([
    rawPrisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } }),
    rawPrisma.staff.findMany({ where: { restaurantId: fromRestaurantId, role: "admin", active: true }, select: { id: true, name: true, email: true } }),
  ]);
  if (!target) fail("Restaurant not found", 404);
  if (owners.length === 0) fail("That restaurant has no active owner / manager account");
  await rawPrisma.outletAccess.createMany({ data: owners.map((o) => ({ staffId: o.id, restaurantId })), skipDuplicates: true });
  return owners;
}

/** Every restaurant with its usage and payment position, plus totals for the dashboard. */
export async function platformOverview() {
  const month = currentMonth();
  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const nextMonthStart = new Date(`${addMonths(month, 1)}-01T00:00:00Z`);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [restaurants, lastLogins, recentBills, collected, recentPayments] = await Promise.all([
    rawPrisma.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subscriptionPayments: { select: { month: true, amount: true, clearsMonth: true } },
        _count: { select: { tables: true, menuItems: true, staff: true } },
      },
    }),
    rawPrisma.staff.groupBy({ by: ["restaurantId"], _max: { lastLoginAt: true } }),
    rawPrisma.order.groupBy({
      by: ["restaurantId"],
      where: { status: "settled", settledAt: { gte: since } },
      _count: { _all: true },
    }),
    rawPrisma.subscriptionPayment.aggregate({
      where: { paidOn: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    rawPrisma.subscriptionPayment.findMany({
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: { restaurant: { select: { id: true, name: true } } },
    }),
  ]);

  const loginBy = new Map(lastLogins.map((l) => [l.restaurantId, l._max.lastLoginAt]));
  const billsBy = new Map(recentBills.map((b) => [b.restaurantId, b._count._all]));

  const rows = restaurants.map(({ subscriptionPayments, _count, orderSeq, billSeq, kotSeq, ...restaurant }) => {
    void orderSeq;
    void billSeq;
    void kotSeq;
    const s = subscriptionSummary(restaurant, subscriptionPayments, month);
    return {
      ...restaurant,
      tables: _count.tables,
      menuItems: _count.menuItems,
      staff: _count.staff,
      lastLoginAt: loginBy.get(restaurant.id) ?? null,
      bills30d: billsBy.get(restaurant.id) ?? 0,
      subscription: {
        currentStatus: s.currentStatus,
        overdueMonths: s.overdueMonths,
        outstanding: s.outstanding,
        paidUntil: s.paidUntil,
      },
    };
  });

  const active = rows.filter((r) => r.status === "active");
  return {
    month,
    restaurants: rows,
    recentPayments,
    totals: {
      restaurants: rows.length,
      active: active.length,
      suspended: rows.length - active.length,
      expectedMonthly: active.reduce((sum, r) => sum + r.monthlyFee, 0),
      collectedThisMonth: collected._sum.amount ?? 0,
      outstanding: rows.reduce((sum, r) => sum + r.subscription.outstanding, 0),
      unpaidThisMonth: rows.filter((r) => ["unpaid", "part_paid"].includes(r.subscription.currentStatus)).length,
      overdueRestaurants: rows.filter((r) => r.subscription.overdueMonths.length > 0).length,
    },
  };
}

/** One restaurant in full: owner contacts, sign-in accounts, usage and every subscription payment. */
export async function platformRestaurantDetail(id: string) {
  const restaurant = await rawPrisma.restaurant.findUnique({
    where: { id },
    include: {
      subscriptionPayments: { orderBy: [{ month: "desc" }, { createdAt: "desc" }] },
      staff: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true },
      },
      _count: { select: { tables: true, menuItems: true } },
    },
  });
  if (!restaurant) fail("Restaurant not found", 404);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [bills30d, billsAll, sales30d, sharedWith, alsoManages] = await Promise.all([
    rawPrisma.order.count({ where: { restaurantId: id, status: "settled", settledAt: { gte: since } } }),
    rawPrisma.order.count({ where: { restaurantId: id, status: "settled" } }),
    rawPrisma.order.aggregate({ where: { restaurantId: id, status: "settled", settledAt: { gte: since } }, _sum: { total: true } }),
    // Owners of other restaurants who can also manage this one
    rawPrisma.outletAccess.findMany({
      where: { restaurantId: id },
      select: { id: true, staff: { select: { name: true, email: true, restaurant: { select: { id: true, name: true } } } } },
    }),
    // Other restaurants this restaurant's owners can manage
    rawPrisma.outletAccess.findMany({
      where: { staff: { restaurantId: id } },
      select: { id: true, staff: { select: { name: true } }, restaurant: { select: { id: true, name: true } } },
    }),
  ]);
  const { subscriptionPayments, _count, ...rest } = restaurant;
  return {
    ...rest,
    outlets: {
      sharedWith: sharedWith.map((a) => ({ id: a.id, name: a.staff.name, email: a.staff.email, restaurant: a.staff.restaurant })),
      alsoManages: alsoManages.map((a) => ({ id: a.id, name: a.staff.name, restaurant: a.restaurant })),
    },
    payments: subscriptionPayments,
    usage: { tables: _count.tables, menuItems: _count.menuItems, bills30d, billsAll, sales30d: sales30d._sum.total ?? 0 },
    subscription: subscriptionSummary(restaurant, subscriptionPayments, currentMonth()),
    today: platformToday(),
  };
}

/** Removes a restaurant and everything it ever stored. Cannot be undone. */
export async function deleteRestaurantData(restaurantId: string) {
  await rawPrisma.$transaction(async (tx) => {
    const where = { restaurantId };
    await tx.payment.deleteMany({ where });
    await tx.orderItem.deleteMany({ where });
    await tx.order.deleteMany({ where });
    await tx.menuItem.deleteMany({ where });
    await tx.menuCategory.deleteMany({ where });
    await tx.diningTable.deleteMany({ where });
    await tx.activityLog.deleteMany({ where });
    await tx.staff.deleteMany({ where });
    await tx.restaurantSettings.deleteMany({ where });
    await tx.subscriptionPayment.deleteMany({ where });
    await tx.restaurant.delete({ where: { id: restaurantId } });
  });
}
