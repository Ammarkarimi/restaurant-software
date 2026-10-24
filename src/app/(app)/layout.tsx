import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma, runForRestaurant } from "@/lib/db";
import { getSettings, logoUrl } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { monthLabel, monthOf, subscriptionSummary } from "@/lib/subscription";
import { PLATFORM_TIMEZONE } from "@/lib/platform";
import { AppLayout } from "@/components/layout";

export const dynamic = "force-dynamic";

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "kitchen") redirect("/kitchen");

  const { settings, restaurant } = await runForRestaurant(session.restaurantId, async () => ({
    settings: await getSettings(),
    restaurant: await prisma.restaurant.findUniqueOrThrow({
      where: { id: session.restaurantId },
      include: { subscriptionPayments: { select: { month: true, amount: true, clearsMonth: true } } },
    }),
  }));

  // Owners see a reminder when an earlier month's software subscription is unpaid.
  let subscriptionNotice: string | null = null;
  if (session.role === "admin") {
    const summary = subscriptionSummary(restaurant, restaurant.subscriptionPayments, monthOf(todayKey(PLATFORM_TIMEZONE)));
    if (summary.overdueMonths.length > 0) {
      subscriptionNotice = `Your software subscription for ${summary.overdueMonths.map(monthLabel).join(", ")} is not paid yet. Please pay your software provider to keep using the software without interruption.`;
    }
  }

  return (
    <AppLayout
      user={session}
      settings={{
        restaurantName: settings.restaurantName,
        currency: settings.currency,
        timezone: settings.timezone,
        today: todayKey(settings.timezone),
        logoUrl: logoUrl(settings),
        subscriptionNotice,
      }}
    >
      {children}
    </AppLayout>
  );
}
