"use client";

import { useEffect, useState } from "react";
import { BellRing, Send } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import type { AlertRules } from "@/lib/alert-rules";
import type { SettingsDTO } from "@/lib/types";
import { SaveBar, useSettingsForm } from "./form";

export function AlertsTab({ settings, onSaved }: { settings: SettingsDTO; onSaved: (s: SettingsDTO) => void }) {
  const { toast } = useApp();
  const { form: f, set, save, saving, changed } = useSettingsForm(settings, onSaved, ["alertPhone", "alertEmail", "dailyReportEnabled", "alertRules"]);
  const rules = f.alertRules as AlertRules;
  const rule = (p: Partial<AlertRules>) => set({ alertRules: { ...rules, ...p } });
  const [channels, setChannels] = useState<{ whatsapp: boolean; email: boolean } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api<{ channels: { whatsapp: boolean; email: boolean } }>("/api/alerts").then((r) => setChannels(r.channels), () => undefined);
  }, []);

  async function test() {
    setSending(true);
    try {
      const r = await api<{ sentVia: string }>("/api/reports/daily", { body: {} });
      toast(`Today's report sent by ${r.sentVia.replace(",", " and ")}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Where to send alerts and the daily report"
          description="You get a message the moment something looks wrong at the counter — even when you are not at the restaurant. Every alert is also kept under Alerts in the menu."
        />
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your WhatsApp number" hint="10-digit mobile number">
              <Input inputMode="tel" value={f.alertPhone ?? ""} onChange={(e) => set({ alertPhone: e.target.value })} placeholder="98765 43210" />
            </Field>
            <Field label="Your email (optional)">
              <Input type="email" value={f.alertEmail ?? ""} onChange={(e) => set({ alertEmail: e.target.value })} placeholder="owner@example.com" />
            </Field>
          </div>
          {channels && !channels.whatsapp && (
            <Tip tone="warning">
              Automatic WhatsApp messages are not switched on for your account yet (your software provider connects the WhatsApp Business number). Until then alerts appear under <b>Alerts</b>
              {channels.email ? " and come by email" : ""}, and you can send the daily report to WhatsApp with one tap from the Alerts page.
            </Tip>
          )}
          <Toggle
            checked={Boolean(f.dailyReportEnabled)}
            onChange={(v) => set({ dailyReportEnabled: v })}
            label="Send me the daily report"
            description="Sales, top dishes, cash vs UPI, cancellations, discounts, the cash count and stock running low — when the day is closed, or at 7 am next morning if nobody closed it."
          />
          <div>
            <Button variant="outline" loading={sending} disabled={changed || (!settings.alertPhone && !settings.alertEmail)} onClick={test}>
              <Send className="h-4 w-4" /> Send today&apos;s report now
            </Button>
            {changed && <span className="ml-3 text-xs text-slate-500">Save first</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="What to alert me about" description="These are the most common ways money leaks at a restaurant counter." />
        <CardContent className="space-y-4">
          <Toggle checked={rules.billChanged} onChange={(v) => rule({ billChanged: v })} label="Bill changed after printing" description="The guest got a printed bill, then dishes were removed or a discount added, and less money was taken." />
          <Toggle checked={rules.kotCancel} onChange={(v) => rule({ kotCancel: v })} label="Dish removed or order cancelled after KOT" description="The kitchen already cooked it, but it was taken off the bill. Also when a paid bill is cancelled." />
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_12rem]">
            <Toggle checked={rules.discount} onChange={(v) => rule({ discount: v })} label="Big discount or complimentary bill" description="Any bill given free, or with at least this much off." />
            <Field label="Discount of at least (%)">
              <Input type="number" min={1} max={100} value={String(rules.discountPercent)} disabled={!rules.discount} onChange={(e) => rule({ discountPercent: Number(e.target.value) })} />
            </Field>
          </div>
          <Toggle checked={rules.paymentMode} onChange={(v) => rule({ paymentMode: v })} label="Payment mode changed on a paid bill" description="For example a cash bill changed to UPI later — the cash can go missing from the drawer." />
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_12rem]">
            <Toggle checked={rules.cashShort} onChange={(v) => rule({ cashShort: v })} label="Cash short at day close" description="The cash counted is less than it should be." />
            <Field label="Short by at least (₹)">
              <Input type="number" min={0} value={String(rules.cashShortAmount)} disabled={!rules.cashShort} onChange={(e) => rule({ cashShortAmount: Number(e.target.value) })} />
            </Field>
          </div>
          <Toggle
            checked={rules.includeManagers}
            onChange={(v) => rule({ includeManagers: v })}
            label="Also alert for owner / manager accounts"
            description="Off: you hear about what cashiers and captains do. On: also about things done with owner / manager sign-ins. Cash short is always sent."
          />
        </CardContent>
      </Card>
      <Tip>
        <BellRing className="mr-1 inline h-4 w-4" /> Give cashiers and captains their own sign-in (Settings → Staff) so every alert says who did it.
      </Tip>
      <SaveBar saving={saving} changed={changed} onSave={save} />
    </div>
  );
}
