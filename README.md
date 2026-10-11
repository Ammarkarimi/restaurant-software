# Restaurant Manager — simple restaurant billing, tables, menu & KOT

Point-of-sale software for independent restaurants, cafés, dhabas and cloud
kitchens: a **table view**, a fast **order screen**, **kitchen tickets (KOT)**,
**GST bills** with a **bill design you can customise** (your logo, what to
print, paper size, UPI QR code to pay), split payments, menu management,
reports and staff accounts.

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
| **Order screen (POS)** | Menu by category, search by name or **short code** (press Enter to add), veg / non-veg / egg marks, **portions** (Half / Full), sold-out dishes greyed out, **open items** not on the menu. Notes per item (“less spicy”). Customer, guests, discount (% or amount, with reason), move to another table, cancel with reason. Works on a phone for captains |
| **Kitchen tickets (KOT)** | “Send to kitchen” prints only the new items, without prices, with table, KOT number, time and notes. Items removed after a KOT print as CANCELLED |
| **Billing** | GST split into CGST + SGST (or one VAT line, or no tax), prices with or without tax, per-dish tax rate, service charge, round-off, sequential bill numbers with your prefix |
| **Payment** | Cash, UPI, card or **split** (part cash, part UPI). Change to return for cash. UPI QR on screen with the amount filled in |
| **Bill design** | Upload your **logo**, start from 4 ready-made styles (Classic thermal, Modern café, Compact 58 mm, A4 invoice), show / hide every line (GSTIN, FSSAI, table, staff, customer, veg marks, tax table, amount in words…), header and thank-you message, font, size, colour, **UPI QR code**, 58 mm / 80 mm thermal or A4. **Live preview** and a **test print** |
| **Bills** | Every order by date and status, search by bill no., order no., table, name or phone, reprint any bill |
| **Menu** | Categories (reorder, hide), dishes with price or portions, food type, short code, tax rate, description, “sold out today” switch (cashiers can use it too). **Quick add**: paste your whole menu, or copy columns from Excel |
| **Table setup** | Add many tables at once (T1–T10), areas, seats. Tables with old bills are hidden, never lost |
| **Reports** (owner) | Sales, bills, average bill, guests, discounts, tax, cancellations; sales by day and by hour; payment modes; order types; sales by staff; best-selling dishes; category sales; GST summary. CSV downloads for Excel |
| **Staff & security** | Owner / manager and cashier / captain roles. Cashiers can't see reports, edit the menu or settings, or cancel an order once food went to the kitchen. Activity history of who discounted, removed items or cancelled. Login rate limiting |
| **Owner panel (`/platform`)** | For you, the software provider: add restaurants and hand out the owner's sign-in (copy or send on WhatsApp), monthly fee and free months, record payments, see who has paid and who is late, usage (tables, dishes, bills, sales), give anyone a new password, pause or delete a restaurant |

## Quick start (local)

Requirements: **Node.js 20+** and **PostgreSQL 14+**.

```bash
# 1. Start PostgreSQL (or use your own)
docker compose up -d

# 2. Configure — set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD for the owner panel
cp .env.example .env

# 3. Install, create the database tables and load the demo restaurant
npm install
npm run db:setup:dev     # migrations + "Spice Garden" demo with menu, tables and two weeks of bills
npm run dev
```

Open <http://localhost:3000> and sign in to the demo restaurant:

| Role | Email | Password |
|---|---|---|
| Owner / manager | `owner@spicegarden.test` | `owner123` |
| Cashier / captain | `cashier@spicegarden.test` | `cashier123` |

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
5. Each month, **Record a payment** when they pay you. Owners with late months
   see a polite reminder. **Pause** a restaurant to stop its staff signing in;
   nothing is deleted.

## Deploying (Vercel + Postgres)

Same as the hotel software:

1. Create a Vercel project from this repository.
2. Connect a Postgres database (e.g. Neon) so `DATABASE_URL` is set.
3. Add `JWT_SECRET` (long random text), `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`.
4. Connect **Vercel Blob** storage so logo uploads are kept (`BLOB_READ_WRITE_TOKEN`).
5. Deploy. Production builds run database migrations automatically; preview builds don't touch the database.

## Printing

Bills and KOTs open in a small window sized for the paper (58 mm / 80 mm
thermal or A4) and the print dialog opens by itself. On a dedicated billing
PC, start Chrome with `--kiosk-printing` to print without the dialog. Kitchens
without a printer can switch KOT printing off per device.

## Development

```bash
npm run dev         # start the app
npm test            # unit tests (billing maths, menu parsing, bill templates, tenant isolation, subscriptions)
npm run typecheck
npm run lint
```

Project layout:

```
prisma/schema.prisma          data model (Restaurant, Staff, DiningTable, MenuCategory, MenuItem, Order, OrderItem, Payment…)
src/lib/billing.ts            the one bill calculator used by the till, the printed bill and the server
src/lib/bill-template.ts      bill design options, defaults and ready-made styles
src/lib/db.ts                 per-restaurant data isolation (every query is limited to one restaurant)
src/lib/orders.ts             order numbers, pricing from the menu, kitchen tickets, totals
src/components/bill-view.tsx  the printed bill (also used for the live preview)
src/components/pos/           the order screen and its dialogs
src/app/(app)/                restaurant screens
src/app/platform/             software provider's owner panel
src/app/print/                bill, KOT and test-print pages
src/app/api/                  JSON API
```
