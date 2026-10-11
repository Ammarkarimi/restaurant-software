import { currentRestaurantId, prisma } from "./db";
import type { SessionUser } from "./session";

/** Records who did what, so the owner can always see the history. Never throws. */
export async function logActivity(user: SessionUser | null, action: string, details?: string) {
  try {
    await prisma.activityLog.create({
      data: {
        restaurantId: currentRestaurantId(),
        staffId: user?.id ?? null,
        staffName: user?.name ?? "Software provider",
        action,
        details: details ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to write activity log", error);
  }
}
