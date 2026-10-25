import type { Metadata } from "next";
import Link from "next/link";
import {
  Armchair,
  BadgeIndianRupee,
  Bike,
  Building2,
  ChefHat,
  Check,
  ClipboardList,
  Download,
  FileText,
  Gift,
  LineChart,
  PlayCircle,
  Printer,
  QrCode,
  ShieldCheck,
  Smartphone,
  Split,
  Users,
  UtensilsCrossed,
  Wallet,
  Warehouse,
} from "lucide-react";
import { TourVideo } from "./tour-video";
import { EnquiryForm } from "./enquiry-form";

const TITLE = "Restaurant Manager — billing, KOT, kitchen screen and QR ordering for restaurants";
const DESCRIPTION =
  "Simple restaurant software for India: table orders, kitchen tickets, GST bills with your logo, UPI payments, QR menu ordering, Zomato & Swiggy orders, customers and loyalty, day close, stock and reports. Works on PC, tablet and phone.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", images: [{ url: "/landing/tour-poster.webp", width: 1280, height: 824 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/landing/tour-poster.webp"] },
};

/** A screenshot in a light browser-window frame. */
function Shot({ src, alt, width, height, className = "" }: { src: string; alt: string; width: number; height: number; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/10 ${className}`}>
      <div className="flex gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" className="block h-auto w-full" />
    </div>
  );
}

/** A screenshot from a phone, in a phone frame. */
function PhoneShot({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rounded-[2.2rem] bg-slate-900 p-2.5 shadow-2xl ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={390} height={844} loading="lazy" decoding="async" className="block h-auto w-full rounded-[1.7rem]" />
    </div>
  );
}

const STEPS = [
  { title: "Get your sign-in", text: "We create your restaurant and send you a sign-in on WhatsApp. Nothing to install — open it in Chrome." },
  { title: "Add tables and menu", text: "Add T1 to T20 in one go and paste your whole menu from Excel. Upload your logo and choose your bill style." },
  { title: "Take orders", text: "Tap a table, tap dishes, press Send to kitchen. The kitchen gets a ticket on the printer or the kitchen screen." },
  { title: "Bill, get paid, relax", text: "Print or WhatsApp the GST bill, take cash, UPI or card, and see today's sales from anywhere." },
];

const FEATURES: Array<{ icon: typeof Armchair; eyebrow: string; title: string; text: string; points: string[]; image: string; alt: string; phone?: boolean }> = [
  {
    icon: Armchair,
    eyebrow: "Tables",
    title: "Your whole floor on one screen",
    text: "See which tables are free, which are eating and which are waiting to pay — with the amount so far and how long they have been there.",
    points: ["Free, running and bill-printed tables in colours", "Today's sales, bills and running orders on top", "Takeaway and delivery orders always in view", "Updates by itself on every till and phone"],
    image: "/landing/tables.webp",
    alt: "The Tables screen with free, running and bill-printed tables and today's sales",
  },
  {
    icon: UtensilsCrossed,
    eyebrow: "Order screen",
    title: "Take an order in seconds",
    text: "Big buttons, your menu by category, and a search box that understands short codes. New staff learn it in minutes.",
    points: ["Type a short code like “PBM” and press Enter", "Half / Full portions and veg / non-veg marks", "Notes for the kitchen: “less spicy”, “no onion”", "Sold-out dishes are greyed out for everyone"],
    image: "/landing/order.webp",
    alt: "The order screen with the menu on the left and the table's order on the right",
  },
  {
    icon: ChefHat,
    eyebrow: "Kitchen",
    title: "Kitchen tickets and a kitchen screen",
    text: "“Send to kitchen” prints only the new dishes on the kitchen printer, and shows them on a tablet or TV in the kitchen.",
    points: ["Tickets turn amber after 10 and red after 20 minutes", "A sound for every new ticket", "Cooks tap “Ready” — waiters see it on their screen", "The kitchen can mark dishes sold out"],
    image: "/landing/kitchen.webp",
    alt: "The kitchen screen with tickets for each table and timers",
  },
  {
    icon: FileText,
    eyebrow: "GST bills",
    title: "Bills with your logo, the way you want them",
    text: "GST split into CGST and SGST, your GSTIN and FSSAI number, and a UPI QR code so guests can pay by scanning. Choose a style and what to print — no technician needed.",
    points: ["58 mm, 80 mm thermal printers or A4", "Prices with or without tax, service charge, round-off", "Ready-made styles with a live preview", "Bill numbers in order, with your own prefix"],
    image: "/landing/bill.webp",
    alt: "A printed GST bill with the restaurant's logo, CGST and SGST",
  },
  {
    icon: BadgeIndianRupee,
    eyebrow: "Payments",
    title: "Cash, UPI, card — or all three",
    text: "Split one bill across cash and UPI, see the change to give back, and show a UPI QR code with the exact amount on the screen.",
    points: ["Split payment and split bill", "Change calculator for cash", "Send the bill on WhatsApp instead of paper", "Zomato and Swiggy orders marked “paid online”"],
    image: "/landing/payment.webp",
    alt: "The payment window with cash and UPI and a UPI QR code",
  },
  {
    icon: QrCode,
    eyebrow: "QR menu & table ordering",
    title: "Guests order from their table",
    text: "Print a QR code for every table. Guests scan it to see your menu, order, call a waiter or ask for the bill. Staff check every guest order before the kitchen starts.",
    points: ["No app to install for guests", "Always shows today's sold-out dishes", "Waiter calls light up on the Tables screen", "Works as a menu-only QR too"],
    image: "/landing/qr-menu.webp",
    alt: "The QR menu on a guest's phone",
    phone: true,
  },
  {
    icon: Bike,
    eyebrow: "Takeaway & delivery",
    title: "Zomato, Swiggy, phone and walk-in orders",
    text: "Note where each order came from and the app's order ID — it prints on the kitchen ticket and the bill. Packing and delivery charges are added automatically.",
    points: ["Order source in reports", "Packing and delivery charges, taxed correctly", "Delivery address on the bill", "Running orders at the top of Tables"],
    image: "/landing/delivery.webp",
    alt: "A Zomato delivery order with packing and delivery charges",
  },
  {
    icon: Gift,
    eyebrow: "Customers & loyalty",
    title: "Know your regulars and bring them back",
    text: "Every guest with a phone number is saved with their visits and spend. Give loyalty points on every bill that they use as money off next time.",
    points: ["Returning guests fill in by phone number", "Points earned and used, shown on the bill", "Notes and birthdays for each customer", "Download the list for offers"],
    image: "/landing/customers.webp",
    alt: "The customer list with visits, spend and loyalty points",
  },
  {
    icon: Wallet,
    eyebrow: "Cash & day close",
    title: "The cash drawer that adds up",
    text: "Record money paid out of the till. At night, count the notes and see straight away if the drawer is short or has extra.",
    points: ["Sales by payment mode", "Expenses by staff, with who and when", "Note counter for the drawer", "Printed day summary for the owner"],
    image: "/landing/day-close.webp",
    alt: "The day close screen with the cash drawer count",
  },
  {
    icon: Warehouse,
    eyebrow: "Stock & recipes",
    title: "Know what is left in the kitchen",
    text: "Add a recipe to each dish once. Every paid bill takes the ingredients out of stock, and you get a warning before you run out.",
    points: ["Purchases, wastage and stock counts", "Per-portion recipes (Half / Full)", "Low-stock warnings on the Tables screen", "Usage report with stock value"],
    image: "/landing/stock.webp",
    alt: "The stock screen with low-stock warnings",
  },
  {
    icon: LineChart,
    eyebrow: "Reports",
    title: "Your business at a glance",
    text: "Sales by day and by hour, best-selling dishes, payment modes, order sources, discounts and a GST summary ready for your accountant.",
    points: ["Download any report for Excel", "Who gave discounts or cancelled — all recorded", "Expenses against sales", "All outlets together if you have more than one"],
    image: "/landing/reports.webp",
    alt: "Reports with sales by day, busy hours and best-selling dishes",
  },
];

const MORE = [
  { icon: Split, title: "Split, move & merge", text: "Move dishes to a separate bill or another table in two taps." },
  { icon: Users, title: "Staff accounts", text: "Owner, cashier / captain and kitchen logins, each with the right access." },
  { icon: ShieldCheck, title: "Stops leakage", text: "Discounts, removed dishes and cancellations need a reason and are recorded." },
  { icon: Smartphone, title: "Phone, tablet, PC", text: "Captains take orders on their phone. Install it like an app." },
  { icon: Printer, title: "Any thermal printer", text: "58 mm, 80 mm or A4 — bills and kitchen tickets print from the browser." },
  { icon: Building2, title: "More outlets", text: "One sign-in for all your outlets, with their sales side by side." },
  { icon: Download, title: "Your data, your files", text: "Download bills, sales, tax and customers as Excel files any time." },
  { icon: ClipboardList, title: "Help built in", text: "A plain-language guide inside the app for every screen." },
];

const FAQ = [
  { q: "Do I need to buy special hardware?", a: "No. It runs in Chrome on the computer you already have, on tablets and on phones. Any USB or network thermal printer works for bills and kitchen tickets." },
  { q: "Does it work on a phone?", a: "Yes. Captains can take orders on their own phones, the owner can check sales from home, and the kitchen can use any tablet as a kitchen screen." },
  { q: "Is it ready for GST in India?", a: "Yes. Bills show CGST and SGST, your GSTIN and FSSAI number, and the tax summary report is ready for your accountant. Prices can include or exclude tax." },
  { q: "Can I use it with Zomato and Swiggy?", a: "Yes. Enter app orders with their order ID; they print on the kitchen ticket, are marked “paid online”, and show separately in reports. Orders don't arrive by themselves yet — that needs a partnership with each app." },
  { q: "How long does it take to start?", a: "Most restaurants are taking orders the same day. Add your tables in one go, paste your menu from Excel, upload your logo, and you are ready." },
  { q: "Is my data safe?", a: "Each restaurant only ever sees its own data. Every sign-in is personal, and owners can see who did what in the activity history." },
  { q: "What if I have more than one outlet?", a: "Each outlet has its own tables, menu and staff, and the owner switches between them with one sign-in and sees all outlets' sales together." },
];

const INDIA = ["CGST + SGST on every bill", "GSTIN and FSSAI printed", "UPI QR with the amount filled in", "Half / Full portions", "Veg, non-veg and egg marks", "Zomato & Swiggy order IDs", "Rupees and Indian number format", "Thermal printers you already use"];

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/welcome" className="flex items-center gap-2">
            <span className="rounded-xl bg-primary-600 p-1.5 text-white">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">Restaurant Manager</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#tour" className="rounded-lg px-3 py-2 hover:bg-slate-100">Watch the tour</a>
            <a href="#features" className="rounded-lg px-3 py-2 hover:bg-slate-100">Features</a>
            <a href="#how" className="rounded-lg px-3 py-2 hover:bg-slate-100">How it works</a>
            <a href="#faq" className="rounded-lg px-3 py-2 hover:bg-slate-100">Questions</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Sign in
            </Link>
            <a href="#demo" className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
              Free demo
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-white to-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:pb-24 lg:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-primary-700 ring-1 ring-primary-200">
                Made for Indian restaurants, cafés & cloud kitchens
              </p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Run your restaurant from <span className="text-primary-600">one simple screen</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-600">
                Table orders, kitchen tickets, GST bills with your logo, UPI payments, QR ordering, Zomato & Swiggy orders, customers, stock and reports — easy enough for
                every cashier, on the PC, tablet and phones you already have.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#tour" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-slate-800">
                  <PlayCircle className="h-5 w-5" /> Watch the 5-minute tour
                </a>
                <a href="#demo" className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-primary-700">
                  Ask for a free demo
                </a>
              </div>
              <ul className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-2 text-[15px] text-slate-700">
                {["No special hardware", "GST & UPI ready", "Set up the same day", "Works on any phone"].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <Check className="h-5 w-5 shrink-0 text-emerald-600" /> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <Shot src="/landing/order.webp" alt="The order screen" width={1600} height={900} />
              <PhoneShot src="/landing/qr-menu.webp" alt="The QR menu on a guest's phone" className="absolute -bottom-10 -left-4 hidden w-40 sm:block lg:-left-10 lg:w-48" />
            </div>
          </div>
        </section>

        {/* Tour video */}
        <section id="tour" className="scroll-mt-20 bg-slate-50 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-primary-700">See it working</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">A day in a restaurant, in five minutes</h2>
              <p className="mt-3 text-lg text-slate-600">
                From the first order to closing the till: taking orders, the kitchen screen, GST bills, UPI payments, guests ordering from the QR code, Zomato orders,
                customers, day close, stock and reports.
              </p>
            </div>
            <TourVideo />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-primary-700">How it works</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Taking orders the same day</h2>
            </div>
            <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-lg font-extrabold text-white">{i + 1}</span>
                  <p className="mt-4 text-lg font-bold">{s.title}</p>
                  <p className="mt-2 text-[15px] text-slate-600">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 bg-slate-50 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-primary-700">Features</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Everything from the table to the till</h2>
              <p className="mt-3 text-lg text-slate-600">One app instead of a billing machine, a notebook for the kitchen and a register for the cash.</p>
            </div>
            <div className="space-y-20 lg:space-y-28">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                    <div className={i % 2 ? "lg:order-2" : ""}>
                      <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-700">
                        <Icon className="h-5 w-5" /> {f.eyebrow}
                      </p>
                      <h3 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{f.title}</h3>
                      <p className="mt-3 text-lg text-slate-600">{f.text}</p>
                      <ul className="mt-6 space-y-2.5">
                        {f.points.map((p) => (
                          <li key={p} className="flex items-start gap-2.5 text-[15px] text-slate-700">
                            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={i % 2 ? "lg:order-1" : ""}>
                      {f.phone ? (
                        <PhoneShot src={f.image} alt={f.alt} className="mx-auto w-64 sm:w-72" />
                      ) : (
                        <Shot src={f.image} alt={f.alt} width={1600} height={900} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-24">
              <h3 className="text-center text-2xl font-extrabold tracking-tight">And everything else a busy restaurant needs</h3>
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {MORE.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <span className="inline-flex rounded-xl bg-primary-50 p-2.5 text-primary-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <p className="mt-3 font-bold">{m.title}</p>
                      <p className="mt-1 text-[15px] text-slate-600">{m.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Phones */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-primary-700">Works everywhere</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">The counter, the floor and the kitchen — in sync</h2>
              <p className="mt-4 text-lg text-slate-600">
                The cashier bills on the PC, captains take orders on their phones at the table, the kitchen sees tickets on a tablet, and the owner checks sales from home.
                Everything updates by itself.
              </p>
              <div className="mt-8 rounded-2xl bg-primary-50 p-6 ring-1 ring-primary-100">
                <p className="font-bold text-primary-900">Made for India</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {INDIA.map((x) => (
                    <li key={x} className="flex items-center gap-2 text-[15px] text-slate-700">
                      <Check className="h-4 w-4 shrink-0 text-primary-600" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex items-end justify-center gap-5">
              <PhoneShot src="/landing/captain.webp" alt="A captain taking an order on a phone" className="w-44 sm:w-56" />
              <PhoneShot src="/landing/qr-order.webp" alt="A guest placing an order from the QR menu" className="mb-10 w-44 sm:w-56" />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-slate-50 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Questions restaurant owners ask</h2>
            <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                    {f.q}
                    <span className="text-2xl font-light text-slate-400 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-[15px] text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Demo */}
        <section id="demo" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-primary-700">Free demo</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">See it with your own menu</h2>
              <p className="mt-4 text-lg text-slate-600">
                Leave your number and we&apos;ll call you to show the software, set up your tables and menu, and get you billing — usually the same day.
              </p>
              <ul className="mt-6 space-y-2.5">
                {["We set up your restaurant for you", "Training for your cashier and captains", "Help on WhatsApp when you need it"].map((x) => (
                  <li key={x} className="flex items-center gap-2.5 text-[15px] text-slate-700">
                    <Check className="h-5 w-5 shrink-0 text-emerald-600" /> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
              <EnquiryForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-primary-600 p-1.5 text-white">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <span className="font-bold text-white">Restaurant Manager</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="#tour" className="hover:text-white">Watch the tour</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#demo" className="hover:text-white">Free demo</a>
            <Link href="/login" className="hover:text-white">Staff sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
