import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { prisma, runForRestaurant } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateKey } from "@/lib/dates";
import { formatCurrency } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gift card" };

type Props = { params: Promise<{ id: string }> };

/** A gift card to print and hand over (fits A6 or a quarter of an A4 sheet). */
export default async function GiftCardPrintPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");
  if (session.role === "kitchen") notFound();
  const { id } = await params;
  const data = await runForRestaurant(session.restaurantId, async () => {
    const card = await prisma.giftCard.findFirst({ where: { id } });
    return card ? { card, settings: await getSettings() } : null;
  });
  if (!data) notFound();
  const { card, settings } = data;
  // The QR holds just the number, so a barcode / QR scanner at the counter types it in.
  const qr = await QRCode.toDataURL(card.code, { margin: 1, width: 160 });
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{"@page { size: A6 landscape; margin: 6mm; }"}</style>
      <PrintButton title={`Gift card ${card.code}`} />
      <div className="py-6 print:py-0">
        <div className="print-sheet mx-auto flex max-w-[148mm] flex-col gap-3 rounded-2xl border-2 border-black bg-white p-6 text-black shadow print:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest">Gift card</p>
              <p className="text-xl font-bold">{settings.restaurantName}</p>
              {settings.city && <p className="text-sm">{settings.city}</p>}
            </div>
            <p className="text-3xl font-bold">{formatCurrency(card.amount, settings.currency)}</p>
          </div>
          {(card.recipientName || card.message) && (
            <p className="text-[15px]">
              {card.recipientName && <b>For {card.recipientName}. </b>}
              {card.message}
            </p>
          )}
          <div className="flex items-end justify-between gap-4">
            <div className="text-sm">
              <p>Card number</p>
              <p className="font-mono text-2xl font-bold tracking-wider">{card.code}</p>
              <p className="mt-1">{card.expiresOn ? `Use before ${formatDateKey(card.expiresOn)}. ` : ""}Show this card when you pay.</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`QR code for ${card.code}`} className="h-24 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
