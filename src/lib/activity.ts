import { currentRestaurantId, prisma } from "./db";
import type { SessionUser } from "./session";

/** Who did it: a signed-in person, or e.g. a guest ordering from the table QR code (no account). */
type Actor = Pick<SessionUser, "name"> & { id: string | null };

/** Records who did what, so the owner can always see the history. Never throws. */
export async function logActivity(user: Actor | null, action: string, details?: string) {
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
