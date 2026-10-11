import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  PLATFORM_COOKIE_NAME,
  PLATFORM_SESSION_DURATION,
  checkPlatformLogin,
  createPlatformSessionToken,
  platformConfigured,
} from "@/lib/platform";

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`platform-login:${clientIp(request.headers)}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
    }
    if (!platformConfigured()) {
      return NextResponse.json(
        {
          error:
            "The owner sign-in is not set up yet. Add PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD (at least 10 characters) in your hosting settings, then redeploy.",
        },
        { status: 503 }
      );
    }
    const body = await request.json();
    const session = checkPlatformLogin(String(body.email || ""), String(body.password || ""));
    if (!session) return NextResponse.json({ error: "Email or password is not correct" }, { status: 401 });

    const response = NextResponse.json({ success: true });
    response.cookies.set(PLATFORM_COOKIE_NAME, await createPlatformSessionToken(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: PLATFORM_SESSION_DURATION,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not sign in. Please try again." }, { status: 500 });
  }
}
