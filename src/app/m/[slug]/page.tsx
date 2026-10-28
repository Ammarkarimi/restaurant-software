import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { runForRestaurant } from "@/lib/db";
import { publicLogoUrl } from "@/lib/settings";
import { findPublicRestaurant, findRestaurantBySlug, publicMenu, tableForToken } from "@/lib/public-menu";
import { GuestMenu } from "./guest-menu";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string; order?: string; kiosk?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { order, kiosk } = await searchParams;
  const found = await findRestaurantBySlug(slug);
  const what = order || kiosk ? "Order online" : "Menu";
  return { title: found ? `${found.settings.restaurantName} · ${what}` : what, robots: { index: false, follow: false } };
}

/**
 * The menu guests open from a QR code. With a table QR (?t=…) they can also order, call a waiter and pay.
 * ?order=1 is the restaurant's own online ordering link (pickup / delivery), ?kiosk=1 the self-order screen in the shop.
 */
export default async function GuestMenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t, order, kiosk } = await searchParams;
  const selfOrder = order === "1" || kiosk === "1";
  const found = selfOrder ? await findRestaurantBySlug(slug) : await findPublicRestaurant(slug);
  if (!found || (selfOrder && !found.settings.onlineOrderingEnabled)) notFound();
  const { settings } = found;
  const { menu, table } = await runForRestaurant(found.restaurant.id, async () => {
    const table = selfOrder ? null : await tableForToken(t);
    const context = selfOrder ? { type: "takeaway", source: "website" } : { area: table?.area, type: "dine_in", source: "qr" };
    return { table, menu: await publicMenu(slug, context, settings.timezone) };
  });
  const taxName = settings.taxMode === "gst" ? "GST" : settings.taxName;

  return (
    <GuestMenu
      slug={slug}
      restaurant={{
        name: settings.restaurantName,
        address: [settings.address, settings.city].filter(Boolean).join(", "),
        phone: settings.phone,
        logoUrl: publicLogoUrl(slug, settings),
        currency: settings.currency,
        taxNote: settings.taxMode === "none" ? null : settings.pricesIncludeTax ? `Prices include ${taxName}` : `${taxName} is added to the bill`,
      }}
      categories={menu.categories}
      addonGroups={menu.addonGroups}
      table={table ? { token: t!, name: table.name } : null}
      mode={kiosk === "1" ? "kiosk" : order === "1" ? "online" : table ? "table" : "menu"}
      ordering={selfOrder || (settings.qrOrderingEnabled && !!table)}
      online={{
        delivery: settings.onlineDeliveryEnabled,
        minOrder: settings.onlineMinOrder,
        packingCharge: settings.packingCharge,
        deliveryCharge: settings.deliveryCharge,
        timezone: settings.timezone,
      }}
    />
  );
}
