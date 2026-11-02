import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { advanceAggregatorOrder } from "@/lib/aggregator";
import { loadOrder, serializeOrder } from "@/lib/orders";

const schema = z.object({ step: z.enum(["acknowledged", "food_ready", "dispatched"]) });

/** Zomato / Swiggy order: accept (and send to the kitchen), food ready, handed to the rider. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await params;
    const { step } = schema.parse(await request.json());
    const result = await advanceAggregatorOrder(await getSettings(), id, step, user.name);
    return NextResponse.json({ order: serializeOrder(await loadOrder(id)), kotNumber: result.kotNumber, pushed: result.pushed, warning: result.error });
  });
}
