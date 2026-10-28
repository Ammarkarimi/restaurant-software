import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { prisma, runForRestaurant } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseBillTemplate } from "@/lib/bill-template";
import { orderInclude } from "@/lib/orders";
import { label } from "@/lib/utils";
import { addonText, parseList } from "@/lib/menu";
import { pageCss } from "@/components/bill-view";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kitchen ticket" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ kot?: string; auto?: string; station?: string }> };

/**
 * Kitchen order ticket: what to cook, for which table. No prices.
 * With kitchen stations (Tandoor, Bar…) each station gets its own ticket, on its own slip.
 */
export default async function PrintKotPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");
  const { id } = await params;
  const { kot, auto, station } = await searchParams;

  const data = await runForRestaurant(session.restaurantId, async () => {
    const [settings, order] = await Promise.all([getSettings(), prisma.order.findFirst({ where: { id }, include: orderInclude })]);
    return { settings, order };
  });
  if (!data.order) notFound();
  const { settings, order } = data;
  const paper = parseBillTemplate(settings.billTemplate).paperSize === "58mm" ? "58mm" : "80mm";

  const only = kot ? Number(kot) : null;
  const stations = parseList(settings.kitchenStations);
  // A station that was removed from settings goes to the main kitchen.
  const stationOf = (s: string | null) => (s && stations.includes(s) ? s : null);
  const tickets = new Map<string, { number: number; station: string | null; items: typeof order.items }>();
  for (const i of order.items) {
    if (i.kotNumber === null || (only !== null && i.kotNumber !== only)) continue;
    const st = stationOf(i.station);
    if (station !== undefined && (st ?? "") !== station) continue;
    const key = `${i.kotNumber}|${st ?? ""}`;
    const t = tickets.get(key) ?? { number: i.kotNumber, station: st, items: [] };
    t.items.push(i);
    tickets.set(key, t);
  }
  const time = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: settings.timezone }).format(d) : "";
  const where = order.type === "dine_in" ? `TABLE ${order.table?.name ?? ""}` : label(order.type).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{pageCss(paper)}</style>
      <PrintButton auto={auto === "1"} title={`Kitchen ticket · ${where}`} />
      <div className="space-y-4 py-6 print:space-y-0 print:py-0">
        {tickets.size === 0 && <p className="text-center text-slate-500">Nothing has been sent to the kitchen for this order yet.</p>}
        {[...tickets.values()].map(({ number, station: st, items }, index) => {
          const active = items.filter((i) => i.status === "active");
          const cancelled = items.filter((i) => i.status === "cancelled");
          return (
            <div
              key={`${number}-${st}`}
              className="print-sheet mx-auto bg-white font-mono text-black shadow print:shadow-none"
              style={{ width: paper, padding: paper === "58mm" ? "2mm" : "3mm", fontSize: "13px", lineHeight: 1.35, breakAfter: index < tickets.size - 1 ? "page" : undefined }}
            >
              <p className="text-center text-xs">{settings.restaurantName}</p>
              {stations.length > 0 && <p className="text-center text-base font-extrabold uppercase">[ {st ?? "Kitchen"} ]</p>}
              <p className="text-center text-lg font-bold">KOT #{number}</p>
              <p className="text-center text-xl font-extrabold">{where}</p>
              {order.type !== "dine_in" && <p className="text-center text-2xl font-black">TOKEN {order.number}</p>}
              <div className="my-1 border-t border-dashed border-black" />
              <p>Order #{order.number} · {time(items[0]?.sentAt ?? null)}</p>
              {order.createdByName && <p>By: {order.createdByName}</p>}
              {order.source !== "counter" && (
                <p className="font-bold">
                  {label(order.source).toUpperCase()}
                  {order.sourceRef && ` #${order.sourceRef}`}
                </p>
              )}
              {order.type !== "dine_in" && order.customerName && <p>For: {order.customerName}</p>}
              {order.notes && <p className="font-bold">Note: {order.notes}</p>}
              <div className="my-1 border-t border-dashed border-black" />
              <table className="w-full">
                <tbody>
                  {active.map((i) => (
                    <tr key={i.id} className="align-top">
                      <td className="w-8 pr-1 text-base font-bold">{i.quantity}</td>
                      <td className="text-base font-semibold">
                        {i.name}
                        {i.variant && ` (${i.variant})`}
                        {addonText(i.addons) && <span className="block text-sm font-semibold">+ {addonText(i.addons)}</span>}
                        {i.note && <span className="block text-sm font-normal italic">** {i.note}</span>}
                      </td>
                    </tr>
                  ))}
                  {cancelled.map((i) => (
                    <tr key={i.id} className="align-top">
                      <td className="w-8 pr-1 font-bold line-through">{i.quantity}</td>
                      <td>
                        <span className="line-through">{i.name}{i.variant && ` (${i.variant})`}</span> <b>CANCELLED</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="my-1 border-t border-dashed border-black" />
              <p className="text-center text-xs">{active.reduce((s, i) => s + i.quantity, 0)} item(s)</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
