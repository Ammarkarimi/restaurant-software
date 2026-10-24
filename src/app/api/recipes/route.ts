import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";

/** Every recipe line, for the Recipes screen. */
export async function GET() {
  return withAdmin(async () => {
    const lines = await prisma.recipeLine.findMany({ select: { id: true, menuItemId: true, variant: true, stockItemId: true, quantity: true } });
    return NextResponse.json({ lines });
  });
}
