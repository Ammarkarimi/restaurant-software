import { prisma } from "@/lib/db";
import { csvResponse, withAdmin } from "@/lib/api";

/** All customers as a spreadsheet, e.g. for SMS / WhatsApp offers. */
export async function GET() {
  return withAdmin(async () => {
    const customers = await prisma.customer.findMany({ orderBy: { lastVisitAt: { sort: "desc", nulls: "last" } } });
    return csvResponse("customers.csv", [
      ["Name", "Phone", "Email", "Address", "Birthday", "Visits", "Total spent", "Points", "Last visit", "Notes"],
      ...customers.map((c) => [c.name, c.phone, c.email, c.address, c.birthday, c.visits, c.totalSpent, c.points, c.lastVisitAt?.toISOString().slice(0, 10), c.notes]),
    ]);
  });
}
