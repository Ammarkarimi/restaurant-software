import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { prisma, rawPrisma, runForRestaurant } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "QR codes" };

/** A sheet of QR codes to print and stick on tables: one per table, plus one for the menu only. */
export default async function PrintQrPage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") notFound();
  const { table: only } = await searchParams;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const restaurant = await rawPrisma.restaurant.findUniqueOrThrow({ where: { id: session.restaurantId }, select: { slug: true } });
  const base = `${proto}://${host}/m/${restaurant.slug}`;

  const { settings, tables } = await runForRestaurant(session.restaurantId, async () => ({
    settings: await getSettings(),
    tables: await prisma.diningTable.findMany({ where: { active: true, ...(only && { id: only }) }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  }));
  const qr = (url: string) => QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" });
  const cards = [
    ...(only ? [] : [{ key: "menu", title: "Our menu", subtitle: "Scan to see the menu", url: base, image: await qr(base) }]),
    ...(await Promise.all(
      tables.map(async (t) => {
        const url = `${base}?t=${t.qrToken}`;
        return {
          key: t.id,
          title: `Table ${t.name}`,
          subtitle: settings.qrOrderingEnabled ? "Scan to see the menu, order or call a waiter" : "Scan to see the menu or call a waiter",
          url,
          image: await qr(url),
        };
      })
    )),
  ];

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{"@page { size: A4; margin: 10mm; }"}</style>
      <PrintButton title={`QR codes · ${settings.restaurantName}`} />
      {!settings.qrMenuEnabled && (
        <p className="no-print mx-auto mt-4 max-w-xl rounded-xl bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900">
          The QR menu is switched off in Settings → QR menu. Guests who scan will see “not available”.
        </p>
      )}
      <div className="mx-auto grid max-w-[190mm] grid-cols-2 gap-4 p-6 print:gap-3 print:p-0 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.key} className="flex break-inside-avoid flex-col items-center rounded-2xl border-2 border-slate-300 bg-white p-4 text-center">
            <p className="text-sm font-semibold text-slate-500">{settings.restaurantName}</p>
            <p className="text-2xl font-extrabold text-slate-900">{c.title}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image} alt={`QR code for ${c.title}`} className="my-2 w-40" />
            <p className="text-sm font-medium text-slate-700">{c.subtitle}</p>
          </div>
        ))}
      </div>
      <p className="no-print pb-8 text-center text-sm text-slate-500">
        Menu link: <a className="font-semibold text-primary-700 underline" href={base} target="_blank" rel="noopener noreferrer">{base}</a>
      </p>
    </div>
  );
}
