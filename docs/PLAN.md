# Restaurant Manager: research and plan

This document explains **what** we built and **why**. It is written so a
restaurant owner can read it, with a technical section at the end.

## 1. Who we are building for

Independent restaurants, cafés, dhabas, cloud kitchens and small chains with
roughly 5–60 tables. The owner or manager sets things up. Cashiers and
captains (waiters) change often and are not computer experts. The owner
wants to see today's sales without asking anyone.

Like the hotel software, **one installation serves many restaurants**. The
software provider (us) has a separate **owner panel at `/platform`**. From
there we create a restaurant, hand its owner a sign-in, collect a monthly
fee, and pause restaurants that stop paying. Each restaurant sees only its own
data.

## 2. What the market offers

| Product | Strong in | What people like | What people complain about |
|---|---|---|---|
| **Petpooja** | India, QSR and dine-in | Fast billing, KOT printing, table view, GST bills, menu with half/full portions | Many add-ons, learning curve for advanced modules |
| **Restroworks (Posist)** | Chains | Central menu, inventory, reports | Built for chains; heavy for one outlet |
| **Toast / Square for Restaurants / Lightspeed** | US / EU | Floor plan, coursing, modifiers, receipt designer with a logo | Hardware lock-in, payment fees |
| **Gofrugal, eZee Optimus, Torqus** | India | GST compliance, thermal printing | Dated interfaces |
| **DotPe, LimeTray** | India, QR ordering | QR menus, online ordering | Commission and marketing focus |

### Features common to all of them (must-haves)

1. **Table view.** A floor plan grouped by area (AC hall, garden, rooftop).
   Colours show free tables, running tables and tables waiting for payment.
   Tap a table to open its order.
2. **Order types.** Dine-in (table), takeaway and delivery.
3. **Menu.** Categories and items with price, **veg / non-veg / egg** mark,
   short code for quick search, **portions** (half / full, small / large),
   GST rate per item, and an *available today* switch for sold-out items.
4. **KOT (Kitchen Order Ticket).** "Send to kitchen" prints only the new
   items (no prices) for the kitchen. Adding more items later prints a
   second KOT.
5. **Billing.** Discount (% or amount), service charge, GST split into
   CGST + SGST, prices with or without tax, round-off, sequential bill
   numbers.
6. **Payments.** Cash, UPI, card. **Split payment** (part cash, part UPI),
   and the change to return for cash.
7. **Bill (receipt) design.** Logo, restaurant name, address, GSTIN, FSSAI
   licence number, header and footer messages, **UPI QR code** to pay, and
   **58 mm / 80 mm thermal or A4** paper. Owners want to choose what is
   printed.
8. **Reports.** Daily sales, item-wise sales, category sales, payment modes,
   tax summary, discounts, cancelled orders, export to Excel (CSV).
9. **Staff roles.** The owner / manager can see reports, change the menu and
   settings, and cancel bills. Cashiers and captains can take orders and bill.
10. **Activity history.** Who cancelled what, who gave a discount (to stop
    theft at the counter, a top complaint from owners).

### Common complaints we design against

- **"Too complicated."** Plain words, big buttons, one obvious next step.
  Staff should learn the billing screen in minutes.
- **"Changing the bill needs a technician."** The bill designer is
  self-service, with a **live preview** and ready-made styles.
- **"Staff misuse discounts and cancellations."** Every discount, removed
  item and cancellation is logged with a reason.
- **"Works only on the counter PC."** Fully responsive: phone (captain
  taking orders at the table), tablet and desktop.

## 3. What we built (scope of version 1)

### Software provider: owner panel (`/platform`)

Same as the hotel software:

- Sign in with `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` (set in
  hosting, not in the database).
- **Add a restaurant**: name, city, owner's name, email, phone, monthly fee
  and free months. You get the owner's sign-in once, to copy or send on
  WhatsApp.
- Restaurant list: who has paid this month, who is late, usage (tables,
  menu items, bills in the last 30 days, last sign-in).
- Restaurant page: record payments (several months, part payments), give
  any staff member a new password, edit details, **pause** or delete.

### Restaurant software

| Screen | What you can do |
|---|---|
| **Tables** (home) | Floor view by area, colour by status (free / running / bill printed), running amount and minutes since the order started. Today's sales, bills and running orders. One tap for a **new takeaway / delivery** |
| **Order (POS) screen** | Menu by category with search by name or short code, veg marks, portions. Cart with quantity +/−, notes per item ("less spicy"). **Send to kitchen** prints a KOT of the new items. Customer name / phone, guests, discount, move to another table, cancel with reason. **Print bill** and **Take payment** with split payments and change |
| **Bills** | All orders by date and status, search by bill number, customer or phone. Reprint any bill |
| **Menu** | Categories (reorder, hide) and items: price, portions, veg / non-veg / egg, short code, GST rate, description, *available today* switch. **Quick add**: paste many items at once |
| **Tables setup** | Areas and tables with seats. Add many tables at once (T1–T10) |
| **Reports** (owner) | Sales, bills, average bill, guests, discounts, tax, cancelled. Daily chart, payment modes, top items, category sales, GST summary. CSV download |
| **Settings** (owner) | Restaurant profile (address, GSTIN, FSSAI). Tax and charges (GST rate, prices include tax, service charge, round-off). **Bill design** with logo upload, three ready-made styles, show / hide every line, paper size, font, header / footer text, UPI QR, and a **live preview**. Staff accounts and activity history |
| **My account** | Change own password |
| **Print pages** | Bill (58 / 80 mm thermal or A4) and KOT |

