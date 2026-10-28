import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, runForRestaurant } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findRestaurantBySlug } from "@/lib/public-menu";
import { normalizePhone } from "@/lib/phone";
import { buildLines, defaultCharges, itemSummary, loadOrder, nextNumber, orderRulesFrom, saveTotals, totalsOf } from "@/lib/orders";
import { orderTrackToken } from "@/lib/share";
import { formatCurrency } from "@/lib/utils";

const item = z.object({
  menuItemId: z.string().min(1).max(40),
  variant: z.string().trim().max(40).optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(20),
  note: z.string().trim().max(120).optional().nullable(),
  addons: z.array(z.object({ groupId: z.string().min(1).max(40), name: z.string().trim().min(1).max(60) })).max(20).default([]),
});

const schema = z.object({
  // kiosk = the self-order screen in the restaurant: takeaway, name and phone optional
  mode: z.enum(["online", "kiosk"]).default("online"),
  type: z.enum(["takeaway", "delivery"]),
  name: z.string().trim().max(60).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  // ISO time asked for pickup / delivery; empty = as soon as possible
  scheduledFor: z.string().datetime().optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
  items: z.array(item).min(1, "Add something to your order").max(40),
});

/**
 * An order from the restaurant's own link (or kiosk). It arrives as "new" on the Tables screen;
 * staff accept it by sending it to the kitchen, so a prank order never reaches the kitchen on its own.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!rateLimit(`online-order:${clientIp(request.headers)}`, 6, 30 * 60_000)) fail("Too many orders from this phone. Please call the restaurant.", 429);
    const body = schema.parse(await request.json());
    const found = await findRestaurantBySlug(slug);
    if (!found || !found.settings.onlineOrderingEnabled) fail("Online ordering is not available right now", 404);
    const settings = found.settings;
    const kiosk = body.mode === "kiosk";
    if (!kiosk) {
      if (!body.name?.trim()) fail("Please enter your name");
      if (!normalizePhone(body.phone)) fail("Please enter a valid phone number, so the restaurant can reach you");
      if (!rateLimit(`online-order-phone:${normalizePhone(body.phone)}`, 5, 30 * 60_000)) fail("You have several orders already. Please call the restaurant.", 429);
    }
    if (body.type === "delivery") {
      if (kiosk || !settings.onlineDeliveryEnabled) fail("Delivery is not available. Please choose pickup.");
      if (!body.address?.trim()) fail("Please enter the delivery address");
    }
    if (body.scheduledFor && new Date(body.scheduledFor).getTime() > Date.now() + 3 * 24 * 3600_000) fail("Choose a time in the next 3 days");

    return await runForRestaurant(found.restaurant.id, async () => {
      const guestName = body.name?.trim() || (kiosk ? "Kiosk" : "Guest");
      const order = await prisma.$transaction(async (tx) => {
        const lines = (await buildLines(tx, body.items, settings, { type: body.type, source: "website", guest: true })).map((l) => ({ ...l, byGuest: true }));
        const itemsTotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
        if (!kiosk && itemsTotal < settings.onlineMinOrder) fail(`The minimum order is ${formatCurrency(settings.onlineMinOrder, settings.currency)}`);
        const created = await tx.order.create({
          data: {
            restaurantId: settings.restaurantId,
            number: await nextNumber(tx, "orderSeq"),
            type: body.type,
            source: "website",
            customerName: guestName,
            customerPhone: body.phone || null,
            customerAddress: body.type === "delivery" ? body.address || null : null,
            notes: [kiosk ? "Self-order kiosk" : null, body.note || null].filter(Boolean).join(" · ") || null,
            scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
            createdByName: kiosk ? "Kiosk" : `Online: ${guestName}`,
            ...orderRulesFrom(settings),
            ...defaultCharges(body.type, settings),
            items: { create: lines.map((l) => ({ ...l, restaurantId: settings.restaurantId })) },
          },
        });
        return saveTotals(tx, await loadOrder(created.id, tx));
      });
      const totals = totalsOf(order);
      await logActivity({ id: null, name: kiosk ? "Kiosk" : `Online: ${guestName}` }, kiosk ? "Kiosk order" : "Online order", `#${order.number} (${body.type}): ${itemSummary(order.items)}`);
      return NextResponse.json({ ok: true, orderNumber: order.number, total: totals.total, track: orderTrackToken(order.id) }, { status: 201 });
    });
  } catch (error) {
    return handleError(error);
  }
}
