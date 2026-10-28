import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { round2 } from "@/lib/billing";
import { EXPENSE_METHODS } from "@/lib/cash";
import { addStockEntry, round3 } from "@/lib/stock";
import { linesTotal, parsePurchaseLines } from "@/lib/purchases";
import { formatCurrency, label } from "@/lib/utils";

const schema = z.object({
  invoiceNo: z.string().trim().max(40).nullable().optional(),
  // What actually arrived and its price; missing lines did not come.
  lines: z.array(z.object({ stockItemId: z.string().min(1).max(40), quantity: z.coerce.number().min(0).max(10_000_000), rate: z.coerce.number().min(0).max(10_000_000) })).min(1).max(100),
  paidAmount: z.coerce.number().min(0).max(100_000_000).default(0),
  paidMethod: z.enum(EXPENSE_METHODS).default("cash"),
});

/**
 * The goods arrived: adds them to stock (with their cost, so stock value and dish costs stay right),
 * adds the bill to what the supplier is owed, and saves any money paid now as an expense.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const purchase = await prisma.purchase.findFirst({ where: { id } });
    if (!purchase) fail("Purchase order not found", 404);
    if (purchase.status !== "ordered") fail("This order was already received or cancelled.");
    const ordered = parsePurchaseLines(purchase.lines);
    const arrived = body.lines
      .filter((l) => l.quantity > 0)
      .map((l) => {
        const o = ordered.find((x) => x.stockItemId === l.stockItemId);
        if (!o) fail("An item that was not on the order was received");
        return { ...o, quantity: round3(l.quantity), rate: l.rate };
      });
    if (arrived.length === 0) fail("Enter what arrived, or cancel the order");
    const total = linesTotal(arrived);
    if (body.paidAmount > total + 0.01) fail(`You are paying more than the bill (${formatCurrency(total, settings.currency)})`);
    const date = todayKey(settings.timezone);

    await prisma.$transaction(async (tx) => {
      for (const l of arrived) {
        const cost = round2(l.quantity * l.rate);
        await addStockEntry(tx, { stockItemId: l.stockItemId, type: "purchase", quantity: l.quantity, date, createdByName: user.name, cost, supplier: purchase.supplierName, note: `Purchase #${purchase.number}${body.invoiceNo ? `, bill ${body.invoiceNo}` : ""}` });
        if (l.rate > 0) await tx.stockItem.update({ where: { id: l.stockItemId }, data: { costPerUnit: l.rate } });
      }
      await tx.purchase.update({ where: { id }, data: { status: "received", receivedOn: date, invoiceNo: body.invoiceNo || null, lines: JSON.stringify(arrived), total } });
      if (purchase.supplierId) await tx.supplier.update({ where: { id: purchase.supplierId }, data: { balance: { increment: round2(total - body.paidAmount) } } });
      if (body.paidAmount > 0) {
        await tx.expense.create({
          data: {
            restaurantId: settings.restaurantId,
            date,
            category: "Supplier payment",
            amount: round2(body.paidAmount),
            method: body.paidMethod,
            paidTo: purchase.supplierName,
            notes: `Purchase #${purchase.number}${body.invoiceNo ? `, bill ${body.invoiceNo}` : ""}`,
            supplierId: purchase.supplierId,
            createdById: user.id,
            createdByName: user.name,
          },
        });
      }
    });
    await logActivity(
      user,
      "Received purchase",
      `#${purchase.number} from ${purchase.supplierName}: ${formatCurrency(total, settings.currency)}${body.paidAmount ? `, paid ${formatCurrency(body.paidAmount, settings.currency)} by ${label(body.paidMethod)}` : ", not paid yet"}`
    );
    return NextResponse.json({ success: true, total });
  });
}
