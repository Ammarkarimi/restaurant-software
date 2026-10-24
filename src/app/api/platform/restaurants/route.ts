import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { fail } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { generatePassword, withPlatform } from "@/lib/platform";
import { assertEmailFree, chooseSlug, currentMonth, linkOwnersTo, platformOverview, restaurantFields } from "@/lib/platform-restaurants";

export async function GET() {
  return withPlatform(async () => NextResponse.json(await platformOverview()));
}

const createSchema = z.object({
  ...restaurantFields,
  billingStart: restaurantFields.billingStart.optional(),
  ownerName: z.string().trim().max(80).optional(),
  ownerEmail: z.string().trim().toLowerCase().optional(),
  password: z.string().trim().max(100).optional(),
  // Another outlet of an owner who already has a restaurant: no new sign-in, their account gets access.
  sameOwnerAs: z.string().optional().nullable(),
});

/** Creates a restaurant, its settings and the owner's sign-in. Returns the sign-in details once. */
export async function POST(request: NextRequest) {
  return withPlatform(async () => {
    const body = createSchema.parse(await request.json());
    const existingOwner = body.sameOwnerAs
      ? await rawPrisma.restaurant.findUnique({ where: { id: body.sameOwnerAs }, select: { id: true, contactName: true, contactPhone: true, contactEmail: true } })
      : null;
    if (body.sameOwnerAs && !existingOwner) fail("Choose the owner's existing restaurant");
    if (!existingOwner) {
      if (!body.ownerName) fail("Owner name is required");
      if (!body.ownerEmail || !z.string().email().safeParse(body.ownerEmail).success) fail("Please enter the owner's email (used to sign in)");
      if (body.password && body.password.length < 8) fail("Password must be at least 8 characters (or leave it empty to create one automatically)");
      await assertEmailFree(body.ownerEmail);
    }
    const slug = await chooseSlug(body.name);
    const password = existingOwner ? null : body.password || generatePassword();
    const passwordHash = password ? await hashPassword(password) : null;

    const restaurant = await rawPrisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          name: body.name,
          slug,
          city: body.city || null,
          contactName: body.contactName || body.ownerName || existingOwner?.contactName || null,
          contactPhone: body.contactPhone || existingOwner?.contactPhone || null,
          contactEmail: body.contactEmail || body.ownerEmail || existingOwner?.contactEmail || null,
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
          phone: body.contactPhone || existingOwner?.contactPhone || null,
          email: body.contactEmail || body.ownerEmail || existingOwner?.contactEmail || null,
        },
      });
      if (passwordHash) {
        const owner = await tx.staff.create({
          data: { restaurantId: created.id, name: body.ownerName!, email: body.ownerEmail!, role: "admin", passwordHash },
        });
        await tx.activityLog.create({
          data: { restaurantId: created.id, staffName: "Software provider", action: "Restaurant account created", details: `Owner sign-in for ${owner.name}` },
        });
      }
      return created;
    });

    if (existingOwner) {
      const owners = await linkOwnersTo(restaurant.id, existingOwner.id);
      await rawPrisma.activityLog.create({
        data: { restaurantId: restaurant.id, staffName: "Software provider", action: "Restaurant account created", details: `Managed by ${owners.map((o) => o.name).join(", ")} (another outlet)` },
      });
      return NextResponse.json({ restaurant, login: null, linkedOwners: owners.map((o) => ({ name: o.name, email: o.email })) }, { status: 201 });
    }
    return NextResponse.json({ restaurant, login: { email: body.ownerEmail, password } }, { status: 201 });
  });
}
