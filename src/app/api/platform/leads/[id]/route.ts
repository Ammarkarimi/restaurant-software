import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { fail } from "@/lib/api";
import { withPlatform } from "@/lib/platform";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(["new", "contacted", "won", "lost"]).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    if (!(await rawPrisma.lead.findUnique({ where: { id } }))) fail("Enquiry not found", 404);
    const lead = await rawPrisma.lead.update({ where: { id }, data: { ...(body.status && { status: body.status }), ...(body.notes !== undefined && { notes: body.notes || null }) } });
    return NextResponse.json({ lead });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withPlatform(async () => {
    const { id } = await params;
    if (!(await rawPrisma.lead.findUnique({ where: { id } }))) fail("Enquiry not found", 404);
    await rawPrisma.lead.delete({ where: { id } });
    return NextResponse.json({ success: true });
  });
}
