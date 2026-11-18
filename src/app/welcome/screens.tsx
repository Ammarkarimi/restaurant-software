"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const SCREENS = [
  {
    key: "order",
    tab: "Order screen",
    title: "An order in a few taps",
    text: "Your menu by category, short codes like “PBM” + Enter, half / full portions, add-ons and notes for the kitchen.",
    points: ["Offers and happy-hour prices apply by themselves", "Send to kitchen prints only the new dishes", "Split, move or merge tables"],
    image: "/landing/order.webp",
  },
  {
    key: "payment",
    tab: "Bill & UPI",
    title: "GST bill, then cash, UPI or card",
    text: "CGST and SGST worked out, a UPI QR for the exact amount, split payments and gift cards. With Razorpay the bill closes by itself when the guest pays.",
    points: ["Your logo, GSTIN and FSSAI on the bill", "Bill on WhatsApp with a rating link", "Pay later for regulars, with a credit limit"],
    image: "/landing/payment.webp",
  },
  {
    key: "kitchen",
    tab: "Kitchen screen",
    title: "Tickets the kitchen can't miss",
    text: "A ticket for each station — tandoor, bar, main kitchen — on the printer or on a tablet, amber after 10 minutes and red after 20.",
    points: ["Zomato and Swiggy order numbers on the ticket", "Cooks tap ready; waiters see it", "Token screen for takeaway guests"],
    image: "/landing/kitchen.webp",
  },
  {
    key: "profit",
    tab: "Profit & reports",
    title: "Know what you actually made",
    text: "Profit & loss after food, salaries and bills, and which dishes earn their place on the menu — plus sales by day, hour, staff and payment mode.",
    points: ["GSTR-1 tables and Tally files for your accountant", "Leak alerts: bills changed after printing, cash short", "Daily report on WhatsApp at closing"],
    image: "/landing/profit.webp",
  },
  {
    key: "stock",
    tab: "Stock & purchases",
    title: "Stock that keeps itself up to date",
    text: "Recipes take ingredients out with every bill. Photograph a supplier's bill to add it to stock, and see what to reorder before you run out.",
    points: ["Dish cost and food cost % per plate", "Purchase orders on WhatsApp", "Transfers from a central kitchen to outlets"],
    image: "/landing/stock.webp",
  },
  {
    key: "tables",
    tab: "Tables",
    title: "The whole floor at a glance",
    text: "Free, running and bill-printed tables with the amount so far, and one list of what needs you now: a waiter call, a QR order, an online order.",
    points: ["Takeaway and delivery always in view", "Today's sales, bills and running orders", "Updates by itself on every till and phone"],
    image: "/landing/tables.webp",
  },
];

/** A browser-window frame around a screenshot. */
export function Frame({ src, alt, className = "", eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-20px_rgba(10,42,30,0.45)] ring-1 ring-black/10", className)}>
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2" aria-hidden>
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="ml-3 h-4 flex-1 rounded bg-white ring-1 ring-slate-200" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={1800} height={1125} loading={eager ? "eager" : "lazy"} decoding="async" className="block h-auto w-full" />
    </div>
  );
}

/** The product, screen by screen: pick a screen on the left, see it on the right. */
export function ScreenGallery() {
  const [active, setActive] = useState(0);
  const s = SCREENS[active];
  return (
    <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0" role="tablist" aria-label="Screens">
        {SCREENS.map((x, i) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2.5 text-left text-sm font-medium transition lg:px-4 lg:py-3",
              i === active ? "bg-forest text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 lg:bg-transparent lg:ring-0"
            )}
          >
            <span className="flex items-center gap-3">
              <span className={cn("hidden font-mono text-xs lg:inline", i === active ? "text-lime-brand" : "text-slate-400")}>{String(i + 1).padStart(2, "0")}</span>
              {x.tab}
            </span>
            {i === active && <span className="mt-1.5 hidden pl-8 text-[13px] font-normal leading-relaxed text-white/75 lg:block">{x.text}</span>}
          </button>
        ))}
      </div>
      <div className="min-w-0" role="tabpanel" aria-label={s.tab}>
        <Frame src={s.image} alt={`${s.tab}: ${s.title}`} eager={active === 0} />
        <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-start">
          <div>
            <h3 className="font-display text-2xl font-semibold tracking-tight text-forest">{s.title}</h3>
            <p className="mt-2 text-[15px] text-slate-600 lg:hidden">{s.text}</p>
          </div>
          <ul className="space-y-2">
            {s.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[15px] text-slate-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" /> {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
