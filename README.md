# Restaurant Manager — simple restaurant billing, tables, menu & KOT

Point-of-sale software for independent restaurants, cafés, dhabas and cloud
kitchens: a **table view**, a fast **order screen**, **kitchen tickets (KOT)**
and a **kitchen screen**, **GST bills** with a **bill design you can customise**
(your logo, what to print, paper size, UPI QR code to pay), split bills and
split payments, **Zomato / Swiggy orders**, a **QR menu with table ordering**,
**customers and loyalty points**, **WhatsApp e-bills**, **expenses and day
close**, **stock and recipes**, reports, staff accounts and several outlets per owner.

One installation serves **many restaurants**. Like the hotel software, you as
the software provider have your own **owner panel at `/platform`**: create a
restaurant and hand its owner a sign-in, track who has paid you each month,
and pause restaurants that don't pay. Each restaurant only ever sees its own data.

> **Why these features?** See [docs/PLAN.md](docs/PLAN.md): the market
> research (Petpooja, Restroworks/Posist, Toast, Square, Lightspeed…), what we
> built, and the technical design.

## Features

| Area | What you can do |
|---|---|
| **Tables** (home) | Floor view grouped by area (Main hall, Garden, Rooftop…). Free / running / bill-printed colours, running amount and minutes per table, red badge for items not yet sent to the kitchen. Today's sales, bills and running orders. Running takeaway and delivery orders on top. Refreshes itself so several tills and phones stay in sync |
| **Order screen (POS)** | Menu by category, search by name or **short code** (press Enter to add), veg / non-veg / egg marks, **portions** (Half / Full), sold-out dishes greyed out, **open items** not on the menu. Notes per item (“less spicy”). Customer lookup by phone, guests, discount (% or amount, with reason), move to another table, cancel with reason. Works on a phone for captains |
| **Split, move, merge** | Split a bill by dishes and quantities into a separate bill, move dishes to another table, or merge two tables. Kitchen tickets and prices move with the dishes |
| **Kitchen tickets (KOT)** | “Send to kitchen” prints only the new items, without prices, with table, KOT number, time, app order ID and notes. Items removed after a KOT print as CANCELLED |
| **Kitchen screen (KDS)** | Full-screen tickets for a kitchen tablet or TV, oldest first, amber after 10 and red after 20 minutes, sound for new tickets. Tap dishes ready; waiters see “2 ready” and mark them served. Kitchen can switch dishes to sold out. “Kitchen screen only” staff accounts |
| **Takeaway, delivery, apps** | Order source: walk-in, phone, **Zomato, Swiggy**, other app, with the app's order ID. **Packing and delivery charges** added automatically (editable per order), taxed like food. App orders are paid as “Paid online / app” |
| **Billing** | GST split into CGST + SGST (or one VAT line, or no tax), prices with or without tax, per-dish tax rate, service charge, packing / delivery charges, loyalty points, round-off, sequential bill numbers with your prefix |
| **Payment** | Cash, UPI, card, paid online or **split** (part cash, part UPI). Change to return for cash. UPI QR on screen with the amount filled in. **WhatsApp e-bill** link after payment |
| **QR menu & table ordering** | Printable QR codes per table and for the menu. Guests see the live menu (sold-out dishes marked), **order from the table**, **call a waiter** or **ask for the bill**. Guest orders wait for staff to check and send to the kitchen |
| **Customers & loyalty** | Customers saved from phone numbers on paid bills: visits, spend, last visit, notes, birthday. **Loyalty points** (earn a % of the bill, use them as money off), adjustments with a reason, CSV export |
| **Cash & day close** | Expenses paid out (cashiers can add today's). **Day close**: sales by payment mode, expenses, expected cash in the drawer, note counter, short / extra, cash left for tomorrow, printable day summary, history of closed days |
| **Stock & recipes** | Stock items with units, purchases (optionally saved as a cash expense), wastage, stock counts. **Recipes per dish** (per portion if needed): paid bills take ingredients out automatically, cancelled bills put them back. Low-stock warnings, stock value, usage report with CSV |
| **Bill design** | Upload your **logo**, start from 4 ready-made styles (Classic thermal, Modern café, Compact 58 mm, A4 invoice), show / hide every line (GSTIN, FSSAI, table, staff, customer, veg marks, tax table, amount in words…), header and thank-you message, font, size, colour, **UPI QR code**, 58 mm / 80 mm thermal or A4. **Live preview** and a **test print** |
| **Bills** | Every order by date and status, search by bill no., order no., table, name or phone, reprint any bill |
| **Menu** | Categories (reorder, hide), dishes with price or portions, food type, short code, tax rate, description, “sold out today” switch (cashiers can use it too). **Quick add**: paste your whole menu, or copy columns from Excel |
| **Table setup** | Add many tables at once (T1–T10), areas, seats. Tables with old bills are hidden, never lost |
| **Reports** (owner) | Sales, bills, average bill, guests, discounts, tax, cancellations; sales by day and by hour; payment modes; order types and sources; sales by staff; best-selling dishes; category sales; GST summary; expenses. CSV downloads for Excel |
| **Several outlets** | One owner, many restaurants: switch outlets from the menu, see all outlets' sales side by side. Linked from the owner panel |
| **Staff & security** | Owner / manager, cashier / captain and kitchen-screen-only roles. Cashiers can't see reports, customers, stock or settings, or cancel an order once food went to the kitchen. Activity history of who discounted, removed items, cancelled or changed points. Login and QR-order rate limiting |
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
npm run db:setup:dev     # migrations + "Spice Garden" demo: menu, tables, two weeks of bills, customers, expenses, stock
npm run dev
```

Open <http://localhost:3000> and sign in to the demo restaurant:

| Role | Email | Password |
|---|---|---|
| Owner / manager | `owner@spicegarden.test` | `owner123` |
| Cashier / captain | `cashier@spicegarden.test` | `cashier123` |
| Kitchen screen | `kitchen@spicegarden.test` | `kitchen123` |

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
any address, verify a domain in Resend and set `EMAIL_FROM`, e.g. `Restaurant Manager <hello@yourdomain.com>`.

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
