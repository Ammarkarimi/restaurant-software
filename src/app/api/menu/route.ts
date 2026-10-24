import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";

/** The whole menu: categories in order, each with its items. */
export async function GET() {
  return withAuth(async () => {
    const categories = await prisma.menuCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    });
    return NextResponse.json({ categories });
  }, { kitchen: true });
}
