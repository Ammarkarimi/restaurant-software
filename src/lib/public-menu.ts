import { prisma, rawPrisma, runForRestaurant } from "./db";
import { getSettings } from "./settings";

/** A restaurant whose QR menu guests may open, with its settings. Null when it is paused or the QR menu is off. */
export async function findPublicRestaurant(slug: string) {
  const restaurant = await rawPrisma.restaurant.findUnique({ where: { slug }, select: { id: true, slug: true, status: true } });
  if (!restaurant || restaurant.status !== "active") return null;
  const settings = await runForRestaurant(restaurant.id, () => getSettings());
  if (!settings.qrMenuEnabled) return null;
  return { restaurant, settings };
}

/** The table a QR code belongs to, inside runForRestaurant(). */
export async function tableForToken(token: string | null | undefined) {
  if (!token || token.length > 64) return null;
  return prisma.diningTable.findFirst({ where: { qrToken: token, active: true } });
}

/** Categories and dishes guests can see: hidden categories are left out, sold-out dishes stay (marked). */
export async function publicMenu() {
  const categories = await prisma.menuCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, description: true, price: true, variants: true, foodType: true, available: true },
      },
    },
  });
  return categories.filter((c) => c.items.length > 0).map((c) => ({ id: c.id, name: c.name, items: c.items }));
}

export type PublicCategory = Awaited<ReturnType<typeof publicMenu>>[number];
