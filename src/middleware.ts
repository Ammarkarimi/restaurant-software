import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, PLATFORM_COOKIE_NAME, verifyPlatformToken, verifySessionToken } from "@/lib/session";

// Pages and APIs anyone can open without signing in.
// "/b" is a bill sent to a guest on WhatsApp, "/m" the QR / online ordering menu, "/r" the table booking link,
// "/o" a guest's order tracking page, "/api/public" what those pages load.
// "/api/cron" the daily job, which checks its own secret.
const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout", "/b", "/m", "/r", "/o", "/api/public", "/api/cron", "/welcome"];

// The software provider's panel. It has its own sign-in; restaurant accounts never get in.
const platformPaths = ["/platform", "/api/platform"];
const platformPublicPaths = ["/platform/login", "/api/platform/login"];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function noIndex(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

/** Biggest request accepted: a 3 MB dish photo or a few menu photos for import, with room to spare. */
const MAX_BODY_BYTES = 14 * 1024 * 1024;
const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * A change (POST, PUT…) made from a browser must come from a Billspoon page itself: a browser always
 * says which site a request comes from (Origin). Another website trying to use a signed-in cashier's
 * cookie is refused. Server-to-server calls (Razorpay, UrbanPiper, the daily job) send no Origin.
 */
function fromOtherSite(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return origin === "null";
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "That is too much data to send at once." }, { status: 413 });
    }
    if (WRITES.has(request.method) && fromOtherSite(request)) {
      return NextResponse.json({ error: "Not allowed from another website." }, { status: 403 });
    }
  }

  if (matches(pathname, platformPaths)) {
    const token = request.cookies.get(PLATFORM_COOKIE_NAME)?.value;
    const session = token ? await verifyPlatformToken(token) : null;
    if (matches(pathname, platformPublicPaths)) {
      if (pathname === "/platform/login" && session) return NextResponse.redirect(new URL("/platform", request.url));
      return noIndex(NextResponse.next());
    }
    if (!session && pathname.startsWith("/api/")) {
      return noIndex(NextResponse.json({ error: "Please sign in again." }, { status: 401 }));
    }
    if (!session) return NextResponse.redirect(new URL("/platform/login", request.url));
    return noIndex(NextResponse.next());
  }

  if (matches(pathname, publicPaths) || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    if (pathname === "/login") {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      if (token && (await verifySessionToken(token))) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  if (!session) {
    // Visitors who are not signed in see the landing page at the site's address.
    if (pathname === "/") return NextResponse.rewrite(new URL("/welcome", request.url));
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icons/|landing/|manifest.webmanifest|sw.js).*)"],
};
