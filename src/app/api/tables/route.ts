import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentRestaurantId, prisma } from "@/lib/db";
import { fail, withAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { freeTableNames, rangeLabel } from "@/lib/table-names";

export async function GET() {
  return withAuth(async () => {
    const tables = await prisma.diningTable.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return NextResponse.json({ tables });
  });
}

const single = z.object({
  name: z.string().trim().min(1, "Table name is required").max(30),
  area: z.string().trim().min(1).max(40).default("Main hall"),
  seats: z.coerce.number().int().min(1).max(100).default(4),
});

// "Add many": prefix T, from 1 to 10 → T1 … T10
const bulk = z.object({
  prefix: z.string().trim().max(20).default("T"),
  from: z.coerce.number().int().min(0).max(9999),
  to: z.coerce.number().int().min(0).max(9999),
  area: z.string().trim().min(1).max(40).default("Main hall"),
  seats: z.coerce.number().int().min(1).max(100).default(4),
});

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = await request.json();
    const existing = await prisma.diningTable.findMany({ select: { name: true, area: true, sortOrder: true } });
    const taken = new Set(existing.map((t) => t.name.toLowerCase()));
    let sortOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), 0);

    let rows: Array<{ name: string; area: string; seats: number }>;
    if (body && typeof body === "object" && "from" in body) {
      const b = bulk.parse(body);
      if (b.to < b.from) fail("The last number must be bigger than the first");
      if (b.to - b.from >= 200) fail("Add at most 200 tables at a time");
      rows = [];
      for (let n = b.from; n <= b.to; n++) rows.push({ name: `${b.prefix}${n}`, area: b.area, seats: b.seats });
    } else {
      rows = [single.parse(body)];
    }
    const fresh = rows.filter((r) => !taken.has(r.name.toLowerCase()));
    if (fresh.length === 0) {
      // Say where the names are used and offer free ones, e.g. F1 … F5 for a new "First Floor".
      const where = [...new Set(existing.filter((t) => rows.some((r) => r.name.toLowerCase() === t.name.toLowerCase())).map((t) => t.area))].join(", ");
      const what = rows.length === 1 ? `A table called ${rows[0].name} already exists` : `${rows[0].name} … ${rows[rows.length - 1].name} already exist`;
      const b = "from" in body ? bulk.parse(body) : null;
      const options = b ? freeTableNames(existing, b.prefix, rows.length, b.area) : [];
      fail(
        `${what}${where ? ` in ${where}` : ""}. Every table needs its own name so kitchen tickets and bills show the right one` +
          (options.length ? ` — try ${options.map(rangeLabel).join(" or ")}.` : ".")
      );
    }
    await prisma.diningTable.createMany({ data: fresh.map((r) => ({ ...r, restaurantId: currentRestaurantId(), sortOrder: ++sortOrder })) });
    await logActivity(user, fresh.length === 1 ? "Added table" : "Added tables", fresh.map((r) => r.name).join(", "));
    const tables = await prisma.diningTable.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return NextResponse.json({ tables, added: fresh.length, skipped: rows.length - fresh.length }, { status: 201 });
  });
}
