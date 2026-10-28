import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, ChefHat, Clock, PackageCheck, Phone, Truck, XCircle } from "lucide-react";
import { prisma, rawPrisma, runForRestaurant } from "@/lib/db";
import { getSettings, publicLogoUrl } from "@/lib/settings";
import { orderInclude, totalsOf } from "@/lib/orders";
import { paidAmount, round2 } from "@/lib/billing";
import { verifyOrderTrackToken } from "@/lib/share";
import { addonText } from "@/lib/menu";
import { upiLink } from "@/components/bill-view";
import { formatCurrency } from "@/lib/utils";
import { Refresher } from "./refresher";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

const STEPS = ["Order received", "Accepted", "Being prepared", "Ready"];

/** Where a guest follows their online / kiosk order. Opens without signing in, from the link they got. */
export default async function TrackOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const orderId = verifyOrderTrackToken(decodeURIComponent(token));
  if (!orderId) notFound();
  const owner = await rawPrisma.order.findUnique({ where: { id: orderId }, select: { restaurantId: true, restaurant: { select: { slug: true, status: true } } } });
  if (!owner || owner.restaurant.status !== "active") notFound();
  const { settings, order } = await runForRestaurant(owner.restaurantId, async () => ({
    settings: await getSettings(),
    order: await prisma.order.findFirst({ where: { id: orderId }, include: orderInclude }),
  }));
  if (!order) notFound();

  const items = order.items.filter((i) => i.status === "active");
  const sent = items.filter((i) => i.kotNumber !== null);
  const totals = totalsOf(order);
  const due = round2(totals.total - paidAmount(order.payments));
  const delivery = order.type === "delivery";
  let step = 0;
  let headline = "Waiting for the restaurant to accept your order";
  let Icon = Clock;
  let done = false;
  if (order.status === "cancelled") {
    headline = "This order was cancelled";
    Icon = XCircle;
    done = true;
  } else if (delivery && order.deliveryStatus === "delivered") {
    headline = "Delivered. Enjoy your meal!";
    Icon = CheckCircle2;
    step = 4;
    done = true;
  } else if (delivery && order.deliveryStatus === "out") {
    headline = `On the way${order.riderName ? ` with ${order.riderName}` : ""}`;
    Icon = Truck;
    step = 4;
  } else if (sent.length && sent.length === items.length && items.every((i) => i.kitchenStatus === "served")) {
    headline = delivery ? "Your order has left the restaurant" : "Picked up. Enjoy your meal!";
    Icon = CheckCircle2;
    step = 4;
    done = !delivery;
  } else if (sent.length && sent.length === items.length && items.every((i) => i.kitchenStatus !== "new")) {
    headline = delivery ? "Ready — leaving with the rider soon" : `Ready! Please collect order ${order.number}`;
    Icon = PackageCheck;
    step = 4;
  } else if (sent.length) {
    headline = "Accepted — your food is being prepared";
    Icon = ChefHat;
    step = 3;
  }
  const when = order.scheduledFor
    ? new Intl.DateTimeFormat("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: settings.timezone }).format(order.scheduledFor)
    : null;
  const pay = settings.upiId && due > 0 && order.status !== "cancelled" ? upiLink(settings.upiId, settings.restaurantName, due, settings.currency, `Order ${order.number}`) : null;
  const logo = publicLogoUrl(owner.restaurant.slug, settings);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <Refresher active={!done} />
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="mx-auto mb-2 h-14 max-w-[50%] object-contain" />
          )}
          <h1 className="text-xl font-bold text-slate-900">{settings.restaurantName}</h1>
        </div>
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
          <Icon className={`mx-auto h-12 w-12 ${order.status === "cancelled" ? "text-red-500" : step === 4 ? "text-emerald-600" : "text-primary-600"}`} />
          <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Order {order.number}</p>
          <p className="text-xl font-bold text-slate-900">{headline}</p>
          {order.status === "cancelled" && order.cancelReason && <p className="mt-1 text-slate-600">{order.cancelReason}</p>}
          {when && order.status !== "cancelled" && <p className="mt-1 text-slate-600">{delivery ? "Delivery" : "Pickup"} asked for {when}</p>}
          {order.status !== "cancelled" && (
            <div className="mt-4 grid grid-cols-4 gap-1">
              {STEPS.map((s, i) => (
                <div key={s}>
                  <div className={`h-1.5 rounded-full ${i < Math.max(1, step) ? "bg-emerald-500" : "bg-slate-200"}`} />
                  <p className="mt-1 text-[11px] text-slate-500">{s}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <ul className="space-y-1 text-[15px]">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.quantity} × {i.name}
                  {i.variant && ` (${i.variant})`}
                  {addonText(i.addons) && <span className="block text-sm text-slate-500">+ {addonText(i.addons)}</span>}
                </span>
                <span>{formatCurrency(i.price * i.quantity, settings.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-slate-100 pt-2 text-sm text-slate-600">
            {totals.chargesTotal > 0 && (
              <p className="flex justify-between">
                <span>Packing / delivery</span>
                <span>{formatCurrency(totals.chargesTotal, settings.currency)}</span>
              </p>
            )}
            {totals.tax > 0 && !order.pricesIncludeTax && (
              <p className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(totals.tax, settings.currency)}</span>
              </p>
            )}
            <p className="mt-1 flex justify-between text-lg font-bold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(totals.total, settings.currency)}</span>
            </p>
            <p className="text-sm">{due <= 0 ? "Paid — thank you!" : delivery ? "Pay on delivery (cash or UPI)" : "Pay when you collect (cash or UPI)"}</p>
          </div>
          {pay && (
            <a href={pay} className="mt-3 block rounded-xl bg-emerald-600 px-4 py-3 text-center font-bold text-white hover:bg-emerald-700">
              Pay {formatCurrency(due, settings.currency)} now by UPI
            </a>
          )}
        </div>
        {settings.phone && (
          <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
            <Phone className="h-4 w-4" /> Call {settings.restaurantName}: {settings.phone}
          </a>
        )}
        {!done && <p className="text-center text-xs text-slate-400">This page updates by itself.</p>}
      </div>
    </div>
  );
}
