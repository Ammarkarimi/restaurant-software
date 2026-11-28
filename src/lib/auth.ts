import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { rawPrisma } from "./db";
import { parsePermissions } from "./permissions";
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

// A bcrypt hash of a random password, compared against when the email is unknown.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.Xn0KtjCEVsNy3m.wS7oF/Bu3G6aS";

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

/** The signed-in person. Read once per page render even when the layout and the page both ask. */
export const getSession = cache(readSession);

async function readSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  // Removed or disabled staff lose access immediately, role changes apply,
  // and a paused restaurant is signed out everywhere.
  const staff = await rawPrisma.staff.findUnique({ where: { id: session.id }, include: { restaurant: { select: { status: true } } } });
  if (!staff || !staff.active) return null;
  // Signed in before a password change, removal or role change: no longer valid.
  if ((session.v ?? 0) !== staff.sessionVersion) return null;
  if (session.restaurantId && session.restaurantId !== staff.restaurantId) {
    // An owner working in another of their outlets: they are its owner / manager while there.
    const access = await rawPrisma.outletAccess.findUnique({
      where: { staffId_restaurantId: { staffId: staff.id, restaurantId: session.restaurantId } },
      include: { restaurant: { select: { status: true } } },
    });
    if (!access || access.restaurant.status !== "active" || staff.role !== "admin") return null;
    return { id: staff.id, email: staff.email, name: staff.name, role: "admin", restaurantId: session.restaurantId, v: staff.sessionVersion };
  }
  if (staff.restaurant.status !== "active") return null;
  return {
    id: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role,
    restaurantId: staff.restaurantId,
    v: staff.sessionVersion,
    ...(staff.role === "staff" && { permissions: parsePermissions(staff.permissions) }),
  };
}

/** The restaurants a person can work in: their own, plus outlets they were given. */
export async function outletsFor(staffId: string) {
  const staff = await rawPrisma.staff.findUnique({
    where: { id: staffId },
    select: {
      role: true,
      restaurant: { select: { id: true, name: true, status: true } },
      outlets: { select: { restaurant: { select: { id: true, name: true, status: true } } } },
    },
  });
  if (!staff) return [];
  const all = [staff.restaurant, ...(staff.role === "admin" ? staff.outlets.map((o) => o.restaurant) : [])];
  return all.filter((r) => r.status === "active").map((r) => ({ id: r.id, name: r.name }));
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
  // Unknown email: still check a password, so the answer takes as long and doesn't reveal who has an account.
  if (!staff || !staff.active) {
    await verifyPassword(password, DUMMY_HASH);
    return { error: "invalid" };
  }

  const valid = await verifyPassword(password, staff.passwordHash);
  if (!valid) return { error: "invalid" };
  // Only tell someone the restaurant is paused once they have proved who they are.
  if (staff.restaurant.status !== "active") return { error: "suspended" };

  await rawPrisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
  return {
    user: { id: staff.id, email: staff.email, name: staff.name, role: staff.role, restaurantId: staff.restaurantId, v: staff.sessionVersion },
  };
}
