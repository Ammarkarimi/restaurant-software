import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getPlatformSession } from "@/lib/platform";
import { SignOutButton } from "@/components/platform-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Owner panel" }, robots: { index: false, follow: false } };

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect("/platform/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/platform" className="flex min-w-0 items-center gap-2">
            <ShieldCheck className="h-6 w-6 shrink-0" />
            <span className="truncate text-base font-bold">Owner panel</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm font-semibold">
            <Link href="/platform" className="rounded-lg px-3 py-2 hover:bg-slate-800">Restaurants</Link>
            <Link href="/platform/restaurants/new" className="hidden rounded-lg px-3 py-2 hover:bg-slate-800 sm:block">Add restaurant</Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
