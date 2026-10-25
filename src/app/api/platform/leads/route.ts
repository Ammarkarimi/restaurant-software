import { NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db";
import { withPlatform } from "@/lib/platform";

/** Demo requests from the landing page, newest first. */
export async function GET() {
  return withPlatform(async () => {
    const leads = await rawPrisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    return NextResponse.json({ leads });
  });
}
