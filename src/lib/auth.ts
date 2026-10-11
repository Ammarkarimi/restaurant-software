import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { rawPrisma } from "./db";
import {
  COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  type SessionUser,
} from "./session";

export type { SessionUser };
export { COOKIE_NAME, SESSION_DURATION } from "./session";

export const SUSPENDED_MESSAGE =
  "This restaurant's account is paused. Please contact your software provider to switch it back on.";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser): Promise<string> {
  return createSessionToken(user);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  return verifySessionToken(token);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  // Removed or disabled staff lose access immediately, role changes apply,
  // and a paused restaurant is signed out everywhere.
  const staff = await rawPrisma.staff.findUnique({ where: { id: session.id }, include: { restaurant: true } });
  if (!staff || !staff.active || staff.restaurant.status !== "active") return null;
  return { id: staff.id, email: staff.email, name: staff.name, role: staff.role, restaurantId: staff.restaurantId };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export type LoginResult = { user: SessionUser } | { error: "invalid" | "suspended" };

export async function login(email: string, password: string): Promise<LoginResult> {
  const staff = await rawPrisma.staff.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { restaurant: true },
  });
  if (!staff || !staff.active) return { error: "invalid" };

  const valid = await verifyPassword(password, staff.passwordHash);
  if (!valid) return { error: "invalid" };
  // Only tell someone the restaurant is paused once they have proved who they are.
  if (staff.restaurant.status !== "active") return { error: "suspended" };

  await rawPrisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
  return {
    user: { id: staff.id, email: staff.email, name: staff.name, role: staff.role, restaurantId: staff.restaurantId },
  };
}
