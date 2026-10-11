"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ImagePlus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, Select, Textarea, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { BillView, upiLink } from "@/components/bill-view";
import { BILL_PRESETS, DEFAULT_BILL_TEMPLATE, type BillTemplate } from "@/lib/bill-template";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { SettingsDTO } from "@/lib/types";
import { sampleBill } from "@/lib/sample-bill";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function Checks({ t, set, items }: { t: BillTemplate; set: (p: Partial<BillTemplate>) => void; items: Array<[keyof BillTemplate, string]> }) {
  return (
    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
      {items.map(([key, text]) => (
        <label key={key} className="flex cursor-pointer items-center gap-2.5 text-[15px] text-slate-700">
          <input type="checkbox" checked={Boolean(t[key])} onChange={(e) => set({ [key]: e.target.checked } as Partial<BillTemplate>)} className="h-4 w-4 accent-primary-600" />
          {text}
        </label>
      ))}
    </div>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", value === v ? "bg-primary-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function BillDesigner({ settings, onChange }: { settings: SettingsDTO; onChange: (s: SettingsDTO) => void }) {
  const { toast } = useApp();
  const [t, setT] = useState<BillTemplate>(settings.billTemplate);
  const [upiId, setUpiId] = useState(settings.upiId ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewPaid, setPreviewPaid] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<BillTemplate>) => setT((x) => ({ ...x, ...p }));
  const changed = JSON.stringify(t) !== JSON.stringify(settings.billTemplate) || upiId !== (settings.upiId ?? "");

  const bill = useMemo(() => sampleBill(settings, previewPaid), [settings, previewPaid]);

  useEffect(() => {
    if (!t.showUpiQr || !upiId.includes("@")) return setQr(null);
    QRCode.toDataURL(upiLink(upiId, settings.restaurantName, bill.totals.total, settings.currency, "Bill 1024"), { margin: 1, width: 240 }).then(setQr, () => setQr(null));
  }, [t.showUpiQr, upiId, settings.restaurantName, settings.currency, bill.totals.total]);

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ settings: SettingsDTO }>("/api/settings", { method: "PATCH", body: { billTemplate: t, upiId: upiId.trim() || null } });
      onChange(r.settings);
      toast("Bill design saved. New bills use it straight away.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) return toast("The logo must be smaller than 2 MB", "error");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("logo", file);
      const r = await api<{ settings: SettingsDTO }>("/api/settings/logo", { body: form });
      onChange(r.settings);
      set({ showLogo: true });
      toast("Logo uploaded");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeLogo() {
    try {
      const r = await api<{ settings: SettingsDTO }>("/api/settings/logo", { method: "DELETE" });
      onChange(r.settings);
      toast("Logo removed");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Start from a style" description="Pick one, then change anything you like below. Nothing is saved until you press Save." />
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {BILL_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setT({ ...DEFAULT_BILL_TEMPLATE, ...p.template, headerText: t.headerText, footerText: p.template.footerText ?? t.footerText })}
                className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-primary-300 hover:bg-primary-50/50"
              >
                <p className="font-semibold text-slate-900">{p.name}</p>
                <p className="text-sm text-slate-500">{p.description}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Design" />
          <CardContent className="space-y-5">
            <Section title="Logo">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-32 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                  {settings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.logoUrl} alt="Your logo" className="max-h-16 max-w-28 object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">No logo</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  <Button variant="outline" loading={uploading} onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" /> {settings.logoUrl ? "Change logo" : "Upload logo"}
                  </Button>
                  {settings.logoUrl && (
                    <Button variant="ghost" className="text-red-600" onClick={removeLogo}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500">PNG, JPG or WebP, up to 2 MB. A black logo on a white or clear background prints best on thermal printers.</p>
              <div className="flex flex-wrap items-center gap-4">
                <Toggle checked={t.showLogo} onChange={(v) => set({ showLogo: v })} label="Print logo" />
                {t.showLogo && <Choice value={t.logoSize} onChange={(v) => set({ logoSize: v })} options={[["small", "Small"], ["medium", "Medium"], ["large", "Large"]]} />}
              </div>
            </Section>

            <Section title="Paper & text">
              <Field label="Paper">
                <Choice value={t.paperSize} onChange={(v) => set({ paperSize: v })} options={[["80mm", "80 mm thermal (3 inch)"], ["58mm", "58 mm thermal (2 inch)"], ["a4", "A4 page"]]} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Font">
                  <Choice value={t.fontStyle} onChange={(v) => set({ fontStyle: v })} options={[["mono", "Receipt"], ["sans", "Modern"], ["serif", "Classic"]]} />
                </Field>
                <Field label="Text size">
                  <Choice value={t.fontSize} onChange={(v) => set({ fontSize: v })} options={[["small", "S"], ["normal", "M"], ["large", "L"]]} />
                </Field>
                <Field label="Heading">
                  <Choice value={t.headerAlign} onChange={(v) => set({ headerAlign: v })} options={[["center", "Centre"], ["left", "Left"]]} />
                </Field>
              </div>
              {t.paperSize === "a4" && (
                <Field label="Colour (A4 only)">
                  <div className="flex items-center gap-2">
                    <input type="color" value={t.accentColor} onChange={(e) => set({ accentColor: e.target.value })} className="h-10 w-14 cursor-pointer rounded border border-slate-200" aria-label="Bill colour" />
                    <span className="font-mono text-sm text-slate-500">{t.accentColor}</span>
                  </div>
                </Field>
              )}
            </Section>

            <Section title="Top of the bill">
              <Checks
                t={t}
                set={set}
                items={[
                  ["showRestaurantName", "Restaurant name"],
                  ["showLegalName", "Registered business name"],
                  ["showAddress", "Address"],
                  ["showPhone", "Phone"],
                  ["showEmail", "Email"],
                  ["showGstin", "GSTIN"],
                  ["showFssai", "FSSAI licence no."],
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bill title" hint="e.g. TAX INVOICE, BILL, CASH MEMO">
                  <Input value={t.billTitle} onChange={(e) => set({ billTitle: e.target.value })} maxLength={40} />
                </Field>
                <Field label="Message under the name" optional hint="e.g. Pure veg · Since 1998">
                  <Input value={t.headerText} onChange={(e) => set({ headerText: e.target.value })} maxLength={300} />
                </Field>
              </div>
            </Section>

            <Section title="Order details">
              <Checks
                t={t}
                set={set}
                items={[
                  ["showBillNumber", "Bill number"],
                  ["showDateTime", "Date & time"],
                  ["showTable", "Table / order type"],
                  ["showGuests", "Number of guests"],
                  ["showServedBy", "Served by (staff name)"],
                  ["showCustomer", "Customer name & phone"],
                ]}
              />
            </Section>

            <Section title="Items & totals">
              <Checks
                t={t}
                set={set}
                items={[
                  ["showRateColumn", "Rate column"],
                  ["showFoodTypeMark", "Veg / non-veg mark"],
                  ["showItemNotes", "Item notes"],
                  ["showItemCount", "Item count"],
                  ["showTaxBreakup", "Tax summary table"],
                  ["showAmountInWords", "Amount in words"],
                  ["showPayments", "How it was paid"],
                ]}
              />
            </Section>

            <Section title="UPI QR code to pay">
              <Toggle checked={t.showUpiQr} onChange={(v) => set({ showUpiQr: v })} label="Print a UPI QR code on unpaid bills" description="Guests scan it with any UPI app and the amount is filled in." />
              {t.showUpiQr && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your UPI ID" hint="e.g. spicegarden@okhdfc">
                    <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" />
                  </Field>
                  <Field label="Text under the QR">
                    <Input value={t.upiQrText} onChange={(e) => set({ upiQrText: e.target.value })} maxLength={80} />
                  </Field>
                </div>
              )}
              {t.showUpiQr && !upiId.includes("@") && <Tip tone="warning">Add your UPI ID to show the QR code.</Tip>}
            </Section>

            <Section title="Bottom of the bill">
              <Field label="Thank-you message" optional hint="Several lines are fine: offers, Instagram handle, Wi-Fi password…">
                <Textarea rows={3} value={t.footerText} onChange={(e) => set({ footerText: e.target.value })} maxLength={300} />
              </Field>
              <Checks t={t} set={set} items={[["showPoweredBy", "“Powered by Restaurant Manager” line"]]} />
            </Section>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <Button size="lg" loading={saving} disabled={!changed} onClick={save}>
            Save bill design
          </Button>
          <Button variant="ghost" disabled={!changed} onClick={() => (setT(settings.billTemplate), setUpiId(settings.upiId ?? ""))}>
            <RotateCcw className="h-4 w-4" /> Undo changes
          </Button>
          {changed && <span className="text-sm font-medium text-amber-700">Not saved yet</span>}
        </div>
      </div>

      <div className="xl:sticky xl:top-20 xl:h-fit">
        <Card>
          <CardHeader
            title="Live preview"
            description="A sample bill with your details and tax settings."
            action={
              <a href="/print/sample?auto=1" target="_blank" rel="noopener noreferrer" title="Prints a sample bill with your saved design, to test your printer">
                <Button size="sm" variant="outline">
                  <Printer className="h-4 w-4" /> Test print
                </Button>
              </a>
            }
          />
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Choice value={previewPaid ? "paid" : "unpaid"} onChange={(v) => setPreviewPaid(v === "paid")} options={[["unpaid", "Before payment"], ["paid", "After payment"]]} />
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-xl bg-slate-100 p-4">
              <div className="bill-preview mx-auto w-fit bg-white p-2 shadow-md" style={t.paperSize === "a4" ? { zoom: 0.5 } : undefined}>
                <BillView template={t} profile={settings} bill={bill} logoUrl={settings.logoUrl} qrDataUrl={qr} upiId={upiId || null} timezone={settings.timezone} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
