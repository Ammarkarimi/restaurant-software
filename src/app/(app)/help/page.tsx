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
      "Optional: Settings → Loyalty (points for regulars), Settings → QR menu (print QR codes for tables), Settings → Online & delivery (your own ordering and booking links), Stock & recipes.",
    ],
  },
  {
    title: "2. Taking a dine-in order",
    points: [
      "On Tables, tap a free (white) table.",
      "Tap dishes to add them. Type a short code or name in the search box and press Enter to add quickly.",
      "Dishes with portions (Half / Full) or add-ons (spice level, extra cheese, “add a drink”) ask what the guest wants. Tap the speech bubble on an item to add a note like “less spicy”.",
      "Press “Send to kitchen”. A kitchen ticket (KOT) prints with only the new dishes — one ticket for each kitchen station (for example Tandoor and Bar) — and it appears on the kitchen screen. The table turns yellow.",
      "When the guests order more, open the table again, add dishes and send to the kitchen again. Only the new dishes print.",
    ],
  },
  {
    title: "3. Bill and payment",
    points: [
      "Open the table and press “Print bill”. The bill gets its number and the table turns green.",
      "Add a discount by tapping “+ Add discount” above the total: pick one of your offers, type a coupon code like WELCOME50, or give a percent or amount with a reason. Cashiers can only give as much as their rights allow.",
      "Tap the service charge on the bill to change or remove it when a guest asks.",
      "Add the customer's phone number (tap “Add customer”): known guests fill in by themselves and you see their visits and loyalty points. Tap “Use loyalty points” to take points off the bill.",
      "Press “Take payment”: choose Cash, UPI or Card, or “Split payment” for part cash, part UPI. For cash, type what the guest gave you to see the change. “Pay later” puts the bill on the customer's account.",
      "After payment the table is free again. Press “WhatsApp bill” to send the guest their bill as a link — no paper needed. The link also asks the guest to rate their visit.",
      "More actions (⋯) → “Complimentary (on the house)” for the owner's guests or a food complaint, and “Change payment mode” when a paid bill was marked cash instead of UPI. Both are kept in the activity history.",
    ],
  },
  {
    title: "4. Takeaway, delivery, Zomato and Swiggy",
    points: [
      "Press “Takeaway” at the top (or “New delivery” on Tables).",
      "Tap “Add customer” to choose where the order came from: walk-in, phone, Zomato, Swiggy or another app, and type the app's order ID. It prints on the kitchen ticket and the bill.",
      "Packing and delivery charges are added by themselves (set them in Settings → Tax & charges). Tap them on the order to change or remove them.",
      "Orders from Zomato or Swiggy open the payment as “Paid online / app”, so your cash stays correct. With a special price list for the apps, their dishes take the app price by themselves.",
      "Delivery: choose the rider on the order, press “Out for delivery” and then “Delivered”. “Tell the customer” sends them a WhatsApp that the order is on the way.",
      "Takeaway: each order gets a token number on the kitchen ticket and bill. Open Settings → Kitchen → Token screen on a TV so guests see when their order is ready, and press “Handed over” when they collect it.",
      "Running takeaway and delivery orders, and new orders from your online ordering link, show at the top of Tables.",
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
      "With kitchen stations (Settings → Kitchen), each station's screen can show only its own dishes: choose the station at the top of the kitchen screen.",
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
      "Guests can also see their running bill on the QR page and pay it by UPI; the table shows “paid by UPI” for staff to check and close.",
      "Add dish photos from Menu (open a dish → “Add a photo”) so the QR menu looks like an app. Untick “Show on the QR menu” for dishes only staff should sell.",
    ],
  },
  {
    title: "8. Menu extras: add-ons, special prices and offers",
    who: "Owner / manager",
    points: [
      "Menu → Add-ons & combos: make a group such as “Spice level” (guest must pick 1), “Toppings” (pick any) or “Add a drink” with prices, then tick the dishes it goes with.",
      "Menu → Special prices: make a price list for Zomato & Swiggy (+15%), an area such as the rooftop, or happy hours (drinks 20% off on weekdays 4 to 7 pm). Set a percent for the whole list or type a price for single dishes.",
      "Menu → Offers & coupons: “10% off above ₹1000 (up to ₹200)”, a coupon code such as WELCOME50, or a weekday lunch offer. Cashiers pick them when adding a discount; the bill only takes them when the rules match.",
      "Category settings: choose which kitchen station cooks each category (Tandoor, Bar…). Add stations in Settings → Kitchen.",
    ],
  },
  {
    title: "9. Your own online ordering, kiosk and table bookings",
    who: "Owner / manager",
    points: [
      "Settings → Online & delivery: switch on online ordering (takeaway, and delivery if you deliver), set a minimum order, and copy your link for Instagram, Google Maps and WhatsApp. No commission.",
      "Guests pick a pickup or delivery time and get a link to follow their order. New orders show in purple on Tables; check them and press “Send to kitchen” to accept, then send the guest the tracking link on WhatsApp.",
      "Kiosk link: open it on a tablet at the counter so walk-in guests order by themselves and pay at the counter.",
      "Reservations: add bookings from phone calls with the time, guests, table and occasion. Switch on the booking link so guests can ask for a table; requests show on Tables for you to confirm on WhatsApp. Press “Seat now” when they arrive to open their order at a table.",
    ],
  },
  {
    title: "10. Customers, loyalty, dues and feedback",
    who: "Owner / manager",
    points: [
      "Every paid bill with a phone number saves the customer. Customers shows visits, total spent, last visit, points and what they owe.",
      "Settings → Loyalty: choose how many points a bill earns (for example 5% of the bill) and when they can be used. 1 point = ₹1 off.",
      "Open a customer to add notes or a birthday, give or take away points with a reason, or message them on WhatsApp. Download the list as CSV.",
      "Account: set a credit limit for regulars who pay later, record money they pay you (dues or an advance for their wallet) and send a WhatsApp reminder of what they owe. Money received shows in the day close.",
      "Feedback & ratings: guests rate food, service and ambience from the bill link. 4 and 5 stars are asked to review you on Google (add your Google review link); 1 and 2 stars appear here to call back.",
      "WhatsApp offers: send a message to birthdays this week, guests not seen for a month, regulars or everyone. Each message carries the guest's name; WhatsApp opens ready and you press send.",
    ],
  },
  {
    title: "11. Cash, expenses and closing the day",
    points: [
      "Cash & expenses → “Add expense” for money paid out (vegetables, gas, staff advance). Cashiers can add today's expenses.",
      "At night the owner opens “Day close”: it shows sales by payment mode, expenses and the cash that should be in the drawer.",
      "Count the drawer (“Count notes” adds up the notes for you), type what you leave for tomorrow and press “Close the day”. Short or extra cash is shown in red or amber.",
      "“Print day summary” prints the day on the thermal printer, and “Send on WhatsApp” sends the owner the day's numbers. “Past days” lists every closed day.",
    ],
  },
  {
    title: "12. Stock, suppliers and dish costing",
    who: "Owner / manager",
    points: [
      "Stock & recipes → add what you buy (paneer, oil, chicken…) with its unit, or paste many at once.",
      "Recipes: tap a dish and add what one plate uses (for example 0.18 kg paneer). Every paid bill then takes it out of stock by itself.",
      "Record purchases (tick “Paid in cash from the till” to also save it as an expense), wastage and stock counts.",
      "Items at or below their warning level show as “Low”, and Tables shows a reminder. The usage report shows opening, bought, used, wasted and closing stock.",
      "Purchase orders: list what you need from a supplier and send it on WhatsApp. When the goods come, press “Received”: stock goes up and the bill is added to what you owe the supplier.",
      "Suppliers: see what you owe each one and record payments (saved as a “Supplier payment” expense).",
      "Dish costing: what each plate costs you from its recipe, and your profit on it.",
    ],
  },
  {
    title: "13. Mistakes and changes",
    points: [
      "Remove a dish not yet sent to the kitchen with the minus button.",
      "Removing a dish the kitchen already has asks for a reason; it is kept in the activity history.",
      "Move a running order to another table with ⋯ → “Move to another table”.",
      "Cancel an order with ⋯ → “Cancel order”. Once food went to the kitchen, only the owner / manager can cancel. Cancelling a paid bill also gives back loyalty points and stock.",
      "Reprint any bill from Bills.",
    ],
  },
  {
    title: "14. Staff rights and shifts",
    who: "Owner / manager",
    points: [
      "Settings → Staff → Rights: choose for each cashier or captain the biggest discount they may give, and whether they may remove dishes, cancel orders, reprint bills, make bills complimentary, let customers pay later, change payment modes, see sales and add expenses.",
      "Staff press “Start my shift” in the menu when they arrive and “End” when they leave. Settings → Staff → Attendance shows the days and hours for the month.",
    ],
  },
  {
    title: "15. Reports",
    who: "Owner / manager",
    points: [
      "Reports shows sales, bills, average bill, payment modes, order sources, best-selling dishes, busy hours, sales by weekday, tax summary, expenses and cancellations.",
      "It also shows discounts by staff and offer, complimentary bills, removed dishes, riders' deliveries, ratings, customer dues, and for Zomato / Swiggy what you get after their commission (set it in Settings → Online & delivery).",
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
