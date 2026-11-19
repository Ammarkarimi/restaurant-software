import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import {
  ArrowDown,
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  Check,
  ChefHat,
  Clock,
  FileSpreadsheet,
  Gift,
  Globe,
  HandCoins,
  MessageCircle,
  PartyPopper,
  Printer,
  QrCode,
  Receipt,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Star,
  Tag,
  TrendingUp,
  WifiOff,
} from "lucide-react";
import { BRAND, BrandMark } from "@/components/brand";
import { EnquiryForm } from "./enquiry-form";
import { Frame, ScreenGallery } from "./screens";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-fraunces" });

const TITLE = `${BRAND.name} — restaurant billing, KOT, GST and kitchen software for India`;
const DESCRIPTION = `${BRAND.name}: billing, kitchen tickets and kitchen screen, GST bills with your logo, UPI, QR and online ordering, Zomato & Swiggy, stock, staff salary, profit and reports for Indian restaurants, cafés and cloud kitchens. Works on the PC, tablet and phones you already have.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", images: [{ url: "/landing/tables.webp", width: 1800, height: 1125 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/landing/tables.webp"] },
};

/** A phone screenshot in a slim phone frame. */
function Phone({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rounded-[2rem] bg-[#06150f] p-2 shadow-[0_24px_50px_-18px_rgba(0,0,0,0.6)] ring-1 ring-white/10 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={390} height={844} loading="lazy" decoding="async" className="block h-auto w-full rounded-[1.6rem]" />
    </div>
  );
}

const PARTNERS = ["Zomato", "Swiggy", "UPI", "Razorpay", "WhatsApp", "Tally", "GSTR-1", "Thermal printers"];

const FEATURES: Array<{ icon: typeof BellRing; title: string; text: string; wide?: boolean; dark?: boolean }> = [
  { icon: BellRing, title: "Leak alerts on WhatsApp", text: "A bill paid for less than it was printed, a dish removed after the KOT, a big discount, cash short at closing — you hear about it at once, with who did it.", wide: true, dark: true },
  { icon: WifiOff, title: "Keeps billing offline", text: "Internet down? The counter keeps billing and printing; bills sync by themselves later." },
  { icon: QrCode, title: "QR menu & table ordering", text: "Guests see your menu with photos, order, call a waiter or pay the bill by UPI from the table." },
  { icon: Globe, title: "Your own online ordering", text: "Takeaway and delivery from your own link, with order tracking — no commission." },
  { icon: TrendingUp, title: "Profit & menu engineering", text: "What is left after food, salaries and bills — and which dishes are stars and which to rethink.", wide: true },
  { icon: HandCoins, title: "Staff salary & advances", text: "Monthly or daily pay from shifts, advances taken back, payslips." },
  { icon: Receipt, title: "Supplier bills from a photo", text: "Photograph the bill; it goes into stock. Reorder suggestions before you run out." },
  { icon: ScanLine, title: "Menu from a photo", text: "Photograph your menu card or upload Excel — the whole menu is in." },
  { icon: FileSpreadsheet, title: "GSTR-1 & Tally", text: "B2C, B2B, HSN and document tables and Tally vouchers in one click." },
  { icon: PartyPopper, title: "Banquets & parties", text: "Halls, per-plate packages, advances, function sheets and the GST invoice." },
  { icon: Gift, title: "Gift cards", text: "Sell cards for birthdays and festivals; guests pay with the card number." },
  { icon: CalendarClock, title: "Reservations & waitlist", text: "Bookings from your link, walk-in waitlist with a WhatsApp “table ready”." },
  { icon: Tag, title: "Offers & happy hours", text: "Coupons, “10% off above ₹1000”, rooftop or app prices — applied by themselves." },
  { icon: Star, title: "Ratings & Google reviews", text: "Guests rate the visit from the bill link; happy ones are sent to Google." },
  { icon: MessageCircle, title: "WhatsApp campaigns", text: "Birthday wishes and “we miss you” offers from your own WhatsApp." },
  { icon: ShieldCheck, title: "Staff rights", text: "Choose who may discount, cancel or reprint; everything has a reason and a name." },
  { icon: Building2, title: "Many outlets and a central kitchen", text: "One sign-in for every outlet with their sales side by side, and stock sent from the central kitchen to each outlet.", wide: true },
];

const STEPS = [
  { title: "Get your sign-in", text: "We set up your restaurant and send the sign-in on WhatsApp. Nothing to install — open it in Chrome." },
  { title: "Add tables and menu", text: "Add T1 to T20 in one go; import the menu from Excel or a photo of your menu card. Upload your logo." },
  { title: "Take orders", text: "Tap a table, tap dishes, send to the kitchen. Tickets print by station or show on the kitchen screen." },
  { title: "Bill and close the day", text: "GST bill on paper or WhatsApp, cash / UPI / card, and the day's report on your phone." },
];

const INDIA = ["CGST + SGST on every bill", "GSTIN & FSSAI printed", "UPI QR for the exact amount", "Half / Full portions", "Veg, non-veg & egg marks", "₹ and lakh / crore formats", "GSTR-1 and Tally files", "Zomato & Swiggy (section 9(5))"];

const FAQ = [
  { q: "Do I need to buy special hardware?", a: "No. It runs in Chrome on the computer you already have, on tablets and on phones. Any USB or network thermal printer works for bills and kitchen tickets." },
  { q: "Does it work on a phone?", a: "Yes. Captains take orders on their own phones, the owner checks sales from home, and any tablet can be the kitchen screen." },
  { q: "Is it ready for GST in India?", a: "Yes. Bills show CGST and SGST, your GSTIN and FSSAI number. GSTR-1 tables and Tally files are ready for your accountant. Prices can include or exclude tax." },
  { q: "Can I use it with Zomato and Swiggy?", a: "Yes. Through UrbanPiper, Zomato and Swiggy orders arrive by themselves with a sound; accept, mark food ready and hand to the rider — the app is told each step. Reports show what the apps pay you after commission." },
  { q: "What if the internet goes down?", a: "Keep billing. The billing computer keeps the menu, prints kitchen tickets and bills, and sends the bills to your account by itself when the internet is back." },
  { q: "Can guests order from us directly?", a: "Yes. Your own ordering link for takeaway and delivery to share on Instagram, Google Maps and WhatsApp, with no commission, plus a booking link for tables." },
  { q: "How long does it take to start?", a: "Most restaurants take orders the same day: add your tables in one go, import your menu from Excel or a photo, upload your logo, and you are ready." },
  { q: "Is my data safe?", a: "Each restaurant only ever sees its own data. Every sign-in is personal, and owners can see who did what in the activity history. Download everything as Excel files any time." },
];

export default function WelcomePage() {
  return (
    <div className={`${display.variable} min-h-screen bg-white text-slate-900`}>
      {/* Hero: deep green, centred, the product below */}
      <div className="relative overflow-hidden bg-forest-deep text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          aria-hidden
        />
        <header className="relative">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
            <Link href="/welcome" className="flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
              <BrandMark className="h-9 w-9" />
              <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
            </Link>
            <nav className="ml-8 hidden items-center gap-1 text-sm text-white/70 lg:flex">
              <a href="#screens" className="rounded-md px-3 py-2 hover:text-white">Screens</a>
              <a href="#features" className="rounded-md px-3 py-2 hover:text-white">Features</a>
              <a href="#how" className="rounded-md px-3 py-2 hover:text-white">How it works</a>
              <a href="#faq" className="rounded-md px-3 py-2 hover:text-white">Questions</a>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-white/85 hover:text-white">
                Sign in
              </Link>
              <a href="#demo" className="rounded-md bg-lime-brand px-4 py-2 text-sm font-semibold text-forest hover:brightness-95">
                Book a demo
              </a>
            </div>
          </div>
        </header>

        <section className="relative mx-auto max-w-5xl px-4 pb-0 pt-14 text-center sm:px-6 lg:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px] text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-brand" /> For restaurants, cafés and cloud kitchens in India
          </p>
          <h1 className="font-display mx-auto mt-6 max-w-4xl text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Every bill, every table, <em className="font-medium text-lime-brand">every rupee.</em>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-white/75 sm:text-lg">
            Billing, kitchen tickets, GST, UPI, Zomato & Swiggy, stock, salaries and your profit — in one app on the PC, tablet and phones you already have.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#demo" className="inline-flex items-center gap-2 rounded-md bg-lime-brand px-5 py-3 text-[15px] font-semibold text-forest hover:brightness-95">
              Book a free demo <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#screens" className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-3 text-[15px] font-medium text-white hover:bg-white/5">
              See the screens <ArrowDown className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-5 text-[13px] text-white/55">No hardware to buy · Set up the same day · Keeps billing when the internet drops</p>

          <div className="relative mx-auto mt-14 max-w-6xl">
            <Frame src="/landing/tables.webp" alt="The Tables screen: today's figures, what needs attention, takeaway orders and the floor" eager className="translate-y-6" />
            <div className="absolute -left-2 top-1/3 hidden w-60 rounded-lg bg-white p-3 text-left text-slate-900 shadow-xl ring-1 ring-black/5 md:block lg:-left-10">
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                  <QrCode className="h-3.5 w-3.5" />
                </span>
                UPI received
              </p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight">₹1,219</p>
              <p className="text-xs text-slate-500">Table T2 · bill closed by itself</p>
            </div>
            <div className="absolute -right-2 bottom-1/4 hidden w-56 rounded-lg bg-[#13202b] p-3 text-left text-white shadow-xl ring-1 ring-white/10 md:block lg:-right-10">
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <ChefHat className="h-4 w-4 text-amber-400" /> KOT 293 · Tandoor
              </p>
              <p className="mt-1.5 text-sm">2 × Paneer Tikka</p>
              <p className="text-sm">4 × Tandoori Roti</p>
            </div>
          </div>
        </section>
      </div>

      <main>
        {/* Works with */}
        <section className="border-b border-slate-200 bg-white pb-8 pt-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Works with what you already use</p>
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-lg font-semibold tracking-tight text-slate-400">
              {PARTNERS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Screens */}
        <section id="screens" className="scroll-mt-6 bg-[#f5f6f2] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-12 max-w-2xl">
              <p className="text-sm font-medium text-primary-700">The screens</p>
              <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight text-forest sm:text-5xl">From the first order to closing the till.</h2>
            </div>
            <ScreenGallery />
          </div>
        </section>

        {/* Phones */}
        <section className="overflow-hidden bg-forest py-20 text-white lg:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-sm font-medium text-lime-brand">On every phone</p>
              <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">The counter, the floor and the guest, in sync.</h2>
              <p className="mt-5 max-w-lg text-lg text-white/75">
                Captains take orders on their own phones at the table. Guests scan the table QR to see the menu, order, call a waiter or pay. The owner checks the day from home. Everything updates by itself.
              </p>
              <ul className="mt-8 grid max-w-lg gap-3 sm:grid-cols-2">
                {[
                  { icon: Smartphone, t: "Captain app in the browser" },
                  { icon: QrCode, t: "QR menu with dish photos" },
                  { icon: Printer, t: "Any 58 / 80 mm printer" },
                  { icon: Clock, t: "Live on every screen" },
                ].map(({ icon: Icon, t }) => (
                  <li key={t} className="flex items-center gap-2.5 text-[15px] text-white/85">
                    <Icon className="h-4 w-4 text-lime-brand" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-end justify-center gap-4 sm:gap-6">
              <figure className="w-[30%] max-w-[220px]">
                <Phone src="/landing/captain.webp" alt="A captain's phone with the table's order" />
                <figcaption className="mt-3 text-center text-[13px] text-white/60">Captain</figcaption>
              </figure>
              <figure className="mb-12 w-[34%] max-w-[250px]">
                <Phone src="/landing/qr-menu.webp" alt="The QR menu on a guest's phone" />
                <figcaption className="mt-3 text-center text-[13px] text-white/60">Guest at the table</figcaption>
              </figure>
              <figure className="w-[30%] max-w-[220px]">
                <Phone src="/landing/phone-tables.webp" alt="The owner's phone with today's sales" />
                <figcaption className="mt-3 text-center text-[13px] text-white/60">Owner at home</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-6 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-12 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-primary-700">Everything included</p>
                <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight text-forest sm:text-5xl">No add-ons to buy later.</h2>
              </div>
              <p className="max-w-md text-slate-600">Inventory, CRM, QR ordering, online ordering, kitchen screen, reservations, salary and reports are all part of the same app.</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className={`${f.wide ? "lg:col-span-2" : ""} ${f.dark ? "bg-forest text-white" : "bg-white"} p-6`}>
                    <Icon className={`h-5 w-5 ${f.dark ? "text-lime-brand" : "text-primary-600"}`} />
                    <p className={`mt-4 font-semibold ${f.wide ? "text-lg" : ""}`}>{f.title}</p>
                    <p className={`mt-1.5 text-sm leading-relaxed ${f.dark ? "text-white/75" : "text-slate-600"}`}>{f.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Made for India */}
        <section className="bg-lime-brand py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:px-6 lg:flex-row lg:items-center">
            <p className="font-display shrink-0 text-2xl font-semibold text-forest lg:w-56">Made for India.</p>
            <ul className="flex flex-wrap gap-2">
              {INDIA.map((x) => (
                <li key={x} className="rounded-full bg-forest/10 px-3 py-1.5 text-sm font-medium text-forest">
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-6 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-14 max-w-2xl">
              <p className="text-sm font-medium text-primary-700">How it works</p>
              <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight text-forest sm:text-5xl">Taking orders the same day.</h2>
            </div>
            <ol className="grid gap-10 border-t border-slate-200 pt-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="font-display text-5xl font-medium text-primary-200">{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-4 text-lg font-semibold text-forest">{s.title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-6 bg-[#f5f6f2] py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="text-sm font-medium text-primary-700">Questions</p>
              <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight text-forest sm:text-5xl">What owners ask us first.</h2>
              <p className="mt-4 text-slate-600">
                Something else? <a href="#demo" className="font-medium text-primary-700 underline underline-offset-4">Ask us</a> — we reply on WhatsApp.
              </p>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium text-forest">
                    {f.q}
                    <span className="text-xl text-slate-400 transition group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Demo */}
        <section id="demo" className="scroll-mt-6 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-10 overflow-hidden rounded-2xl bg-forest p-6 text-white sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:p-14">
              <div>
                <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                  See it with <em className="font-medium text-lime-brand">your</em> menu.
                </h2>
                <p className="mt-5 max-w-md text-lg text-white/75">Leave your number. We&apos;ll call, set up your tables and menu, train your cashier and captains, and get you billing — usually the same day.</p>
                <ul className="mt-8 space-y-3">
                  {["We set up your restaurant for you", "Training for the cashier and captains", "Help on WhatsApp when you need it"].map((x) => (
                    <li key={x} className="flex items-center gap-2.5 text-[15px] text-white/85">
                      <Check className="h-4 w-4 shrink-0 text-lime-brand" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-white p-6 text-slate-900 sm:p-8">
                <EnquiryForm />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-forest-deep text-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <span className="leading-tight">
              <span className="block font-semibold text-white">{BRAND.name}</span>
              <span className="block text-sm">{BRAND.slogan}</span>
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="#screens" className="hover:text-white">Screens</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#demo" className="hover:text-white">Book a demo</a>
            <Link href="/login" className="hover:text-white">Staff sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
