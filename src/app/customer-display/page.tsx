import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { runForRestaurant } from "@/lib/db";
import { getSettings, logoUrl } from "@/lib/settings";
import { CustomerScreen } from "./customer-screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order" };

/** A second screen facing the guest at the counter: their order as it is entered, the total and a UPI QR. */
export default async function CustomerDisplayPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");
  const settings = await runForRestaurant(session.restaurantId, () => getSettings());
  return <CustomerScreen restaurantName={settings.restaurantName} logoUrl={logoUrl(settings)} />;
}
