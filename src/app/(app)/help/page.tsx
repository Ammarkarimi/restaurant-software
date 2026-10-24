import type { Metadata } from "next";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Help" };

const STEPS: Array<{ title: string; who?: string; points: string[] }> = [
  {
    title: "1. First-time setup",
    who: "Owner / manager",
    points: [
      "Settings → Restaurant: your name, address, GSTIN and FSSAI number.",
      "Settings → Tax & charges: GST rate (usually 5%), whether menu prices include tax, service charge, packing and delivery charges, round-off.",
      "Settings → Bill design: upload your logo, pick a style, choose what to print, and press Save. Use “Test print” to check your printer.",
      "Table setup: add your areas and tables (for example T1 to T12 in the Main hall).",
      "Menu: add categories and dishes, or paste your whole menu with “Quick add many”.",
      "Settings → Staff: give each cashier and captain their own sign-in. Add a “Kitchen screen only” account for a tablet in the kitchen.",
      "Optional: Settings → Loyalty (points for regulars), Settings → QR menu (print QR codes for tables), Stock & recipes.",
    ],
  },
  {
    title: "2. Taking a dine-in order",
    points: [
      "On Tables, tap a free (white) table.",
      "Tap dishes to add them. Type a short code or name in the search box and press Enter to add quickly.",
      "Dishes with portions (Half / Full) ask which one. Tap the speech bubble on an item to add a note like “less spicy”.",
      "Press “Send to kitchen”. A kitchen ticket (KOT) prints with only the new dishes, and it appears on the kitchen screen. The table turns yellow.",
      "When the guests order more, open the table again, add dishes and send to the kitchen again. Only the new dishes print.",
    ],
  },
  {
    title: "3. Bill and payment",
    points: [
      "Open the table and press “Print bill”. The bill gets its number and the table turns green.",
      "Add a discount by tapping “+ Add discount” above the total (percent or amount, with a reason).",
      "Add the customer's phone number (tap “Add customer”): known guests fill in by themselves and you see their visits and loyalty points. Tap “Use loyalty points” to take points off the bill.",
      "Press “Take payment”: choose Cash, UPI or Card, or “Split payment” for part cash, part UPI. For cash, type what the guest gave you to see the change.",
      "After payment the table is free again. Press “WhatsApp bill” to send the guest their bill as a link — no paper needed.",
    ],
  },
  {
    title: "4. Takeaway, delivery, Zomato and Swiggy",
    points: [
      "Press “Takeaway” at the top (or “New delivery” on Tables).",
      "Tap “Add customer” to choose where the order came from: walk-in, phone, Zomato, Swiggy or another app, and type the app's order ID. It prints on the kitchen ticket and the bill.",
      "Packing and delivery charges are added by themselves (set them in Settings → Tax & charges). Tap them on the order to change or remove them.",
      "Orders from Zomato or Swiggy open the payment as “Paid online / app”, so your cash stays correct.",
      "Running takeaway and delivery orders show at the top of Tables.",
    ],
  },
  {
    title: "5. Split the bill, move or merge tables",
    points: [
      "Open the order, tap ⋯ → “Split bill / move items to another table”.",
      "Choose the dishes (and how many of each), then where they go: a separate bill at the same table, a free table, or a running table (merge).",
      "To merge two tables, choose “Select all” and pick the other table. The empty table becomes free.",
      "Separate bills show at the top of Tables and as “+1 bill” on the table.",
    ],
  },
  {
    title: "6. Kitchen screen",
    points: [
      "Open “Kitchen screen” on a tablet or TV in the kitchen (or sign in there with a “Kitchen screen only” account).",
      "New tickets appear by themselves with a sound, oldest first. They turn amber after 10 minutes and red after 20.",
      "Tap a dish when it is ready, or “All ready” for the whole ticket. The table shows “2 ready” on Tables and the waiter taps “Served”.",
      "“Sold out dishes” lets the kitchen switch off a dish; the tills stop selling it at once.",
    ],
  },
  {
    title: "7. QR menu and table ordering",
    who: "Owner / manager",
    points: [
      "Settings → QR menu → “Print QR codes”: one code for each table, plus one for the menu only.",
      "Guests scan with their phone camera to see your menu, call a waiter or ask for the bill. With table ordering switched on, they can also order.",
      "Guest orders show on Tables in purple. Open the table, check the dishes marked “ordered by guest” and press “Send to kitchen”. Nothing reaches the kitchen without staff.",
      "A waiter call shows in red on Tables. Press “Done” when someone has gone to the table.",
    ],
  },
  {
    title: "8. Customers and loyalty points",
    who: "Owner / manager",
    points: [
      "Every paid bill with a phone number saves the customer. Customers shows visits, total spent, last visit and points.",
      "Settings → Loyalty: choose how many points a bill earns (for example 5% of the bill) and when they can be used. 1 point = ₹1 off.",
      "Open a customer to add notes or a birthday, give or take away points with a reason, or message them on WhatsApp. Download the list as CSV.",
    ],
  },
  {
    title: "9. Cash, expenses and closing the day",
    points: [
      "Cash & expenses → “Add expense” for money paid out (vegetables, gas, staff advance). Cashiers can add today's expenses.",
      "At night the owner opens “Day close”: it shows sales by payment mode, expenses and the cash that should be in the drawer.",
      "Count the drawer (“Count notes” adds up the notes for you), type what you leave for tomorrow and press “Close the day”. Short or extra cash is shown in red or amber.",
      "“Print day summary” prints the day on the thermal printer. “Past days” lists every closed day.",
    ],
  },
  {
    title: "10. Stock and recipes",
    who: "Owner / manager",
    points: [
      "Stock & recipes → add what you buy (paneer, oil, chicken…) with its unit, or paste many at once.",
      "Recipes: tap a dish and add what one plate uses (for example 0.18 kg paneer). Every paid bill then takes it out of stock by itself.",
      "Record purchases (tick “Paid in cash from the till” to also save it as an expense), wastage and stock counts.",
      "Items at or below their warning level show as “Low”, and Tables shows a reminder. The usage report shows opening, bought, used, wasted and closing stock.",
    ],
  },
  {
    title: "11. Mistakes and changes",
    points: [
      "Remove a dish not yet sent to the kitchen with the minus button.",
      "Removing a dish the kitchen already has asks for a reason; it is kept in the activity history.",
      "Move a running order to another table with ⋯ → “Move to another table”.",
      "Cancel an order with ⋯ → “Cancel order”. Once food went to the kitchen, only the owner / manager can cancel. Cancelling a paid bill also gives back loyalty points and stock.",
      "Reprint any bill from Bills.",
    ],
  },
  {
    title: "12. Reports",
    who: "Owner / manager",
    points: [
      "Reports shows sales, bills, average bill, payment modes, order sources, best-selling dishes, busy hours, tax summary, expenses and cancellations.",
      "Download CSV files for Excel or your accountant.",
      "Settings → Activity history shows who discounted, removed items, cancelled or changed points.",
      "Owners with more than one outlet switch outlets at the top of the menu, and Reports shows all outlets side by side.",
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
          <p>If your kitchen has no printer, open ⋯ on the order screen and switch off “Print kitchen ticket when sending” on that device, and use the kitchen screen instead.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Install it like an app" />
        <CardContent className="space-y-2 text-[15px] text-slate-700">
          <p>On a computer (Chrome or Edge): click the install icon at the right of the address bar. It opens in its own window, without browser tabs.</p>
          <p>On Android: open the menu (⋮) → “Add to home screen” / “Install app”. On iPhone or iPad: tap Share → “Add to Home Screen”.</p>
        </CardContent>
      </Card>
    </div>
  );
}
