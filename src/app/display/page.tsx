import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { runForRestaurant } from "@/lib/db";
import { getSettings, logoUrl } from "@/lib/settings";
import { TokenScreen } from "./token-screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order status" };

/** Token screen for a TV facing the guests: takeaway and delivery orders being prepared and ready to collect. */
export default async function DisplayPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");
  const settings = await runForRestaurant(session.restaurantId, () => getSettings());
  return <TokenScreen restaurantName={settings.restaurantName} logoUrl={logoUrl(settings)} />;
}
