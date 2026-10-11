"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Tabs, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { BillSummary } from "@/components/pos/bill-summary";
import { BillDesigner } from "./bill-designer";
import { api } from "@/lib/client";
import { calculateBill } from "@/lib/billing";
import { formatDateTime, label } from "@/lib/utils";
import type { SettingsDTO } from "@/lib/types";

type Tab = "restaurant" | "tax" | "bill" | "staff" | "activity";

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Kathmandu", "Asia/Dhaka", "Asia/Colombo", "Asia/Singapore", "Europe/London", "America/New_York", "Australia/Sydney"];

function useSettingsForm(settings: SettingsDTO, onSaved: (s: SettingsDTO) => void, pick: Array<keyof SettingsDTO>) {
  const { toast } = useApp();
  const initial = Object.fromEntries(pick.map((k) => [k, settings[k]])) as Partial<SettingsDTO>;
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (p: Partial<SettingsDTO>) => setForm((f) => ({ ...f, ...p }));
  async function save() {
    setSaving(true);
    try {
      const r = await api<{ settings: SettingsDTO }>("/api/settings", { method: "PATCH", body: form });
      onSaved(r.settings);
      toast("Settings saved");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }
  return { form, set, save, saving, changed };
}

function SaveBar({ saving, changed, onSave }: { saving: boolean; changed: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Button size="lg" loading={saving} disabled={!changed} onClick={onSave}>
        Save changes
      </Button>
      {changed && <span className="text-sm font-medium text-amber-700">Not saved yet</span>}
    </div>
  );
}

function RestaurantTab({ settings, onSaved }: { settings: SettingsDTO; onSaved: (s: SettingsDTO) => void }) {
  const { form: f, set, save, saving, changed } = useSettingsForm(settings, onSaved, [
    "restaurantName",
    "legalName",
    "address",
    "city",
    "phone",
    "email",
    "gstin",
    "fssai",
    "currency",
    "timezone",
  ]);
  const text = (k: keyof SettingsDTO) => ({ value: (f[k] as string | null) ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: e.target.value } as Partial<SettingsDTO>) });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Restaurant details" description="Printed at the top of every bill." />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Restaurant name">
            <Input {...text("restaurantName")} required />
          </Field>
          <Field label="Registered business name" optional hint="If different, e.g. Sharma Foods Pvt Ltd">
            <Input {...text("legalName")} />
          </Field>
          <Field label="Address" optional className="sm:col-span-2">
            <Input {...text("address")} />
          </Field>
          <Field label="City" optional>
            <Input {...text("city")} />
          </Field>
          <Field label="Phone" optional>
            <Input type="tel" {...text("phone")} />
          </Field>
          <Field label="Email" optional>
            <Input type="email" {...text("email")} />
          </Field>
          <Field label="GSTIN" optional hint="15 characters, printed on tax invoices">
            <Input {...text("gstin")} maxLength={20} style={{ textTransform: "uppercase" }} />
          </Field>
          <Field label="FSSAI licence number" optional hint="14 digits. Printing it on bills is required for food businesses in India.">
            <Input {...text("fssai")} maxLength={20} inputMode="numeric" />
          </Field>
          <Field label="Currency" hint="3-letter code: INR, AED, USD…">
            <Input {...text("currency")} maxLength={3} style={{ textTransform: "uppercase" }} />
          </Field>
          <Field label="Time zone" hint="Decides when “today” starts for sales">
            <Select value={f.timezone as string} onChange={(e) => set({ timezone: e.target.value })}>
              {[...new Set([f.timezone as string, ...TIMEZONES])].map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>
      <SaveBar saving={saving} changed={changed} onSave={save} />
    </div>
  );
}

