import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { withPhoto } from "@/lib/menu-photos";

/** The whole menu: categories in order with their items, add-on groups and special price lists. */
export async function GET() {
  return withAuth(async () => {
    const [categories, addonGroups, priceLists] = await Promise.all([
      prisma.menuCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
      }),
      prisma.addonGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      prisma.priceList.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ]);
    return NextResponse.json({
      categories: categories.map((c) => ({ ...c, items: c.items.map(withPhoto) })),
      addonGroups,
      priceLists,
    });
  }, { kitchen: true });
}