### Version 2: what restaurants asked for next

| Feature | What it does |
|---|---|
| **Packing & delivery charges** | Usual charges in settings, added to takeaway / delivery orders, editable per order, taxed like the food |
| **Zomato / Swiggy orders** | Order source and the app's order ID on the order, kitchen ticket, bill and reports; “Paid online / app” payment |
| **Split bill, move, merge** | Move chosen dishes (and quantities) to a separate bill, another table, or a running table |
| **Customers & loyalty** | Customers from phone numbers on paid bills; points earned as a % of the bill and used as money off; reversed when a paid bill is cancelled |
| **WhatsApp e-bills** | A signed link to the bill that guests open without signing in |
| **Expenses & day close** | Money paid out, and the cash drawer counted against opening cash + cash sales − cash expenses |
| **Kitchen screen (KDS)** | Live tickets, ready / served, sold-out switch, kitchen-only accounts |
| **QR menu & table ordering** | Guests see the menu, order, call a waiter or ask for the bill; staff confirm guest orders before the kitchen gets them |
| **Stock & recipes** | Ingredients, purchases, wastage, counts; recipes take ingredients out when bills are paid |
| **Several outlets** | One owner sign-in for several restaurants, with an outlet switcher and a combined report |

Online order *integration* with Zomato / Swiggy (orders arriving by
themselves) needs a partner agreement with each app; until then their orders
are typed in with the source and app order ID.

## 4. Technical plan

Same stack as the hotel software, so one team can run both:

- **Next.js 15** (App Router) + **React 19** + **Tailwind CSS 4**
- **PostgreSQL** with **Prisma 6**
- JWT sessions in http-only cookies (`jose`), passwords hashed with `bcryptjs`
- File storage for logos: local disk, or **Vercel Blob** when
  `BLOB_READ_WRITE_TOKEN` is set
- Deploys to Vercel; production builds run database migrations

### Multi-restaurant isolation

Every table except `Restaurant` and `SubscriptionPayment` has a
`restaurantId`. Restaurant screens use a Prisma client extension that adds
`restaurantId` to every query and stamps it on every new row. Using it
outside a request for a known restaurant throws an error, so a missed check
fails loudly instead of leaking data. The owner panel uses a separate, raw
client.

Guest pages (QR menu, shared bills) find the restaurant by its slug or by a
signed bill link with the raw client, then switch to the restaurant-scoped
client for everything else. An owner with several outlets carries the chosen
outlet in their session; every request re-checks that their `OutletAccess`
still exists.

### Data model

```
Restaurant ─┬─ Staff (admin = owner/manager, staff = cashier/captain)
            ├─ RestaurantSettings (profile, tax, bill template JSON, logo)
            ├─ DiningTable (name, area, seats)
            ├─ MenuCategory ── MenuItem (price, portions JSON, food type, GST rate)
            ├─ Order (number, type, table, status, customer, discount,
            │    │    tax snapshot, bill number, totals snapshot)
            │    ├─ OrderItem (name/portion/price snapshot, qty, note, KOT number)
            │    └─ Payment (cash / UPI / card, split allowed)
            ├─ Customer (phone, visits, spend, loyalty points)
            ├─ Expense, DayClose (cash drawer per business day)
            ├─ StockItem ── StockEntry (purchase / used / returned / wastage / count)
            ├─ RecipeLine (dish [+ portion] → stock item, quantity per plate)
            ├─ OutletAccess (an owner of another restaurant who may manage this one)
            ├─ ActivityLog
            └─ SubscriptionPayment (what the restaurant pays us)
```

Key rules:

- **One running order per table**, enforced by a unique `activeTableId`
  column that is cleared when the order is paid or cancelled.
- **Prices are copied** onto order items, and tax settings are copied onto
  the order, so editing the menu or settings never changes old bills.
- **Bill numbers** are handed out in sequence only when a bill is printed,
  so cancelled orders before billing don't leave gaps.
- **Totals** come from one tested function (`src/lib/billing.ts`) used by the
  POS screen, the printed bill and the server.
- **Business date** (in the restaurant's time zone) is stored when a bill is
  paid, so "today's sales" is correct even after midnight UTC.

### Order lifecycle

```
open ──(Print bill)──▶ billed ──(Take payment)──▶ settled
  ▲                      │
  └──(items changed)─────┘        open/billed ──(Cancel + reason)──▶ cancelled
```
