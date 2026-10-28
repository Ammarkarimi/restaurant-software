import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicLogoUrl } from "@/lib/settings";
import { findRestaurantBySlug } from "@/lib/public-menu";
import { addDays, todayKey } from "@/lib/dates";
import { BookingForm } from "./booking-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await findRestaurantBySlug(slug);
  return { title: found ? `Book a table · ${found.settings.restaurantName}` : "Book a table" };
}

/** The restaurant's table booking link, for Instagram, Google Maps or WhatsApp. */
export default async function BookingPage({ params }: Props) {
  const { slug } = await params;
  const found = await findRestaurantBySlug(slug);
  if (!found || !found.settings.onlineBookingEnabled) notFound();
  const { settings } = found;
  const today = todayKey(settings.timezone);
  return (
    <BookingForm
      slug={slug}
      restaurant={{ name: settings.restaurantName, address: [settings.address, settings.city].filter(Boolean).join(", "), phone: settings.phone, logoUrl: publicLogoUrl(slug, settings) }}
      today={today}
      lastDay={addDays(today, 60)}
    />
  );
}
