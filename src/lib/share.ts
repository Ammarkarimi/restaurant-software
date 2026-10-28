import { createHmac, timingSafeEqual } from "node:crypto";
import { getJwtSecret } from "./session";

// Links to a bill that a guest can open without signing in (sent on WhatsApp).
// The link carries the order id and a signature, so nobody can guess other bills.

function signature(orderId: string, scope = "bill") {
  return createHmac("sha256", Buffer.from(getJwtSecret())).update(`${scope}:${orderId}`).digest("base64url").slice(0, 22);
}

function verify(token: string, scope: string): string | null {
  const [orderId, sig] = token.split(".");
  if (!orderId || !sig || orderId.length > 40) return null;
  const expected = Buffer.from(signature(orderId, scope));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? orderId : null;
}

export function billShareToken(orderId: string) {
  return `${orderId}.${signature(orderId)}`;
}

/** The order id, or null when the link was changed or made up. */
export function verifyBillShareToken(token: string): string | null {
  return verify(token, "bill");
}

/** A guest's link to follow their online order (/o/…). Different from the bill link. */
export function orderTrackToken(orderId: string) {
  return `${orderId}.${signature(orderId, "track")}`;
}

export function verifyOrderTrackToken(token: string): string | null {
  return verify(token, "track");
}
