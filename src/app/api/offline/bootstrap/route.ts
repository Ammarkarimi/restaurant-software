import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { parseBillTemplate } from "@/lib/bill-template";
import { parseVariants } from "@/lib/menu";
import type { OfflineBootstrap } from "@/lib/offline";

/** Everything a counter needs to keep billing when the internet goes: menu, prices, tax rules, tables. */
export async function GET() {
  return withAuth(async (user) => {
    const settings = await getSettings();
    const [items, tables] = await Promise.all([
      prisma.menuItem.findMany({ where: { category: { active: true } }, include: { category: { select: { name: true, sortOrder: true } } }, orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
      prisma.diningTable.findMany({ where: { active: true }, orderBy: [{ area: "asc" }, { sortOrder: "asc" }, { name: "asc" }], select: { name: true } }),
    ]);
    const t = parseBillTemplate(settings.billTemplate);
    const data: OfflineBootstrap = {
      savedAt: new Date().toISOString(),
      restaurant: {
        name: settings.restaurantName,
        address: settings.address,
        phone: settings.phone,
        gstin: settings.gstin,
        fssai: settings.fssai,
        currency: settings.currency,
        timezone: settings.timezone,
        billPrefix: settings.billPrefix,
        footer: t.footerText,
      },
      rules: {
        taxMode: settings.taxMode,
        taxName: settings.taxName,
        pricesIncludeTax: settings.pricesIncludeTax,
        serviceChargePercent: settings.serviceChargePercent,
        roundOff: settings.roundOff,
        packingCharge: settings.packingCharge,
        deliveryCharge: settings.deliveryCharge,
        chargeTaxRate: settings.defaultTaxRate,
      },
      menu: items.map((i) => ({
        id: i.id,
        name: i.name,
        shortCode: i.shortCode,
        category: i.category.name,
        price: i.price,
        variants: parseVariants(i.variants),
        foodType: i.foodType,
        taxRate: i.taxRate ?? settings.defaultTaxRate,
        available: i.available,
      })),
      tables: tables.map((x) => x.name),
      user: { name: user.name },
    };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  });
}
