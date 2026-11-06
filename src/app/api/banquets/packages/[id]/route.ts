import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { banquetPackageSchema } from "@/lib/banquet";

/** Edit a package (switch it off instead of deleting). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = banquetPackageSchema.parse(await request.json());
    if (!(await prisma.banquetPackage.findFirst({ where: { id } }))) fail("Package not found", 404);
    const pkg = await prisma.banquetPackage.update({ where: { id }, data: { ...body, menu: JSON.stringify(body.menu) } });
    await logActivity(user, "Edited banquet package", pkg.name);
    return NextResponse.json({ package: pkg });
  });
}
