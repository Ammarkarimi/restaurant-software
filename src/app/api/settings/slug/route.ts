import { NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";

/** The restaurant's short name in its public links (/m/…, /r/…). */
export async function GET() {
  return withAdmin(async (user) => {
    const r = await rawPrisma.restaurant.findUnique({ where: { id: user.restaurantId }, select: { slug: true } });
    return NextResponse.json({ slug: r?.slug ?? null });
  });
}
