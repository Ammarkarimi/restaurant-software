import type { Metadata } from "next";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Help" };

const STEPS: Array<{ title: string; who?: string; points: string[] }> = [
  {
    title: "1. First-time setup",
    who: "Owner / manager",
    points: [
      "Settings → Restaurant: your name, address, GSTIN and FSSAI number.",
      "Settings → Tax & charges: GST rate (usually 5%), whether menu prices include tax, service charge, round-off.",
      "Settings → Bill design: upload your logo, pick a style, choose what to print, and press Save. Use “Test print” to check your printer.",
      "Table setup: add your areas and tables (for example T1 to T12 in the Main hall).",
      "Menu: add categories and dishes, or paste your whole menu with “Quick add many”.",
      "Settings → Staff: give each cashier and captain their own sign-in.",
    ],
  },
  {
    title: "2. Taking a dine-in order",
    points: [
      "On Tables, tap a free (white) table.",
      "Tap dishes to add them. Type a short code or name in the search box and press Enter to add quickly.",
      "Dishes with portions (Half / Full) ask which one. Tap the speech bubble on an item to add a note like “less spicy”.",
      "Press “Send to kitchen”. A kitchen ticket (KOT) prints with only the new dishes. The table turns yellow.",
      "When the guests order more, open the table again, add dishes and send to the kitchen again. Only the new dishes print.",
    ],
  },
  {
    title: "3. Bill and payment",
    points: [
      "Open the table and press “Print bill”. The bill gets its number and the table turns green.",
      "Add a discount by tapping “+ Add discount” above the total (percent or amount, with a reason).",
      "Press “Take payment”: choose Cash, UPI or Card, or “Split payment” for part cash, part UPI. For cash, type what the guest gave you to see the change.",
      "After payment the table is free again.",
    ],
  },
  {
    title: "4. Takeaway and delivery",
    points: [
      "Press “Takeaway” at the top (or “New delivery” on Tables).",
      "Add dishes, optionally the customer's name and phone (and address for delivery), then send to the kitchen.",
      "Take payment when the customer pays. Running takeaway and delivery orders show at the top of Tables.",
    ],
  },
  {
    title: "5. Mistakes and changes",
    points: [
      "Remove a dish not yet sent to the kitchen with the minus button.",
      "Removing a dish the kitchen already has asks for a reason; it is kept in the activity history.",
      "Move a running order to another table with ⋯ → “Move to another table”.",
      "Cancel an order with ⋯ → “Cancel order”. Once food went to the kitchen, only the owner / manager can cancel.",
      "Reprint any bill from Bills.",
    ],
  },
  {
    title: "6. End of the day",
    who: "Owner / manager",
    points: [
      "Reports shows sales, bills, average bill, payment modes, best-selling dishes, busy hours, tax summary and cancellations.",
      "Download CSV files for Excel or your accountant.",
      "Settings → Activity history shows who discounted, removed items or cancelled.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Help & guide" description="Everything you need, in plain words." />
      {STEPS.map((s) => (
        <Card key={s.title}>
          <CardHeader title={s.title} description={s.who} />
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-slate-700">
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader title="Printing tips" />
        <CardContent className="space-y-2 text-[15px] text-slate-700">
          <p>Bills and kitchen tickets open in a small window and the print dialog appears by itself. Choose your thermal printer and set margins to “None”.</p>
          <p>On Chrome you can skip the print dialog on a dedicated billing computer by starting Chrome with <code className="rounded bg-slate-100 px-1">--kiosk-printing</code>.</p>
          <p>If your kitchen has no printer, open ⋯ on the order screen and switch off “Print kitchen ticket when sending” on that device.</p>
        </CardContent>
      </Card>
    </div>
  );
}
