import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { runForRestaurant } from "@/lib/db";
import { publicLogoUrl } from "@/lib/settings";
import { findPublicRestaurant, publicMenu, tableForToken } from "@/lib/public-menu";
import { GuestMenu } from "./guest-menu";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await findPublicRestaurant(slug);
  return { title: found ? `${found.settings.restaurantName} · Menu` : "Menu", robots: { index: false, follow: false } };
}

/** The menu guests open from a QR code. With a table QR (?t=…) they can also order and call a waiter. */
export default async function GuestMenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t } = await searchParams;
  const found = await findPublicRestaurant(slug);
  if (!found) notFound();
  const { settings } = found;
  const { categories, table } = await runForRestaurant(found.restaurant.id, async () => ({
    categories: await publicMenu(),
    table: await tableForToken(t),
  }));

  return (
    <GuestMenu
      slug={slug}
      restaurant={{
        name: settings.restaurantName,
        address: [settings.address, settings.city].filter(Boolean).join(", "),
        phone: settings.phone,
        logoUrl: publicLogoUrl(slug, settings),
        currency: settings.currency,
        taxNote:
          settings.taxMode === "none"
            ? null
            : settings.pricesIncludeTax
              ? `Prices include ${settings.taxMode === "gst" ? "GST" : settings.taxName}`
              : `${settings.taxMode === "gst" ? "GST" : settings.taxName} is added to the bill`,
      }}
      categories={categories}
      table={table ? { token: t!, name: table.name } : null}
      ordering={settings.qrOrderingEnabled && !!table}
    />
  );
}
