import { NextResponse } from "next/server";
import { PLATFORM_COOKIE_NAME } from "@/lib/platform";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(PLATFORM_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
