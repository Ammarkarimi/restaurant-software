// Limits how often something can be tried: sign-in, guest QR orders, waiter calls, AI scans.
// The counts live in the database, so every server instance shares them (an in-memory count per
// instance would let a password guesser spread tries over many instances). Keys are hashed, so no
// emails or phone numbers are stored. If the database can't be reached, a per-instance count is used.
import { createHash } from "node:crypto";
import { rawPrisma } from "./db";

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.resetAt < now) memory.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/** True while `key` has been used at most `limit` times in the last `windowMs`. Counts this use. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const hashed = createHash("sha256").update(key).digest("base64url");
  const now = new Date();
  const reset = new Date(now.getTime() + windowMs);
  try {
    const rows = await rawPrisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${hashed}, 1, ${reset})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN ${reset} ELSE "RateLimit"."resetAt" END
      RETURNING "count"`;
    // Now and then, clear counters that ran out long ago.
    if (Math.random() < 0.01) {
      rawPrisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } }).catch(() => undefined);
    }
    return Number(rows[0]?.count ?? 1) <= limit;
  } catch {
    return memoryLimit(hashed, limit, windowMs);
  }
}

/** The visitor's IP. On Vercel, x-real-ip / x-forwarded-for are set by Vercel itself and can't be faked. */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
