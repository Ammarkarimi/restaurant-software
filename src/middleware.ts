import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, PLATFORM_COOKIE_NAME, verifyPlatformToken, verifySessionToken } from "@/lib/session";

// Pages and APIs anyone can open without signing in.
// "/b" is a bill sent to a guest on WhatsApp, "/m" the QR menu, "/api/public" what those pages load.
const publicPaths = ["/login", "/api/auth/login", "/b", "/m", "/api/public"];

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icons/|manifest.webmanifest).*)"],
};
