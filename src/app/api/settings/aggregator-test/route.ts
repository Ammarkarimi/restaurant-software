import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { createAggregatorOrder, parseUrbanPiperOrder } from "@/lib/aggregator";

/** Makes a pretend Zomato order with two dishes from the menu, to see how app orders arrive. */
export async function POST() {
  return withAdmin(async () => {
    const settings = await getSettings();
    const dishes = await prisma.menuItem.findMany({ where: { available: true }, take: 2, orderBy: { sortOrder: "asc" } });
    if (!dishes.length) fail("Add dishes to the menu first.");
    const id = `TEST${Date.now().toString().slice(-7)}`;
    const sample = {
      customer: { name: "Test Customer", phone: "9000000000", address: { line_1: "12 Test Street", sub_locality: "Near Park", city: settings.city ?? "" } },
      order: {
        details: { id, channel: "zomato", order_type: "delivery", instructions: "Test order — you can cancel it", payable_amount: dishes.reduce((s, d) => s + d.price, 0), charges: [], ext_platforms: [{ id, name: "zomato", discounts: [], extras: { order_otp: "1234", cash_to_be_collected: 0 } }] },
        items: dishes.map((d) => ({ title: d.name, merchant_ref_id: d.id, price: d.price, quantity: 1, total: d.price, food_type: d.foodType === "non_veg" ? "2" : d.foodType === "egg" ? "3" : "1", options_to_add: [] })),
        payment: [{ option: "prepaid" }],
      },
    };
    const { order } = await createAggregatorOrder(settings, parseUrbanPiperOrder(sample));
    return NextResponse.json({ orderId: order.id, number: order.number });
  });
}
