// The software provider's own access to /platform: create restaurants, hand out
// sign-ins and track monthly subscription payments.
//
// There is exactly one provider account and it is not stored in the database:
// it comes from the PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD environment
// variables, so nobody can create or change it from inside the app. Without
// both variables /platform stays locked.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { handleError } from "./api";
import {
  PLATFORM_COOKIE_NAME,
  createPlatformToken,
  verifyPlatformToken,
  type PlatformSession,
} from "./session";

export { PLATFORM_COOKIE_NAME, PLATFORM_SESSION_DURATION } from "./session";

/** Which day it is for the provider, used to decide which month is "this month". */
export const PLATFORM_TIMEZONE = process.env.PLATFORM_TIMEZONE || "Asia/Kolkata";

export const MIN_PLATFORM_PASSWORD = 10;

function credentials() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password || password.length < MIN_PLATFORM_PASSWORD) return null;
  return { email, password };
}

export function platformConfigured() {
  return credentials() !== null;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/** Ties a session to the current password, so changing the password signs out old sessions. */
function sessionKey(email: string, password: string) {
  return sha256(`platform-session:${email}:${password}`).toString("hex").slice(0, 32);
}

export function checkPlatformLogin(email: string, password: string): PlatformSession | null {
  const expected = credentials();
  if (!expected) return null;
  // Compare fixed-length digests in constant time so response timing reveals nothing.
  const emailOk = timingSafeEqual(sha256(email.trim().toLowerCase()), sha256(expected.email));
  const passwordOk = timingSafeEqual(sha256(password), sha256(expected.password));
  if (!emailOk || !passwordOk) return null;
  return { email: expected.email, key: sessionKey(expected.email, expected.password) };
}

export async function createPlatformSessionToken(session: PlatformSession) {
  return createPlatformToken(session);
}

export async function getPlatformSession(): Promise<PlatformSession | null> {
  const expected = credentials();
  if (!expected) return null;
  const token = (await cookies()).get(PLATFORM_COOKIE_NAME)?.value;
  const session = token ? await verifyPlatformToken(token) : null;
  if (!session) return null;
  if (session.email !== expected.email || session.key !== sessionKey(expected.email, expected.password)) return null;
  return session;
}

/** Runs a /api/platform handler only for the signed-in provider. */
export async function withPlatform<T>(handler: (session: PlatformSession) => Promise<T>): Promise<T | NextResponse> {
  try {
    const session = await getPlatformSession();
    if (!session) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    return await handler(session);
  } catch (error) {
    return handleError(error);
  }
}

const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i

/** An easy-to-type temporary password like "kq7m-29xh-ptd4". */
export function generatePassword() {
  const group = () => Array.from({ length: 4 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

/** "Sunrise Residency, Goa" -> "sunrise-residency-goa" */
export function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)
      .replace(/-+$/g, "") || "restaurant"
  );
}
