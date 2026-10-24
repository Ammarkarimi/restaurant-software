import { createHmac, timingSafeEqual } from "node:crypto";
import { getJwtSecret } from "./session";

// Links to a bill that a guest can open without signing in (sent on WhatsApp).
// The link carries the order id and a signature, so nobody can guess other bills.

function signature(orderId: string) {
  return createHmac("sha256", Buffer.from(getJwtSecret())).update(`bill:${orderId}`).digest("base64url").slice(0, 22);
}

export function billShareToken(orderId: string) {
  return `${orderId}.${signature(orderId)}`;
}

/** The order id, or null when the link was changed or made up. */
export function verifyBillShareToken(token: string): string | null {
  const [orderId, sig] = token.split(".");
  if (!orderId || !sig || orderId.length > 40) return null;
  const expected = Buffer.from(signature(orderId));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? orderId : null;
}
