"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BellRing,
  PartyPopper,
  BarChart3,
  CalendarClock,
  ChefHat,
  Clock,
  BookOpen,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShoppingBag,
  Armchair,
  Gift,
  HandCoins,
  UserCircle,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { cn, formatTime, label } from "@/lib/utils";
import { AppProvider, useApp, type ShellSettings } from "@/components/app-provider";
import { Button } from "@/components/ui";
import { OfflineKeeper } from "@/components/offline-keeper";
import type { SessionUser } from "@/lib/session";
import { can, type Right } from "@/lib/permissions";

type NavItem = { href: string; label: string; icon: typeof LayoutGrid; admin?: boolean; right?: Right };

// Grouped like the back office of other POS systems: the work of the shift first, settings last.
const NAV: Array<{ group: string | null; items: NavItem[] }> = [
  {
    group: null,
    items: [
      { href: "/", label: "Tables", icon: LayoutGrid },
      { href: "/bills", label: "Bills", icon: ReceiptText },
      { href: "/kitchen", label: "Kitchen screen", icon: ChefHat },
    ],
  },
  {
    group: "Guests",
    items: [
      { href: "/reservations", label: "Reservations", icon: CalendarClock },
      { href: "/banquets", label: "Banquets", icon: PartyPopper, right: "banquets" },
      { href: "/customers", label: "Customers", icon: Users, admin: true },
      { href: "/gift-cards", label: "Gift cards", icon: Gift },
    ],
  },
  {
    group: "Menu & stock",
    items: [
      { href: "/menu", label: "Menu", icon: BookOpen },
      { href: "/stock", label: "Stock & recipes", icon: Warehouse, admin: true },
      { href: "/tables", label: "Table setup", icon: Armchair, admin: true },
    ],
  },
  {
    group: "Money",
    items: [
      { href: "/cash", label: "Cash & expenses", icon: Wallet },
      { href: "/salary", label: "Staff salary", icon: HandCoins, admin: true },
      { href: "/reports", label: "Reports", icon: BarChart3, admin: true },
    ],
  },
  {
    group: "Admin",
    items: [
      { href: "/alerts", label: "Alerts", icon: BellRing, admin: true },
      { href: "/settings", label: "Settings", icon: Settings, admin: true },
    ],
  },
];

const FOOTER_NAV = [
  { href: "/help", label: "Help & guide", icon: HelpCircle },
  { href: "/account", label: "My account", icon: UserCircle },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/orders");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Start / end my shift, for staff attendance. */
function ShiftButton() {
  const { toast, settings } = useApp();
  const [open, setOpen] = useState<{ inAt: string } | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/attendance")
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => setOpen(r ? r.open : null), () => setOpen(null));
  }, []);
  if (open === undefined) return null;
  async function toggle() {
    const res = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: open ? "out" : "in" }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast(body.error ?? "Could not save", "error");
    toast(open ? "Shift ended. Thank you!" : "Shift started");
    setOpen(body.open);
  }
  return (
    <button
      onClick={toggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition",
        open ? "text-emerald-300 hover:bg-white/5" : "text-slate-300 hover:bg-white/5 hover:text-white"
      )}
    >
      <Clock className="h-4 w-4" />
      {open ? `On shift since ${formatTime(open.inAt, settings.timezone)} · End` : "Start my shift"}
    </button>
  );
}

