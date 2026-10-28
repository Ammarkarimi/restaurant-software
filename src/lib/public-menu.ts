import { prisma, rawPrisma, runForRestaurant } from "./db";
import { getSettings } from "./settings";
import { groupsForItem, parseVariants } from "./menu";
import { publicPhotoUrl } from "./menu-photos";
import { activeLists, menuPrice } from "./pricing";

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

/** Categories and dishes guests can see: hidden categories and staff-only dishes are left out, sold-out dishes stay (marked). */
export async function publicMenu(slug: string, context: { area?: string | null; type: string; source: string }, timezone: string) {
  const [categories, groups, lists] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        items: {
          where: { showOnline: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, categoryId: true, name: true, description: true, price: true, variants: true, foodType: true, available: true, addonGroupIds: true, imagePath: true, updatedAt: true },
        },
      },
    }),
    prisma.addonGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, minSelect: true, maxSelect: true, options: true } }),
    prisma.priceList.findMany({ where: { active: true } }),
  ]);
  const inForce = activeLists(lists, { ...context, timezone });
  const used = new Set<string>();
  const menu = categories
    .filter((c) => c.items.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items.map(({ imagePath, updatedAt, addonGroupIds, ...item }) => {
        // Prices as they are right now (special prices, happy hours); the order is priced again when placed.
        const variants = parseVariants(item.variants);
        const priced = variants.map((v) => ({ name: v.name, price: menuPrice(item, v.name, inForce).price ?? v.price }));
        const price = variants.length ? Math.min(...priced.map((v) => v.price)) : (menuPrice(item, null, inForce).price ?? item.price);
        const usual = variants.length ? Math.min(...variants.map((v) => v.price)) : item.price;
        const groupIds = groupsForItem({ addonGroupIds }, groups).map((g) => g.id);
        groupIds.forEach((id) => used.add(id));
        return {
          ...item,
          price,
          variants: JSON.stringify(priced),
          usualPrice: usual !== price ? usual : null,
          addonGroupIds: JSON.stringify(groupIds),
          imageUrl: publicPhotoUrl(slug, { id: item.id, imagePath, updatedAt }),
        };
      }),
    }));
  return { categories: menu, addonGroups: groups.filter((g) => used.has(g.id)) };
}

export type PublicMenu = Awaited<ReturnType<typeof publicMenu>>;
export type PublicCategory = PublicMenu["categories"][number];
