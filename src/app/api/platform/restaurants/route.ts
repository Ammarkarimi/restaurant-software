import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { fail } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { generatePassword, withPlatform } from "@/lib/platform";
import { assertEmailFree, chooseSlug, currentMonth, platformOverview, restaurantFields } from "@/lib/platform-restaurants";

export async function GET() {
  return withPlatform(async () => NextResponse.json(await platformOverview()));
}

const createSchema = z.object({
  ...restaurantFields,
  billingStart: restaurantFields.billingStart.optional(),
  ownerName: z.string().trim().min(1, "Owner name is required").max(80),
  ownerEmail: z.string().trim().toLowerCase().email("Please enter the owner's email (used to sign in)"),
  password: z.string().trim().max(100).optional(),
});

/** Creates a restaurant, its settings and the owner's sign-in. Returns the sign-in details once. */
export async function POST(request: NextRequest) {
  return withPlatform(async () => {
    const body = createSchema.parse(await request.json());
    if (body.password && body.password.length < 8) {
      fail("Password must be at least 8 characters (or leave it empty to create one automatically)");
    }
    await assertEmailFree(body.ownerEmail);
    const slug = await chooseSlug(body.name);
    const password = body.password || generatePassword();
    const passwordHash = await hashPassword(password);

    const restaurant = await rawPrisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          name: body.name,
          slug,
          city: body.city || null,
          contactName: body.contactName || body.ownerName,
          contactPhone: body.contactPhone || null,
          contactEmail: body.contactEmail || body.ownerEmail,
          monthlyFee: body.monthlyFee,
          billingStart: body.billingStart ?? currentMonth(),
          notes: body.notes || null,
        },
      });
      await tx.restaurantSettings.create({
        data: {
          restaurantId: created.id,
          restaurantName: body.name,
          city: body.city || null,
          phone: body.contactPhone || null,
          email: body.contactEmail || body.ownerEmail,
        },
      });
      const owner = await tx.staff.create({
        data: { restaurantId: created.id, name: body.ownerName, email: body.ownerEmail, role: "admin", passwordHash },
      });
      await tx.activityLog.create({
        data: {
          restaurantId: created.id,
          staffName: "Software provider",
          action: "Restaurant account created",
          details: `Owner sign-in for ${owner.name}`,
        },
      });
      return created;
    });

    return NextResponse.json({ restaurant, login: { email: body.ownerEmail, password } }, { status: 201 });
  });
}