function TaxTab({ settings, onSaved }: { settings: SettingsDTO; onSaved: (s: SettingsDTO) => void }) {
  const { form: f, set, save, saving, changed } = useSettingsForm(settings, onSaved, [
    "taxMode",
    "taxName",
    "defaultTaxRate",
    "pricesIncludeTax",
    "serviceChargePercent",
    "roundOff",
    "billPrefix",
  ]);
  const example = calculateBill([{ price: 1000, quantity: 1, taxRate: Number(f.defaultTaxRate) || 0 }], {
    taxMode: f.taxMode as string,
    pricesIncludeTax: Boolean(f.pricesIncludeTax),
    serviceChargePercent: Number(f.serviceChargePercent) || 0,
    roundOff: Boolean(f.roundOff),
  });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Tax" description="Changes apply to new orders. Bills already started keep the old rules." />
          <CardContent className="space-y-4">
            <Field label="How tax is shown">
              <Select value={f.taxMode as string} onChange={(e) => set({ taxMode: e.target.value })}>
                <option value="gst">GST — split into CGST + SGST (India)</option>
                <option value="simple">One tax line (VAT / sales tax)</option>
                <option value="none">No tax on bills</option>
              </Select>
            </Field>
            {f.taxMode !== "none" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tax rate for dishes (%)" hint={f.taxMode === "gst" ? "Most restaurants: 5%. You can set a different rate on any dish." : "You can set a different rate on any dish."}>
                  <Input type="number" min={0} max={100} step="0.01" value={String(f.defaultTaxRate)} onChange={(e) => set({ defaultTaxRate: Number(e.target.value) })} />
                </Field>
                {f.taxMode === "simple" && (
                  <Field label="Tax name" hint="Printed on the bill, e.g. VAT">
                    <Input value={f.taxName as string} onChange={(e) => set({ taxName: e.target.value })} maxLength={20} />
                  </Field>
                )}
                <div className="sm:col-span-2">
                  <Toggle
                    checked={Boolean(f.pricesIncludeTax)}
                    onChange={(v) => set({ pricesIncludeTax: v })}
                    label="Menu prices already include tax"
                    description="On: a ₹105 dish costs the guest ₹105 (₹100 + ₹5 tax). Off: tax is added on top of the menu price."
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Charges & bill numbers" />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Service charge (%)" hint="0 for none. Added after discount; taxed like the food.">
              <Input type="number" min={0} max={50} step="0.01" value={String(f.serviceChargePercent)} onChange={(e) => set({ serviceChargePercent: Number(e.target.value) })} />
            </Field>
            <Field label="Bill number prefix" optional hint={`Bills will be numbered ${(f.billPrefix as string) || ""}1, ${(f.billPrefix as string) || ""}2…`}>
              <Input value={f.billPrefix as string} onChange={(e) => set({ billPrefix: e.target.value })} maxLength={12} placeholder="e.g. SG/25-26/" />
            </Field>
            <div className="sm:col-span-2">
              <Toggle checked={Boolean(f.roundOff)} onChange={(v) => set({ roundOff: v })} label="Round off the total" description="₹1,049.50 becomes ₹1,050, so you don't deal with coins." />
            </div>
          </CardContent>
        </Card>
        <SaveBar saving={saving} changed={changed} onSave={save} />
      </div>
      <Card className="h-fit">
        <CardHeader title="Example" description="A ₹1,000 order with these settings" />
        <CardContent>
          <BillSummary
            totals={example}
            taxMode={f.taxMode as string}
            taxName={f.taxName as string}
            pricesIncludeTax={Boolean(f.pricesIncludeTax)}
            serviceChargePercent={Number(f.serviceChargePercent) || 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

function StaffTab() {
  const { toast, confirm, user } = useApp();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const [resetFor, setResetFor] = useState<StaffRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(() => {
    api<StaffRow[]>("/api/staff").then(setStaff).catch(() => setStaff([]));
  }, []);
  useEffect(() => load(), [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/staff", { body: form });
      toast(`${form.name} can now sign in`);
      setAddOpen(false);
      setForm({ name: "", email: "", password: "", role: "staff" });
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function update(s: StaffRow, body: Record<string, unknown>, msg: string) {
    try {
      await api(`/api/staff/${s.id}`, { method: "PUT", body });
      toast(msg);
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function remove(s: StaffRow) {
    const ok = await confirm({ title: `Remove ${s.name}?`, message: "They will no longer be able to sign in. Their past actions stay in the activity history.", confirmText: "Remove", danger: true });
    if (!ok) return;
    try {
      await api(`/api/staff/${s.id}`, { method: "DELETE" });
      toast("Staff account removed");
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  if (!staff) return <Loading />;
  return (
    <Card>
      <CardHeader
        title="Staff accounts"
        description="Give each cashier and captain their own sign-in, so you can see who did what. They can take orders and bills, but cannot see reports, change the menu or settings, or cancel food the kitchen has started."
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add staff
          </Button>
        }
      />
      <ul className="divide-y divide-slate-100">
        {staff.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {s.name} {s.id === user.id && <Badge variant="info">You</Badge>} {!s.active && <Badge variant="danger">Disabled</Badge>}
              </p>
              <p className="text-sm text-slate-500">
                {s.email} · {label(s.role)}
              </p>
            </div>
            {s.id !== user.id && (
              <div className="flex flex-wrap gap-2">
                <Select value={s.role} onChange={(e) => update(s, { role: e.target.value }, "Access changed")} className="min-h-9 w-48 py-1 text-sm" aria-label="Access">
                  <option value="staff">Cashier / Captain</option>
                  <option value="admin">Owner / Manager</option>
                </Select>
                <Button size="sm" variant="outline" onClick={() => (setResetFor(s), setNewPassword(""))}>
                  <KeyRound className="h-4 w-4" /> Reset password
                </Button>
                <Button size="sm" variant="outline" onClick={() => update(s, { active: !s.active }, s.active ? "Account disabled" : "Account enabled")}>
                  {s.active ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(s)} aria-label={`Remove ${s.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a staff member">
        <form onSubmit={add} className="space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          </Field>
          <Field label="Email (used to sign in)">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Password" hint="At least 6 characters. They can change it later in My account.">
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </Field>
          <Field label="Access">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="staff">Cashier / Captain — orders, KOT, bills, payments</option>
              <option value="admin">Owner / Manager — everything incl. reports, menu & settings</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit">Add staff</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!resetFor}
        onClose={() => setResetFor(null)}
        title={`New password for ${resetFor?.name ?? ""}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setResetFor(null)}>Cancel</Button>
            <Button
              disabled={newPassword.length < 6}
              onClick={async () => {
                if (resetFor) await update(resetFor, { password: newPassword }, "Password changed. Tell the staff member their new password.");
                setResetFor(null);
              }}
            >
              Save password
            </Button>
          </>
        }
      >
        <Field label="New password" hint="At least 6 characters.">
          <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </Card>
  );
}

function ActivityTab() {
  const { settings } = useApp();
  const [items, setItems] = useState<Array<{ id: string; staffName: string; action: string; details: string | null; createdAt: string }>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((after?: string) => {
    setLoading(true);
    api<{ items: typeof items; nextCursor: string | null }>(`/api/activity${after ? `?cursor=${after}` : ""}`)
      .then((r) => {
        setItems((prev) => (after ? [...prev, ...r.items] : r.items));
        setCursor(r.nextCursor);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  const risky = /cancel|removed item|discount/i;
  return (
    <Card>
      <CardHeader title="Activity history" description="Every order, kitchen ticket, bill, payment, discount, cancellation and change — and who did it." />
      {items.length === 0 && !loading ? (
        <div className="p-5"><EmptyState title="No activity yet" /></div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 px-5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                <b>{a.staffName}</b> — <span className={risky.test(a.action) ? "font-semibold text-red-700" : ""}>{a.action}</span>
                {a.details && <span className="text-slate-500">: {a.details}</span>}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.createdAt, settings.timezone)}</span>
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <div className="p-4 text-center">
          <Button variant="outline" loading={loading} onClick={() => load(cursor)}>Show older</Button>
        </div>
      )}
    </Card>
  );
}

function SettingsView() {
  const { isAdmin } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const requested = sp.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(requested && ["restaurant", "tax", "bill", "staff", "activity"].includes(requested) ? requested : "restaurant");
  const [settings, setSettings] = useState<SettingsDTO | null>(null);

  useEffect(() => {
    api<{ settings: SettingsDTO }>("/api/settings").then((r) => setSettings(r.settings));
  }, []);

  if (!isAdmin) return <Tip tone="warning">Only the owner / manager can change settings.</Tip>;
  if (!settings) return <Loading />;

  // The sidebar shows the name and logo; refresh it when they change.
  const saved = (s: SettingsDTO) => {
    const shellChanged = s.restaurantName !== settings.restaurantName || s.logoUrl !== settings.logoUrl || s.currency !== settings.currency;
    setSettings(s);
    if (shellChanged) router.refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your restaurant's details, tax, bill design and staff." />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => {
          setTab(t);
          window.history.replaceState(null, "", `/settings?tab=${t}`);
        }}
        tabs={[
          { value: "restaurant", label: "Restaurant" },
          { value: "tax", label: "Tax & charges" },
          { value: "bill", label: "Bill design" },
          { value: "staff", label: "Staff" },
          { value: "activity", label: "Activity history" },
        ]}
      />
      {tab === "restaurant" && <RestaurantTab key={settings.id + "r"} settings={settings} onSaved={saved} />}
      {tab === "tax" && <TaxTab key={settings.id + "t"} settings={settings} onSaved={saved} />}
      {tab === "bill" && <BillDesigner settings={settings} onChange={saved} />}
      {tab === "staff" && <StaffTab />}
      {tab === "activity" && <ActivityTab />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsView />
    </Suspense>
  );
}
