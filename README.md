# RestoOwl — always watching over your restaurant

Simple restaurant billing, tables, menu & KOT software.

Point-of-sale software for independent restaurants, cafés, dhabas and cloud
kitchens: a **table view**, a fast **order screen**, **kitchen tickets (KOT)**
and a **kitchen screen**, **GST bills** with a **bill design you can customise**
(your logo, what to print, paper size, UPI QR code to pay), split bills and
split payments, **add-ons and combos**, **special prices and happy hours**,
**offers and coupons**, **Zomato / Swiggy orders**, the restaurant's **own
online ordering link**, a **QR menu with table ordering and scan-to-pay**,
**table reservations**, **delivery riders**, a **token screen**, **customers,
loyalty points, pay-later accounts, ratings and WhatsApp offers**, **WhatsApp
e-bills**, **expenses and day close**, **stock, recipes, suppliers and purchase
orders**, reports, staff rights and attendance, and several outlets per owner.

One installation serves **many restaurants**. Like the hotel software, you as
the software provider have your own **owner panel at `/platform`**: create a
restaurant and hand its owner a sign-in, track who has paid you each month,
and pause restaurants that don't pay. Each restaurant only ever sees its own data.

> **Why these features?** See [docs/PLAN.md](docs/PLAN.md): the market
> research (Petpooja, Restroworks/Posist, Toast, Square, Lightspeed…), what we
> built, and the technical design. [docs/PETPOOJA-COMPARISON.md](docs/PETPOOJA-COMPARISON.md)
> compares us feature by feature with Petpooja.

## Features

