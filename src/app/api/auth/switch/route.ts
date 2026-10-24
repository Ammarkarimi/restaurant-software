import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, SESSION_DURATION, createSession, getSession, outletsFor } from "@/lib/auth";
import { fail, handleError, unauthorized } from "@/lib/api";
import { runForRestaurant } from "@/lib/db";
import { logActivity } from "@/lib/activity";

/** An owner with several outlets switches to another one. */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const { restaurantId } = z.object({ restaurantId: z.string().min(1) }).parse(await request.json());
    const outlet = (await outletsFor(session.id)).find((o) => o.id === restaurantId);
    if (!outlet) fail("You don't have access to that restaurant", 403);
    const user = { ...session, restaurantId, role: restaurantId === session.restaurantId ? session.role : "admin" };
    const token = await createSession(user);
    await runForRestaurant(restaurantId, () => logActivity(user, "Switched to this outlet"));
    const response = NextResponse.json({ ok: true, outlet });
    response.cookies.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: SESSION_DURATION, path: "/" });
    return response;
  } catch (error) {
    return handleError(error);
  }
}
