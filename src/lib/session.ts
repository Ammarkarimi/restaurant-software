import { SignJWT, jwtVerify } from "jose";

// Read lazily (not at import time) so a missing secret can never break `next build`;
// it fails at sign-in instead, with a clear message.
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return new TextEncoder().encode(secret || "restaurant-billing-dev-secret");
}

export const COOKIE_NAME = "restaurant-session";
export const SESSION_DURATION = 60 * 60 * 24 * 7;

// The software provider's own sign-in for /platform. A separate cookie and token type,
// so a restaurant account can never open the provider panel and vice versa.
export const PLATFORM_COOKIE_NAME = "platform-session";
export const PLATFORM_SESSION_DURATION = 60 * 60 * 12;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  restaurantId: string;
}

export interface PlatformSession {
  email: string;
  /** Changes when the provider's password changes, which signs out old sessions. */
  key: string;
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    typ: "restaurant",
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: user.restaurantId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.typ === "platform") return null;
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      restaurantId: payload.restaurantId as string,
    };
  } catch {
    return null;
  }
}

export async function createPlatformToken(session: PlatformSession): Promise<string> {
  return new SignJWT({ typ: "platform", email: session.email, key: session.key })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PLATFORM_SESSION_DURATION}s`)
    .sign(getJwtSecret());
}

export async function verifyPlatformToken(token: string): Promise<PlatformSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.typ !== "platform") return null;
    return { email: payload.email as string, key: payload.key as string };
  } catch {
    return null;
  }
}
