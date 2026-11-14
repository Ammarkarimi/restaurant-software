// Stock sent between outlets of one owner (a central kitchen feeding its outlets, or one outlet
// lending another paneer for the night). The sender's stock goes down when it is sent; the
// receiver's goes up when they press Received, so stock on the road is never counted twice.
import { z } from "zod";
import { parsePurchaseLines, type PurchaseLine } from "./purchases";

export type TransferLine = PurchaseLine;
export const parseTransferLines = parsePurchaseLines;

export const transferSchema = z.object({
  toRestaurantId: z.string().min(1, "Choose the outlet").max(40),
  lines: z
    .array(z.object({ stockItemId: z.string().min(1).max(40), quantity: z.coerce.number().positive("Enter how much").max(10_000_000) }))
    .min(1, "Add at least one item")
    .max(100),
  notes: z.string().trim().max(300).nullable().optional(),
});

/** The outlets someone can send stock to: their other outlets, never the one they are in. */
export function destinations(outlets: Array<{ id: string; name: string }>, currentId: string) {
  return outlets.filter((o) => o.id !== currentId);
}
