import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { runForRestaurant } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { KitchenScreen } from "./kitchen-screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kitchen" };

/** Full-screen kitchen display (KDS) for a screen or tablet in the kitchen. */
export default async function KitchenPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");
  const settings = await runForRestaurant(session.restaurantId, () => getSettings());
  return <KitchenScreen restaurantName={settings.restaurantName} timezone={settings.timezone} userName={session.name} kitchenOnly={session.role === "kitchen"} />;
}
