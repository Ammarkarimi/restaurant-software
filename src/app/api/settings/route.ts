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
    roundOff: z.boolean(),
    billPrefix: z.string().trim().max(12),
    upiId: z
      .string()
      .trim()
      .max(80)
      .regex(/^$|^[\w.\-]{2,}@[\w.\-]{2,}$/, "UPI ID looks like name@bank")
      .nullable()
      .optional(),
    billTemplate: billTemplateSchema,
  })
  .partial();

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
    const blankToNull = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === "" ? null : v]));
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
