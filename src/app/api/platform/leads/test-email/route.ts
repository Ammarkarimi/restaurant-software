import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { enquiryEmail, leadEmail, sendEmail } from "@/lib/mail";
import { withPlatform } from "@/lib/platform";

/** Sends a sample enquiry email, so the provider can check the email set-up works. */
export async function POST(request: NextRequest) {
  return withPlatform(async () => {
    const { to, ready } = enquiryEmail();
    if (!ready || !to) fail("Email is not set up yet. Add RESEND_API_KEY and ENQUIRY_EMAIL_TO in the hosting settings, then redeploy.");
    const sample = { name: "Test enquiry", phone: "9876500000", restaurantName: "Sample Restaurant", city: "Pune", message: "This is a test email from your owner panel.", createdAt: new Date() };
    const email = leadEmail(sample, request.nextUrl.origin);
    await sendEmail({ to, ...email, subject: `[Test] ${email.subject}` }).catch((e) => fail((e as Error).message, 502));
    return NextResponse.json({ ok: true, to });
  });
}
