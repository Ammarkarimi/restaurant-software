"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShoppingBag,
  Armchair,
  UserCircle,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import { cn, label } from "@/lib/utils";
import { AppProvider, useApp, type ShellSettings } from "@/components/app-provider";
import { Button } from "@/components/ui";
import type { SessionUser } from "@/lib/session";

const NAV = [
  { href: "/", label: "Tables", icon: LayoutGrid, hint: "Take orders & bill" },
  { href: "/bills", label: "Bills", icon: ReceiptText, hint: "All orders & reprints" },
  { href: "/menu", label: "Menu", icon: BookOpen, hint: "Dishes & prices" },
  { href: "/customers", label: "Customers", icon: Users, hint: "Regulars & loyalty", admin: true },
  { href: "/cash", label: "Cash & expenses", icon: Wallet, hint: "Expenses, day close" },
  { href: "/tables", label: "Table setup", icon: Armchair, hint: "Areas & tables", admin: true },
  { href: "/reports", label: "Reports", icon: BarChart3, hint: "Sales summary", admin: true },
  { href: "/settings", label: "Settings", icon: Settings, hint: "Bill design, tax, staff", admin: true },
];

const FOOTER_NAV = [
  { href: "/help", label: "Help & guide", icon: HelpCircle },
  { href: "/account", label: "My account", icon: UserCircle },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/orders");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, settings } = useApp();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        {settings.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
        ) : (
          <div className="rounded-xl bg-primary-600 p-2 text-white">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900">{settings.restaurantName}</p>
          <p className="text-xs text-slate-500">Restaurant manager</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.filter((n) => !n.admin || isAdmin).map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                active ? "bg-primary-50 text-primary-700" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600")} />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight">{item.label}</span>
                <span className="block text-xs text-slate-400">{item.hint}</span>
              </span>
            </Link>
          );
        })}

        <div className="my-3 border-t border-slate-100" />
        {FOOTER_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                active ? "bg-primary-50 text-primary-700" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <Icon className={cn("h-5 w-5", active ? "text-primary-600" : "text-slate-400")} />
              <span className="text-[15px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 px-1">
          <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{label(user.role)}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { settings } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMenuOpen(false), [pathname]);
  // The order screen uses the whole width for the menu and the cart.
  const wide = pathname.startsWith("/orders/");

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 lg:block">
        <Sidebar />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] shadow-2xl">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
            <span className="hidden sm:inline">Menu</span>
          </button>
          <p className="truncate text-base font-bold text-slate-900 lg:hidden">{settings.restaurantName}</p>
          <div className="ml-auto flex shrink-0 gap-2">
            <Link href="/orders/new?type=takeaway">
              <Button variant="outline" className="whitespace-nowrap">
                <ShoppingBag className="h-5 w-5" />
                <span className="hidden sm:inline">Takeaway</span>
              </Button>
            </Link>
            <Link href="/">
              <Button className="whitespace-nowrap">
                <LayoutGrid className="h-5 w-5" />
                <span className="hidden sm:inline">Tables</span>
              </Button>
            </Link>
          </div>
        </header>
        {settings.subscriptionNotice && (
          <div role="status" className="no-print border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 sm:px-6">
            {settings.subscriptionNotice}
          </div>
        )}
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
