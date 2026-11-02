"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, ExternalLink, FlaskConical } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, Field, Input, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import type { SettingsDTO } from "@/lib/types";

function CopyBox({ value, label }: { value: string; label: string }) {
  const { toast } = useApp();
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button
          variant="outline"
          aria-label={`Copy ${label}`}
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => toast("Copied"), () => undefined);
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </Field>
  );
}

export function IntegrationsTab({ settings, onSaved }: { settings: SettingsDTO; onSaved: (s: SettingsDTO) => void }) {
  const { toast } = useApp();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const [rzp, setRzp] = useState({ keyId: settings.razorpayKeyId ?? "", secret: "", webhook: "" });
  const [up, setUp] = useState({ enabled: settings.aggregatorEnabled, autoAccept: settings.aggregatorAutoAccept, user: settings.urbanpiperUser ?? "", key: "" });
  const [saving, setSaving] = useState<string | null>(null);

  async function save(what: string, body: Record<string, unknown>) {
    setSaving(what);
    try {
      const r = await api<{ settings: SettingsDTO }>("/api/settings", { method: "PATCH", body });
      onSaved(r.settings);
      toast("Saved");
      return r.settings;
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(null);
    }
  }

  async function testOrder() {
    setSaving("test");
    try {
      const r = await api<{ orderId: string; number: number }>("/api/settings/aggregator-test", { method: "POST" });
      toast(`Test Zomato order #${r.number} made — see it on the Tables screen`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2">UPI that confirms itself (Razorpay) {settings.razorpayConnected ? <Badge variant="success">Connected</Badge> : <Badge>Not connected</Badge>}</span>}
          description="Each bill gets its own UPI QR for the exact amount. When the guest pays, the bill closes by itself — on the counter screen and on the guest's digital bill. No more “show me the screenshot”."
        />
        <CardContent className="space-y-4">
          <Tip>
            You need a Razorpay account with <b>QR Codes</b> switched on (ask Razorpay support to enable “UPI QR”). Then in Razorpay go to <b>Account &amp; Settings → API Keys</b> and create a key. Money goes straight to your bank from Razorpay (their usual fee applies).
          </Tip>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Key ID">
              <Input value={rzp.keyId} onChange={(e) => setRzp({ ...rzp, keyId: e.target.value.trim() })} placeholder="rzp_live_…" />
            </Field>
            <Field label="Key Secret" hint={settings.razorpayConnected ? "Saved. Leave empty to keep it." : undefined}>
              <Input type="password" autoComplete="off" value={rzp.secret} onChange={(e) => setRzp({ ...rzp, secret: e.target.value.trim() })} placeholder={settings.razorpayConnected ? "••••••••" : ""} />
            </Field>
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-700">Webhook (recommended, so payments show in a second)</p>
            <p className="text-sm text-slate-600">
              In Razorpay → <b>Webhooks</b> → Add new: paste this address, choose the event <b>qr_code.credited</b>, and type any secret. Put the same secret here.
            </p>
            <CopyBox label="Webhook address" value={`${origin}/api/public/razorpay/${settings.restaurantId}`} />
            <Field label="Webhook secret" hint={settings.razorpayWebhookSet ? "Saved. Leave empty to keep it." : "Without it the screen still checks every few seconds."}>
              <Input type="password" autoComplete="off" value={rzp.webhook} onChange={(e) => setRzp({ ...rzp, webhook: e.target.value.trim() })} placeholder={settings.razorpayWebhookSet ? "••••••••" : ""} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={saving === "rzp"}
              disabled={!rzp.keyId || (!settings.razorpayConnected && !rzp.secret)}
              onClick={async () => {
                const ok = await save("rzp", { razorpayKeyId: rzp.keyId, ...(rzp.secret && { razorpayKeySecret: rzp.secret }), ...(rzp.webhook && { razorpayWebhookSecret: rzp.webhook }) });
                if (ok) setRzp((x) => ({ ...x, secret: "", webhook: "" }));
              }}
            >
              Save Razorpay
            </Button>
            {settings.razorpayConnected && (
              <Button variant="outline" loading={saving === "rzp-off"} onClick={() => save("rzp-off", { razorpayKeyId: null, razorpayKeySecret: null, razorpayWebhookSecret: null }).then(() => setRzp({ keyId: "", secret: "", webhook: "" }))}>
                Disconnect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2">Zomato &amp; Swiggy orders (UrbanPiper) {settings.aggregatorEnabled ? <Badge variant="success">On</Badge> : <Badge>Off</Badge>}</span>}
          description="Orders from Zomato and Swiggy arrive on the Tables screen with a sound — no typing them in. Accept, Food ready and Handed to rider are sent back to the app."
        />
        <CardContent className="space-y-4">
          <Tip>
            Zomato and Swiggy connect billing software through <b>UrbanPiper</b>. Sign up with UrbanPiper (they link your Zomato / Swiggy outlets), then give them the order address below and ask for your API username and key. Until then, use <b>Try a test order</b> to see how it works.
          </Tip>
          <Toggle checked={up.enabled} onChange={(v) => setUp({ ...up, enabled: v })} label="Receive Zomato / Swiggy orders" />
          {up.enabled && (
            <>
              <Toggle checked={up.autoAccept} onChange={(v) => setUp({ ...up, autoAccept: v })} label="Accept orders automatically" description="Send every new app order straight to the kitchen. Off: the cashier taps Accept (or Reject)." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="UrbanPiper API username">
                  <Input value={up.user} onChange={(e) => setUp({ ...up, user: e.target.value.trim() })} placeholder="biz_adm_…" />
                </Field>
                <Field label="UrbanPiper API key" hint={settings.urbanpiperConnected ? "Saved. Leave empty to keep it." : "Needed to send Accept / Ready back to the app."}>
                  <Input type="password" autoComplete="off" value={up.key} onChange={(e) => setUp({ ...up, key: e.target.value.trim() })} placeholder={settings.urbanpiperConnected ? "••••••••" : ""} />
                </Field>
              </div>
              {settings.aggregatorWebhookPath ? (
                <CopyBox label="Order address for UrbanPiper (order relay and status webhooks)" value={`${origin}${settings.aggregatorWebhookPath}`} />
              ) : (
                <p className="text-sm text-slate-500">Save to get your order address for UrbanPiper.</p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              loading={saving === "up"}
              onClick={async () => {
                const ok = await save("up", { aggregatorEnabled: up.enabled, aggregatorAutoAccept: up.autoAccept, urbanpiperUser: up.user || null, ...(up.key && { urbanpiperApiKey: up.key }) });
                if (ok) setUp((x) => ({ ...x, key: "" }));
              }}
            >
              Save
            </Button>
            {settings.aggregatorEnabled && (
              <Button variant="outline" loading={saving === "test"} onClick={testOrder}>
                <FlaskConical className="h-4 w-4" /> Try a test order
              </Button>
            )}
            <a href="https://www.urbanpiper.com/" target="_blank" rel="noreferrer">
              <Button variant="ghost"><ExternalLink className="h-4 w-4" /> About UrbanPiper</Button>
            </a>
          </div>
          <p className="text-xs text-slate-500">
            App orders carry no GST on your bill (Zomato / Swiggy pay it under section 9(5)). Set each app&apos;s commission under{" "}
            <Link href="/settings?tab=online" className="font-semibold text-primary-700 hover:underline">Online &amp; delivery</Link> to see your real payout in Reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
