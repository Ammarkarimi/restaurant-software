import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { prisma, rawPrisma, runForRestaurant } from "@/lib/db";
import { getSettings, publicLogoUrl } from "@/lib/settings";
import { parseBillTemplate } from "@/lib/bill-template";
import { orderInclude } from "@/lib/orders";
import { billDataFor } from "@/lib/bill-data";
import { verifyBillShareToken } from "@/lib/share";
import { BillView, pageCss, upiLink } from "@/components/bill-view";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your bill", robots: { index: false, follow: false } };

/** A bill the restaurant sent to a guest (on WhatsApp). Opens without signing in. */
export default async function SharedBillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const orderId = verifyBillShareToken(decodeURIComponent(token));
  if (!orderId) notFound();
  const owner = await rawPrisma.order.findUnique({ where: { id: orderId }, select: { restaurantId: true, restaurant: { select: { slug: true, status: true } } } });
  if (!owner || owner.restaurant.status !== "active") notFound();

  const { settings, order } = await runForRestaurant(owner.restaurantId, async () => ({
    settings: await getSettings(),
    order: await prisma.order.findFirst({ where: { id: orderId }, include: orderInclude }),
  }));
  if (!order || !order.billNumber || order.status === "cancelled") notFound();

  const template = parseBillTemplate(settings.billTemplate);
  const bill = billDataFor(order, settings.currency);
  const due = Math.round((bill.totals.total - bill.payments.reduce((s, p) => s + p.amount, 0)) * 100) / 100;
  const qr =
    template.showUpiQr && settings.upiId && due > 0
      ? await QRCode.toDataURL(upiLink(settings.upiId, settings.restaurantName, due, settings.currency, `Bill ${order.billNumber}`), { margin: 1, width: 300 })
      : null;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{pageCss(template.paperSize)}</style>
      <PrintButton closable={false} title={`${settings.restaurantName} · Bill ${order.billNumber}`} />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-fit max-w-full bg-white p-4 shadow print:p-0 print:shadow-none">
          <BillView template={template} profile={settings} bill={bill} logoUrl={publicLogoUrl(owner.restaurant.slug, settings)} qrDataUrl={qr} upiId={settings.upiId} timezone={settings.timezone} />
        </div>
        {order.pointsEarned > 0 && (
          <p className="no-print mx-auto mt-4 max-w-sm rounded-xl bg-emerald-50 px-4 py-2 text-center text-sm font-semibold text-emerald-800">
            You earned {order.pointsEarned} loyalty points on this bill.
          </p>
        )}
      </div>
    </div>
  );
}
