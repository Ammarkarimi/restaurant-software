import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { prisma, runForRestaurant } from "@/lib/db";
import { getSettings, logoUrl } from "@/lib/settings";
import { parseBillTemplate } from "@/lib/bill-template";
import { orderInclude } from "@/lib/orders";
import { billDataFor } from "@/lib/bill-data";
import { BillView, pageCss, upiLink } from "@/components/bill-view";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bill" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> };

export default async function PrintBillPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");
  if (session.role === "kitchen") redirect("/kitchen");
  const { id } = await params;
  const { auto } = await searchParams;

  const data = await runForRestaurant(session.restaurantId, async () => {
    const [settings, order] = await Promise.all([getSettings(), prisma.order.findFirst({ where: { id }, include: orderInclude })]);
    return { settings, order };
  });
  if (!data.order) notFound();
  const { settings, order } = data;
  const template = parseBillTemplate(settings.billTemplate);
  const bill = billDataFor(order, settings.currency);
  const due = Math.round((bill.totals.total - bill.payments.reduce((s, p) => s + p.amount, 0)) * 100) / 100;

  let qr: string | null = null;
  if (template.showUpiQr && settings.upiId && due > 0) {
    const note = order.billNumber ? `Bill ${order.billNumber}` : `Order ${order.number}`;
    qr = await QRCode.toDataURL(upiLink(settings.upiId, settings.restaurantName, due, settings.currency, note), { margin: 1, width: 300 });
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{pageCss(template.paperSize)}</style>
      <PrintButton auto={auto === "1"} title={order.billNumber ? `Bill ${order.billNumber}` : `Order #${order.number}`} />
      {order.status === "cancelled" && (
        <p className="no-print mx-auto mt-4 max-w-md rounded-xl bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-700">
          This order was cancelled: {order.cancelReason}
        </p>
      )}
      {order.status === "open" && (
        <p className="no-print mx-auto mt-4 max-w-md rounded-xl bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-800">
          Items changed after this bill was printed. Use “Print bill” on the order to update it.
        </p>
      )}
      <div className="py-6 print:py-0">
        <div className="mx-auto w-fit bg-white p-4 shadow print:p-0 print:shadow-none">
          <BillView template={template} profile={settings} bill={bill} logoUrl={logoUrl(settings)} qrDataUrl={qr} upiId={settings.upiId} timezone={settings.timezone} />
        </div>
      </div>
    </div>
  );
}