| Area | What you can do |
|---|---|
| **Tables** (home) | Floor view grouped by area (Main hall, Garden, Rooftop…). Free / running / bill-printed colours, running amount and minutes per table, red badge for items not yet sent to the kitchen. Today's sales, bills and running orders. Running takeaway and delivery orders on top. Refreshes itself so several tills and phones stay in sync |
| **Order screen (POS)** | Menu by category, search by name or **short code** (press Enter to add), veg / non-veg / egg marks, **portions** (Half / Full), **add-ons** (spice level, toppings, “add a drink”, with minimum / maximum choices), sold-out dishes greyed out, **open items** not on the menu. Notes per item (“less spicy”). Customer lookup by phone, guests, discount (% or amount, with reason) or an **offer / coupon code**, service charge removable per bill, **complimentary** bills, change payment mode of a paid bill, move to another table, cancel with reason. Works on a phone for captains |
| **Split, move, merge** | Split a bill by dishes and quantities into a separate bill, move dishes to another table, or merge two tables. Kitchen tickets and prices move with the dishes |
| **Kitchen tickets (KOT)** | “Send to kitchen” prints only the new items, without prices, with table, KOT number, time, app order ID, add-ons and notes — **one ticket per kitchen station** (Tandoor, Bar…). Takeaway and delivery tickets carry a **token number**. Items removed after a KOT print as CANCELLED |
| **Kitchen screen (KDS)** | Full-screen tickets for a kitchen tablet or TV, oldest first, amber after 10 and red after 20 minutes, sound for new tickets, **filter by station**. Tap dishes ready; waiters see “2 ready” and mark them served. Kitchen can switch dishes to sold out. “Kitchen screen only” staff accounts |
| **Token screen** | `/display` on a TV at the counter: takeaway tokens being prepared and ready to collect; staff press “Handed over” |
| **Takeaway, delivery, apps** | Order source: walk-in, phone, **Zomato, Swiggy**, other app, own website, with the app's order ID. **Packing and delivery charges** added automatically (editable per order), taxed like food. App orders are paid as “Paid online / app”. Pickup / delivery time. **Delivery riders**: assign, out for delivery, delivered, WhatsApp “on the way” message |
| **Own online ordering** | The restaurant's own link (`/m/<slug>?order=1`) for takeaway and delivery with no commission: minimum order, pickup / delivery time, a **tracking page** for the guest; orders appear on Tables for staff to accept. **Kiosk mode** (`?kiosk=1`) for a self-order tablet. **Booking link** (`/r/<slug>`) for table requests |
| **Reservations** | Bookings by phone, walk-in or the booking link: date, time, guests, table, occasion, notes; requests to confirm, seat with one tap (opens the order), cancelled and no-show |
| **Billing** | GST split into CGST + SGST (or one VAT line, or no tax), prices with or without tax, per-dish tax rate, service charge, packing / delivery charges, loyalty points, round-off, sequential bill numbers with your prefix |
| **Payment** | Cash, UPI, card, paid online or **split** (part cash, part UPI). Change to return for cash. UPI QR on screen with the amount filled in. **WhatsApp e-bill** link after payment |
| **QR menu & table ordering** | Printable QR codes per table and for the menu. Guests see the live menu with **dish photos** (sold-out dishes marked, staff-only dishes hidden), **order from the table**, **call a waiter**, **ask for the bill** or **see the bill and pay by UPI**. Guest orders wait for staff to check and send to the kitchen |
| **Menu extras** | **Add-on groups** offered with chosen dishes. **Special price lists** by table area, order type, app (Zomato / Swiggy) or day and time (**happy hours**), as a % or per-dish prices. **Offers**: % (with a cap) or amount, minimum bill, order types, days, times, valid dates, **coupon codes**, times used |
| **Customers & loyalty** | Customers saved from phone numbers on paid bills: visits, spend, last visit, notes, birthday. **Loyalty points** (earn a % of the bill, use them as money off), adjustments with a reason, CSV export. **Accounts**: pay later with a credit limit, money received (dues or wallet advance), ledger, WhatsApp reminder |
| **Feedback & campaigns** | Guests rate food, service and ambience from the WhatsApp bill link; 4–5 stars are sent to your **Google review** link, 1–2 stars listed to call back. **WhatsApp offers** to birthdays this week, guests not seen for 30 days, new guests, regulars, top spenders or those who owe, sent one tap at a time, with CSV |
| **Cash & day close** | Expenses paid out (cashiers can add today's). **Day close**: sales by payment mode, money received on customer accounts, expenses, expected cash in the drawer, note counter, short / extra, cash left for tomorrow, printable day summary, **day summary on WhatsApp**, history of closed days |
| **Stock & recipes** | Stock items with units, purchases (optionally saved as a cash expense), wastage, stock counts. **Recipes per dish** (per portion if needed): paid bills take ingredients out automatically, cancelled bills put them back. Low-stock warnings, stock value, usage report with CSV. **Suppliers**, **purchase orders** (send on WhatsApp, receive into stock), supplier dues and payments, **dish costing** (cost and profit per plate) |
| **Bill design** | Upload your **logo**, start from 4 ready-made styles (Classic thermal, Modern café, Compact 58 mm, A4 invoice), show / hide every line (GSTIN, FSSAI, table, staff, customer, veg marks, tax table, amount in words…), header and thank-you message, font, size, colour, **UPI QR code**, 58 mm / 80 mm thermal or A4. **Live preview** and a **test print** |
| **Bills** | Every order by date and status, search by bill no., order no., table, name or phone, reprint any bill |
| **Menu** | Categories (reorder, hide), dishes with price or portions, food type, short code, tax rate, description, “sold out today” switch (cashiers can use it too). **Quick add**: paste your whole menu, or copy columns from Excel |
| **Table setup** | Add many tables at once (T1–T10), areas, seats. Tables with old bills are hidden, never lost |
| **Reports** (owner) | Sales, bills, average bill, guests, discounts, tax, cancellations; sales by day, by hour and by weekday; payment modes; order types and sources with **app commission and payout**; sales by staff; **discounts by staff and offer**; **complimentary bills**; **removed dishes**; riders; ratings; customer dues; best-selling dishes; category sales; GST summary; expenses. CSV downloads for Excel |
| **Several outlets** | One owner, many restaurants: switch outlets from the menu, see all outlets' sales side by side. Linked from the owner panel |
| **Staff & security** | Owner / manager, cashier / captain and kitchen-screen-only roles. **Rights per cashier / captain**: biggest discount, removing dishes, cancelling orders, reprinting bills, complimentary bills, pay later, changing payment modes, seeing sales, adding expenses. Cashiers can't see reports, customers, stock or settings. **Attendance**: staff start and end their shift; monthly days and hours. Activity history of who discounted, removed items, cancelled or changed points. Login and QR-order rate limiting |
| **Install as an app** | Web app manifest: “Install app” on the billing PC, “Add to home screen” on tablets and phones |
| **Owner panel (`/platform`)** | For you, the software provider: add restaurants (or another outlet for an existing owner) and hand out the owner's sign-in (copy or send on WhatsApp), monthly fee and free months, record payments, see who has paid and who is late, usage (tables, dishes, bills, sales), give anyone a new password, link outlets, pause or delete a restaurant |

## Quick start (local)

Requirements: **Node.js 20+** and **PostgreSQL 14+**.

```bash
# 1. Start PostgreSQL (or use your own)
docker compose up -d

# 2. Configure — set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD for the owner panel
cp .env.example .env

# 3. Install, create the database tables and load the demo restaurant
npm install
npm run db:setup:dev     # migrations + "Spice Garden" demo: menu with add-ons and special prices, offers, tables,
                         # two weeks of bills, customers with dues and ratings, bookings, expenses, stock, suppliers
npm run dev
```

Open <http://localhost:3000> and sign in to the demo restaurant:

| Role | Email | Password |
|---|---|---|
| Owner / manager | `owner@spicegarden.test` | `owner123` |
| Cashier / captain | `cashier@spicegarden.test` | `cashier123` |
| Kitchen screen | `kitchen@spicegarden.test` | `kitchen123` |
| Captain with fewer rights | `captain@spicegarden.test` | `captain123` |

The owner panel is at <http://localhost:3000/platform> (sign in with the
`PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` from `.env`).

