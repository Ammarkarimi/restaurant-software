import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/phone";
import { enquiryEmail, leadEmail, sendEmail } from "@/lib/mail";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: z.string().trim().min(6, "Please enter your phone number").max(20),
  restaurantName: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
  website: z.string().optional(), // left empty by people, filled in by spam bots
});

/** "Ask for a free demo" on the landing page. Saved for the software provider to follow up in /platform, and emailed to them. */
export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`lead:${clientIp(request.headers)}`, 5, 60 * 60_000)) fail("Thanks — we already have your details. We'll call you soon.", 429);
    const body = schema.parse(await request.json());
    if (body.website) return NextResponse.json({ ok: true });
    if (!normalizePhone(body.phone)) fail("Please enter a valid phone number");
    const lead = await rawPrisma.lead.create({
      data: { name: body.name, phone: body.phone, restaurantName: body.restaurantName || null, city: body.city || null, message: body.message || null },
    });
    // After the reply, so the visitor never waits for (or sees a failure of) the email.
    const email = enquiryEmail();
    if (email.ready) {
      const siteUrl = request.nextUrl.origin;
      after(() => sendEmail({ to: email.to!, ...leadEmail(lead, siteUrl) }).catch((e) => console.error("Enquiry email failed:", e)));
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