/** Number of alerts the owner has not seen, refreshed every minute. */
function useUnreadAlerts(enabled: boolean) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const load = () =>
      fetch("/api/alerts?count=1")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !stop && d && setUnread(d.unread))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener("alerts:read", load);
    return () => {
      stop = true;
      clearInterval(t);
      window.removeEventListener("alerts:read", load);
    };
  }, [enabled]);
  return unread;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, settings } = useApp();
  const unread = useUnreadAlerts(isAdmin);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = (settings.restaurantName || "R")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const link = (item: { href: string; label: string; icon: typeof LayoutGrid }) => {
    const Icon = item.icon;
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] font-medium transition-colors",
          active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
        )}
      >
        {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-lime-brand" aria-hidden />}
        <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
        <span className="truncate">{item.label}</span>
        {item.href === "/alerts" && unread > 0 && (
          <span className="ml-auto rounded bg-red-500 px-1.5 text-[11px] font-semibold text-white" aria-label={`${unread} new alerts`}>{unread > 99 ? "99+" : unread}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[#0b1d16] text-slate-300">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        {settings.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md bg-white object-contain" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-lime-brand text-[13px] font-semibold text-forest" aria-hidden>{initials}</span>
        )}
        <p className="min-w-0 truncate text-sm font-semibold text-white">{settings.restaurantName}</p>
      </div>
      {settings.outlets && settings.outlets.length > 1 && (
        <div className="px-3 pb-2">
          <label htmlFor="outlet" className="sr-only">
            Outlet
          </label>
          <select
            id="outlet"
            value={user.restaurantId}
            onChange={async (e) => {
              const res = await fetch("/api/auth/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: e.target.value }) });
              if (res.ok) window.location.href = "/";
            }}
            className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[13px] font-medium text-slate-200 outline-none focus:border-primary-400"
          >
            {settings.outlets.map((o) => (
              <option key={o.id} value={o.id} className="text-slate-900">{o.name}</option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3" aria-label="Main">
        {NAV.map((g) => {
          const items = g.items.filter((n) => (!n.admin || isAdmin) && (!n.right || can(user, n.right)));
          if (!items.length) return null;
          return (
            <div key={g.group ?? "main"} className="mt-3 space-y-0.5 first:mt-1">
              {g.group && <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.group}</p>}
              {items.map(link)}
            </div>
          );
        })}
        <div className="mt-3 space-y-0.5 border-t border-white/10 pt-3">{FOOTER_NAV.map(link)}</div>
      </nav>

      <div className="border-t border-white/10 p-2.5">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white" aria-hidden>
            {user.name
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
            <p className="truncate text-[11px] text-slate-400">{label(user.role)}</p>
          </div>
          <button onClick={handleLogout} className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <ShiftButton />
      </div>
    </div>
  );
}

/** The current screen's name for the top bar. */
function pageTitle(pathname: string) {
  if (pathname.startsWith("/orders")) return "Order";
  for (const g of NAV) for (const i of g.items) if (isActive(pathname, i.href)) return i.label;
  return FOOTER_NAV.find((i) => isActive(pathname, i.href))?.label ?? "";
}

function Shell({ children }: { children: React.ReactNode }) {
  const { settings } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMenuOpen(false), [pathname]);
  // The order screen uses the whole width for the menu and the cart.
  const wide = pathname.startsWith("/orders/");
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: settings.timezone }).format(new Date());

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <Sidebar />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-2 top-3.5 z-10 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              <span className="lg:hidden">{settings.restaurantName}</span>
              <span className="hidden lg:inline">{pageTitle(pathname)}</span>
            </p>
          </div>
          <span className="hidden text-[13px] text-slate-500 md:inline">· {today}</span>
          <div className="ml-auto flex shrink-0 gap-2">
            <Link href="/orders/new?type=takeaway">
              <Button variant="outline" size="sm" className="whitespace-nowrap">
                <ShoppingBag />
                <span className="hidden sm:inline">New takeaway</span>
              </Button>
            </Link>
            <Link href="/">
              <Button size="sm" className="whitespace-nowrap">
                <LayoutGrid />
                <span className="hidden sm:inline">Tables</span>
              </Button>
            </Link>
          </div>
        </header>
        {settings.subscriptionNotice && (
          <div role="status" className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-medium text-amber-900 sm:px-6">
            {settings.subscriptionNotice}
          </div>
        )}
        <OfflineKeeper />
        <main className={cn("mx-auto px-4 py-6 sm:px-6", wide ? "max-w-[1600px] lg:px-6" : "max-w-7xl lg:px-8")}>{children}</main>
      </div>
    </div>
  );
}

export function AppLayout({ user, settings, children }: { user: SessionUser; settings: ShellSettings; children: React.ReactNode }) {
  return (
    <AppProvider user={user} settings={settings}>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
