import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, isAdmin, withAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { addAccountEntry } from "@/lib/customers";
import { EXPENSE_METHODS } from "@/lib/cash";
import { formatCurrency, label } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

/** A customer's account: bills put on it, money received, wallet top-ups. Newest first. */
export async function GET(_request: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    const customer = await prisma.customer.findFirst({ where: { id }, select: { id: true, balance: true, creditLimit: true } });
    if (!customer) fail("Customer not found", 404);
    const txns = await prisma.customerTxn.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({ customer, txns });
  });
}

const schema = z.object({
  // received = money paid in (clears what they owe, the rest stays as wallet money); adjust = owner's correction (+ or −).
  type: z.enum(["received", "adjust"]).default("received"),
  amount: z.coerce.number().refine((n) => n !== 0, "Enter the amount").refine((n) => Math.abs(n) <= 100_000_000, "Amount is too large"),
  method: z.enum(EXPENSE_METHODS).optional(),
  note: z.string().trim().max(200).optional().nullable(),
});

/** Money received against a customer's account (anyone at the counter), or a correction (owner only). */
export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    if (body.type === "received" && (body.amount <= 0 || !body.method)) fail("Enter the amount received and how it was paid");
    if (body.type === "adjust" && !isAdmin(user)) fail("Only the owner / manager can correct an account.", 403);
    if (body.type === "adjust" && !body.note) fail("Please give a reason for the correction");
    const settings = await getSettings();
    const customer = await prisma.customer.findFirst({ where: { id } });
    if (!customer) fail("Customer not found", 404);
    const balance = await prisma.$transaction((tx) =>
      addAccountEntry(
        tx,
        { customerId: id, type: body.type, amount: body.amount, method: body.type === "received" ? body.method : null, note: body.note || null, date: todayKey(settings.timezone), createdByName: user.name },
        { mayGiveCredit: true }
      )
    );
    const who = customer.name || customer.phone;
    await logActivity(
      user,
      body.type === "received" ? "Received on account" : "Corrected account",
      `${who}: ${formatCurrency(body.amount, settings.currency)}${body.method ? ` by ${label(body.method)}` : ""}${body.note ? ` (${body.note})` : ""}, balance ${formatCurrency(balance, settings.currency)}`
    );
    return NextResponse.json({ balance });
  });
}