## Selling the software to restaurants (`/platform`)

1. In your hosting settings add `PLATFORM_ADMIN_EMAIL` and
   `PLATFORM_ADMIN_PASSWORD` (at least 10 characters), then redeploy. This is
   the only owner-panel account; it lives in the hosting settings, not in the
   database. Without both variables `/platform` stays locked.
2. Open `https://<your-site>/platform` and sign in.
3. **Add a restaurant**: name, city, owner's name, email and phone, monthly fee
   and the first month to charge. You get the owner's sign-in once, ready to
   copy or send on WhatsApp.
4. The owner signs in at `/login`, then sets up their tables, menu, tax, bill
   design (with logo) and staff. The built-in **Help & guide** walks them through it.
   For an owner with **another outlet**, switch on “This owner already has a
   restaurant with you” when adding it: no new sign-in, they switch outlets
   from their menu. (Or link outlets later from the restaurant's page.)
5. Each month, **Record a payment** when they pay you. Owners with late months
   see a polite reminder. **Pause** a restaurant to stop its staff signing in;
   nothing is deleted.

## Landing page and demo enquiries

Visitors who are not signed in see the landing page at `/` (also at `/welcome`): the
product tour video, every feature, questions and an **Ask for a free demo** form. Staff
who are signed in go straight to their Tables screen.

Each enquiry appears in the owner panel under **Enquiries** (call, WhatsApp, notes,
status, **Add as restaurant**). To also get each one by email:

1. Sign up at <https://resend.com> with the email that should receive enquiries and
   create an API key (*API Keys → Create API Key*, sending access).
2. In Vercel add `RESEND_API_KEY` (the key) and `ENQUIRY_EMAIL_TO` (that email), then redeploy.
3. In the owner panel open **Enquiries → Send a test email**.

Without your own domain, Resend only delivers to the email you signed up with. To send to
any address, verify a domain in Resend and set `EMAIL_FROM`, e.g. `RestoOwl <hello@yourdomain.com>`.

## Deploying (Vercel + Postgres)

The live project is **restaurant-software** on Vercel, connected to this repository:
every push to the production branch deploys automatically.

1. Create a Vercel project from this repository (framework: Next.js; `vercel.json` sets the build command).
2. **Storage → Create Database → Neon (Serverless Postgres)**, free plan, and connect it to the
   project for Production, Preview and Development. Keep the default variable prefix so
   `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are set. Migrations use the unpooled (direct)
   connection automatically.
3. Add `JWT_SECRET` (long random text), `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD`
   (10+ characters) under **Settings → Environment Variables**.
4. Connect **Vercel Blob** storage so logo uploads are kept (`BLOB_READ_WRITE_TOKEN`), and set
   `STORAGE_DRIVER=blob`.
5. Deploy. Production builds run database migrations; preview builds don't touch the database.
6. Open `/platform`, sign in with the owner-panel email and password, and add your first restaurant.

On the Hobby plan Vercel only deploys commits whose author is the account owner, so commit
with the email of the Vercel account.

## Guest pages (no sign-in)

| Page | What it is |
|---|---|
| `/m/<restaurant>` | QR menu. With a table QR code (`?t=…`) guests can also order, call a waiter and ask for the bill |
| `/b/<signed link>` | A bill sent to a guest on WhatsApp. The link is signed, so other bills cannot be guessed |

## Printing

Bills and KOTs open in a small window sized for the paper (58 mm / 80 mm
thermal or A4) and the print dialog opens by itself. On a dedicated billing
PC, start Chrome with `--kiosk-printing` to print without the dialog. Kitchens
without a printer can switch KOT printing off per device.

## Development

```bash
npm run dev         # start the app
npm test            # unit tests (billing maths incl. charges and points, menu parsing, stock use, tenant isolation, subscriptions)
npm run typecheck
npm run lint
```

Project layout:

```
prisma/schema.prisma          data model (Restaurant, Staff, DiningTable, MenuItem, Order, OrderItem, Payment, Customer, Expense, DayClose, StockItem, RecipeLine…)
src/lib/billing.ts            the one bill calculator used by the till, the printed bill and the server
src/lib/bill-template.ts      bill design options, defaults and ready-made styles
src/lib/db.ts                 per-restaurant data isolation (every query is limited to one restaurant)
src/lib/orders.ts             order numbers, pricing from the menu, kitchen tickets, totals
src/lib/customers.ts          customers and loyalty points on paid / cancelled bills
src/lib/stock.ts              stock entries and recipe usage on paid / cancelled bills
src/lib/cash.ts               day summary for the cash drawer and day close
src/components/bill-view.tsx  the printed bill (also used for the live preview)
src/components/pos/           the order screen and its dialogs
src/app/(app)/                restaurant screens
src/app/kitchen/              full-screen kitchen display
src/app/m/, src/app/b/        guest QR menu and shared bills (no sign-in)
src/app/platform/             software provider's owner panel
src/app/print/                bill, KOT and test-print pages
src/app/api/                  JSON API
```
