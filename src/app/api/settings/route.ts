import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings, publicSettings } from "@/lib/settings";
import { billTemplateSchema } from "@/lib/bill-template";
import { TAX_MODES } from "@/lib/utils";

export async function GET() {
  return withAuth(async () => NextResponse.json({ settings: publicSettings(await getSettings()) }));
}

const optional = (max: number) => z.string().trim().max(max).nullable().optional();

const schema = z
  .object({
    restaurantName: z.string().trim().min(1, "Restaurant name is required").max(120),
    legalName: optional(160),
    address: optional(300),
    city: optional(80),
    phone: optional(40),
    email: z.string().trim().email("Email is not valid").or(z.literal("")).nullable().optional(),
    gstin: optional(20),
    fssai: optional(20),
    currency: z.string().trim().length(3, "Use a 3-letter currency code like INR"),
    timezone: z.string().trim().min(1).max(60),
    taxMode: z.enum(TAX_MODES),
    taxName: z.string().trim().min(1).max(20),
    defaultTaxRate: z.coerce.number().min(0).max(100),
    pricesIncludeTax: z.boolean(),
    serviceChargePercent: z.coerce.number().min(0).max(50),
    packingCharge: z.coerce.number().min(0).max(100_000),
    deliveryCharge: z.coerce.number().min(0).max(100_000),
    roundOff: z.boolean(),
    billPrefix: z.string().trim().max(12),
    upiId: z
      .string()
      .trim()
      .max(80)
      .regex(/^$|^[\w.\-]{2,}@[\w.\-]{2,}$/, "UPI ID looks like name@bank")
      .nullable()
      .optional(),
    loyaltyEnabled: z.boolean(),
    loyaltyEarnPercent: z.coerce.number().min(0).max(100),
    loyaltyMinRedeem: z.coerce.number().int().min(0).max(1_000_000),
    qrMenuEnabled: z.boolean(),
    qrOrderingEnabled: z.boolean(),
    kitchenStations: z
      .array(z.string().trim().min(1, "A station needs a name").max(30))
      .max(12, "At most 12 stations")
      .refine((a) => new Set(a.map((x) => x.toLowerCase())).size === a.length, "Two stations have the same name")
      .transform((a) => JSON.stringify(a)),
    billTemplate: billTemplateSchema,
  })
  .partial();

const NULLABLE = new Set(["legalName", "address", "city", "phone", "email", "gstin", "fssai", "upiId"]);

export async function PATCH(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = schema.parse(await request.json());
    if (body.timezone) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: body.timezone });
      } catch {
        body.timezone = undefined;
      }
    }
    const current = await getSettings();
    const { billTemplate, ...rest } = body;
    // Optional details cleared in the form are stored as empty (null); required text such as the bill prefix may be "".
    const blankToNull = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === "" && NULLABLE.has(k) ? null : v]));
    const updated = await prisma.restaurantSettings.update({
      where: { id: current.id },
      data: {
        ...blankToNull,
        ...(rest.currency && { currency: rest.currency.toUpperCase() }),
        ...(billTemplate && { billTemplate: JSON.stringify(billTemplate) }),
      },
    });
    const what = [billTemplate && "bill design", Object.keys(rest).length && "restaurant details"].filter(Boolean).join(" and ");
    await logActivity(user, "Changed settings", what || undefined);
    return NextResponse.json({ settings: publicSettings(updated) });
  });
}
