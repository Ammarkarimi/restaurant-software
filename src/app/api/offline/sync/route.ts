import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { isUniqueViolation, loadOrder, nextNumber, saveTotals, totalsOf } from "@/lib/orders";
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

async function syncBill(user: SessionUser, b: OfflineBill): Promise<number> {
  const existing = await prisma.order.findFirst({ where: { clientId: b.clientId }, select: { number: true } });
  if (existing) return existing.number;
  const settings = await getSettings();
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
          // The rules the counter billed with, so the totals come out the same.
          taxMode: b.rules.taxMode,
          taxName: b.rules.taxName,
          pricesIncludeTax: b.rules.pricesIncludeTax,
          serviceChargePercent: b.rules.serviceChargePercent,
          roundOff: b.rules.roundOff,
          chargeTaxRate: b.rules.chargeTaxRate,
          packingCharge: b.type === "dine_in" ? 0 : b.rules.packingCharge,
          deliveryCharge: b.type === "delivery" ? b.rules.deliveryCharge : 0,
          discountType: "amount",
          discountValue: b.discount,
          discountReason: b.discount ? "Discount (offline bill)" : null,
          items: {
            create: b.items.map((i) => ({
              restaurantId: settings.restaurantId,
              menuItemId: i.menuItemId,
              name: i.name,
              variant: i.variant || null,
              categoryName: i.category || null,
              foodType: i.foodType,
              price: i.price,
              quantity: i.quantity,
              taxRate: i.taxRate,
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
