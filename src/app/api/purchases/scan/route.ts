import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { menuPhotoReady } from "@/lib/menu-photo-ai";
import { readSupplierBill } from "@/lib/bill-photo-ai";
import { convertQuantity, matchStockItem } from "@/lib/purchases";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 150;

const schema = z.object({
  photos: z
    .array(z.object({ mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().min(100).max(3_000_000) }))
    .min(1, "Add a photo of the bill")
    .max(3, "Add at most 3 photos of one bill"),
});

/**
 * Reads a supplier's bill from photos and matches each line to a stock item and the seller to a
 * supplier. Nothing is saved: the owner checks the lines, then receives them into stock.
 */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    if (!menuPhotoReady()) fail("Reading bills from photos is not switched on yet. Ask your software provider to add the AI key (OPENAI_API_KEY).", 503);
    if (!(await rateLimit(`bill-photo:${user.restaurantId}`, 30, 60 * 60_000))) fail("Too many bills this hour. Please try again later.", 429);
    const body = schema.parse(await request.json());
    let bill;
    try {
      bill = await readSupplierBill(body.photos);
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        console.error("Bill photo AI error", error.status, error.message);
        fail(error.status === 429 || (error.status ?? 0) >= 500 ? "The bill reader is busy. Please try again in a minute." : "The bill could not be read. Please try a clearer photo.", 503);
      }
      throw error;
    }
    if (!bill.lines.length) fail("No items were found on this bill. Please try a clearer, straight photo.");
    const [stock, suppliers] = await Promise.all([
      prisma.stockItem.findMany({ where: { active: true }, select: { id: true, name: true, unit: true, costPerUnit: true } }),
      prisma.supplier.findMany({ where: { active: true }, select: { id: true, name: true, gstin: true, phone: true } }),
    ]);
    const gstin = bill.supplier_gstin.replace(/\s/g, "").toUpperCase();
    const digits = bill.supplier_phone.replace(/\D/g, "").slice(-10);
    const supplier =
      (gstin && suppliers.find((s) => s.gstin?.toUpperCase() === gstin)) ||
      (digits.length === 10 && suppliers.find((s) => s.phone?.replace(/\D/g, "").endsWith(digits))) ||
      (bill.supplier_name && matchStockItem(bill.supplier_name, suppliers)) ||
      null;
    const read = bill.lines.filter((l) => l.name.trim() && (l.quantity > 0 || l.amount > 0));
    const subtotal = read.reduce((sum, l) => sum + (l.amount > 0 ? l.amount : l.rate * (l.quantity > 0 ? l.quantity : 1)), 0);
    // GST on the bill is part of what the stock cost: a restaurant on 5% GST can't claim it back.
    // It is shared over the lines in proportion, when the bill's own total confirms it.
    const tax = bill.tax_total > 0 && subtotal > 0 && (!bill.grand_total || Math.abs(subtotal + bill.tax_total - bill.grand_total) <= Math.max(2, bill.grand_total * 0.01)) ? bill.tax_total : 0;
    const withTax = subtotal > 0 ? (subtotal + tax) / subtotal : 1;
    const lines = read
      .map((l) => {
        const item = matchStockItem(l.name, stock);
        const qty = l.quantity > 0 ? l.quantity : 1;
        const conv = item ? convertQuantity(qty, l.unit, item.unit) : { quantity: qty, converted: false };
        const amount = (l.amount > 0 ? l.amount : l.rate * qty) * withTax;
        return {
          name: l.name.trim().slice(0, 80),
          billQuantity: qty,
          billUnit: l.unit.trim(),
          stockItemId: item?.id ?? null,
          quantity: conv.quantity,
          // Rate in the stock item's unit, so stock value and dish costs stay right.
          rate: conv.quantity > 0 ? Math.round((amount / conv.quantity) * 10000) / 10000 : l.rate,
          amount: Math.round(amount * 100) / 100,
        };
      });
    return NextResponse.json({
      supplier: { id: supplier ? supplier.id : null, name: bill.supplier_name.trim(), phone: bill.supplier_phone.trim(), gstin },
      invoiceNo: bill.invoice_no.trim(),
      invoiceDate: /^\d{4}-\d{2}-\d{2}$/.test(bill.invoice_date) ? bill.invoice_date : "",
      lines,
      tax: bill.tax_total,
      taxIncluded: Math.round(tax * 100) / 100,
      total: bill.grand_total,
      note: bill.unreadable.trim(),
    });
  });
}
