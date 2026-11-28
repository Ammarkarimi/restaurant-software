import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { defaultCharges, isUniqueViolation, loadOrder, nextNumber, orderRulesFrom, saveTotals, totalsOf } from "@/lib/orders";
import { priceFor } from "@/lib/menu";
import { discountLimit } from "@/lib/permissions";
import { settleOrder } from "@/lib/settle";
import { offlineBillSchema, type OfflineBill } from "@/lib/offline";
import { formatCurrency } from "@/lib/utils";
import type { SessionUser } from "@/lib/session";

export const maxDuration = 120;

const schema = z.object({ bills: z.array(z.unknown()).max(200) });

/**
 * Bills made while the internet was down. Each is saved as a paid bill with its offline bill
 * number, day and time; one already synced (same clientId) is skipped, so retrying is safe.
 */
export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const { bills } = schema.parse(await request.json());
    const results: Array<{ clientId: string; ok: boolean; number?: number; error?: string }> = [];
    for (const raw of bills) {
      const parsed = offlineBillSchema.safeParse(raw);
      const clientId = (raw as { clientId?: string })?.clientId ?? "?";
      if (!parsed.success) {
        results.push({ clientId, ok: false, error: "This bill could not be read" });
        continue;
      }
      try {
        results.push({ clientId, ok: true, number: await syncBill(user, parsed.data) });
      } catch (e) {
        results.push({ clientId, ok: false, error: (e as Error).message });
      }
    }
    const done = results.filter((r) => r.ok).length;
    if (done) await logActivity(user, "Synced offline bills", `${done} bill${done === 1 ? "" : "s"} made while the internet was down`);
    return NextResponse.json({ results });
  });
}

/**
 * An offline bill is checked like a bill made online: dishes on the menu are charged at the menu's
 * price and tax (not whatever the device sent), the bill follows the restaurant's tax and charge
 * settings, and a cashier's discount stays within their limit. Anything changed is noted in the
 * activity history, and a different total shows up as a payment difference in the day close.
 */
async function checkedBill(user: SessionUser, b: OfflineBill, settings: Awaited<ReturnType<typeof getSettings>>) {
  const notes: string[] = [];
  const ids = [...new Set(b.items.map((i) => i.menuItemId).filter((x): x is string => !!x))];
  const menu = new Map((await prisma.menuItem.findMany({ where: { id: { in: ids } }, select: { id: true, price: true, variants: true, taxRate: true, priceIncludesTax: true } })).map((m) => [m.id, m]));
  const items = b.items.map((i) => {
    const m = i.menuItemId ? menu.get(i.menuItemId) : undefined;
    if (!i.menuItemId) return { ...i, menuItemId: null }; // an open item, as the till allows
    if (!m) {
      notes.push(`${i.name}: no longer on the menu, kept as an open item`);
      return { ...i, menuItemId: null };
    }
    const price = priceFor(m, i.variant) ?? i.price;
    if (Math.abs(price - i.price) > 0.009) notes.push(`${i.name}: ${formatCurrency(i.price, settings.currency)} → menu price ${formatCurrency(price, settings.currency)}`);
    return { ...i, price, taxRate: m.taxRate ?? settings.defaultTaxRate, taxIncluded: m.priceIncludesTax };
  });
  const rules = { ...orderRulesFrom(settings), ...defaultCharges(b.type, settings) };
  let discount = b.discount;
  if (discount > 0) {
    const itemsTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const limit = (discountLimit(user) / 100) * itemsTotal;
    if (discount > limit + 0.009) {
      notes.push(`discount ${formatCurrency(discount, settings.currency)} is above ${user.name}'s limit, kept at ${formatCurrency(limit, settings.currency)}`);
      discount = Math.floor(limit * 100) / 100;
    }
  }
  return { items, rules, discount, notes };
}

async function syncBill(user: SessionUser, b: OfflineBill): Promise<number> {
  const existing = await prisma.order.findFirst({ where: { clientId: b.clientId }, select: { number: true } });
  if (existing) return existing.number;
  const settings = await getSettings();
  const checked = await checkedBill(user, b, settings);
  const table = b.tableName ? await prisma.diningTable.findFirst({ where: { name: { equals: b.tableName, mode: "insensitive" } }, select: { id: true } }) : null;
  const notes = [b.tableName && !table ? `Table ${b.tableName}` : null, "Billed offline"].filter(Boolean).join(" · ");

  let created: { id: string; number: number };
  try {
    created = await prisma.$transaction(async (tx) => {
      const taken = await tx.order.findFirst({ where: { billNumber: b.billNumber }, select: { id: true } });
      const order = await tx.order.create({
        data: {
          restaurantId: settings.restaurantId,
          number: await nextNumber(tx, "orderSeq"),
          type: b.type,
          source: "counter",
          clientId: b.clientId,
          offline: true,
          billNumber: taken ? `${b.billNumber}-${b.clientId.slice(-4)}` : b.billNumber,
          tableId: table?.id ?? null,
          customerName: b.customerName || null,
          customerPhone: b.customerPhone || null,
          notes,
          createdById: user.id,
          createdByName: user.name,
          createdAt: b.createdAt,
          billedAt: b.paidAt,
          // The restaurant's own tax and charge settings (never the device's).
          ...checked.rules,
          discountType: "amount",
          discountValue: checked.discount,
          discountReason: checked.discount ? "Discount (offline bill)" : null,
          items: {
            create: checked.items.map((i) => ({
              restaurantId: settings.restaurantId,
              menuItemId: i.menuItemId,
              name: i.name,
              variant: i.variant || null,
              categoryName: i.category || null,
              foodType: i.foodType,
              price: i.price,
              quantity: i.quantity,
              taxRate: i.taxRate,
              taxIncluded: i.taxIncluded,
              // Cooked long ago: it never shows on the kitchen screen.
              kotNumber: 0,
              sentAt: b.createdAt,
              kitchenStatus: "served",
            })),
          },
        },
        select: { id: true, number: true },
      });
      await saveTotals(tx, await loadOrder(order.id, tx));
      return order;
    });
  } catch (e) {
    // Two syncs at once: the other one saved it.
    if (isUniqueViolation(e, "clientId")) return (await prisma.order.findFirstOrThrow({ where: { clientId: b.clientId } })).number;
    throw e;
  }

  if (checked.notes.length) await logActivity(user, "Offline bill corrected", `Bill ${b.billNumber}: ${checked.notes.join("; ")}`);
  const order = await loadOrder(created.id);
  const total = totalsOf(order).total;
  // Payments as taken at the counter; if the menu maths differ by paise, the last payment absorbs it.
  const payments = b.payments.length ? b.payments.map((p) => ({ ...p })) : [{ method: "cash" as const, amount: total }];
  const diff = Math.round((total - payments.reduce((s, p) => s + p.amount, 0)) * 100) / 100;
  if (Math.abs(diff) > 0.009) {
    payments[payments.length - 1].amount = Math.round((payments[payments.length - 1].amount + diff) * 100) / 100;
    if (Math.abs(diff) >= 1) await logActivity(user, "Offline bill total differs", `Bill ${order.billNumber}: printed ${formatCurrency(b.total, settings.currency)}, saved ${formatCurrency(total, settings.currency)}`);
  }
  await settleOrder(user, created.id, payments.filter((p) => p.amount > 0), { businessDate: b.businessDate, paidAt: b.paidAt });
  return created.number;
}
