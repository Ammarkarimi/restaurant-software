import { redirect } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { runForRestaurant } from "@/lib/db";
import { getSettings, logoUrl } from "@/lib/settings";
import { parseBillTemplate } from "@/lib/bill-template";
import { sampleBill } from "@/lib/sample-bill";
import { BillView, pageCss, upiLink } from "@/components/bill-view";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Test print" };

/** A sample bill in the saved design, to check the printer and paper size. */
export default async function SampleBillPage({ searchParams }: { searchParams: Promise<{ auto?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { auto } = await searchParams;
  const settings = await runForRestaurant(session.restaurantId, () => getSettings());
  const template = parseBillTemplate(settings.billTemplate);
  const bill = sampleBill(settings, false);
  const qr =
    template.showUpiQr && settings.upiId
      ? await QRCode.toDataURL(upiLink(settings.upiId, settings.restaurantName, bill.totals.total, settings.currency, "Test bill"), { margin: 1, width: 300 })
      : null;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{pageCss(template.paperSize)}</style>
      <PrintButton auto={auto === "1"} title="Sample bill (test print)" />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-fit bg-white p-4 shadow print:p-0 print:shadow-none">
          <BillView template={template} profile={settings} bill={bill} logoUrl={logoUrl(settings)} qrDataUrl={qr} upiId={settings.upiId} timezone={settings.timezone} />
        </div>
      </div>
    </div>
  );
}
