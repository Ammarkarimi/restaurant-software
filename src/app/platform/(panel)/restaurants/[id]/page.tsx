"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Pause, Play, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, Field, Input, Loading, Modal, PageHeader, Row, Select, Textarea, Tip, Toggle } from "@/components/ui";
import { CredentialsCard, RestaurantStatusBadge, MonthStatusBadge, PAYMENT_METHOD_LABELS, money, type RestaurantDetail } from "@/components/platform-ui";
import { api } from "@/lib/client";
import { addMonths, monthLabel, monthRange } from "@/lib/subscription";
import { formatDate, formatDateTime } from "@/lib/utils";

type Dialog =
  | { kind: "payment" }
  | { kind: "password"; staffId: string; name: string }
  | { kind: "newPassword"; name: string; email: string; password: string }
  | { kind: "pause" }
  | { kind: "delete" }
  | { kind: "deletePayment"; paymentId: string; text: string }
  | null;

export default function PlatformRestaurantPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = useCallback(() => setDialog(null), []);

  useEffect(() => {
    api<RestaurantDetail>(`/api/platform/restaurants/${id}`).then(setRestaurant, (e) => setError(e.message));
  }, [id]);

  if (error && !restaurant) return <Tip tone="danger">{error}</Tip>;
  if (!restaurant) return <Loading />;
  const s = restaurant.subscription;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Link href="/platform" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> All restaurants
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {restaurant.name} <RestaurantStatusBadge status={restaurant.status} />
          </span>
        }
        description={[restaurant.city, `Customer since ${formatDate(restaurant.createdAt)}`].filter(Boolean).join(" · ")}
        actions={
          <Button size="lg" className="bg-slate-900 hover:bg-slate-800" onClick={() => setDialog({ kind: "payment" })}>
            <Plus className="h-5 w-5" /> Record a payment
          </Button>
        }
      />

      {restaurant.status !== "active" && (
        <Tip tone="danger">This restaurant is paused. Its staff cannot sign in. Nothing has been deleted.</Tip>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Payments by month"
            description={restaurant.monthlyFee > 0 ? `${money(restaurant.monthlyFee)} per month, charged from ${monthLabel(restaurant.billingStart)}` : "This restaurant uses the software for free"}
          />
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm text-slate-500">{monthLabel(s.currentMonth)}</p>
                <div className="mt-1"><MonthStatusBadge status={s.currentStatus} /></div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Still to collect</p>
                <p className={`mt-1 text-lg font-bold ${s.outstanding > 0 ? "text-red-700" : "text-slate-900"}`}>{money(s.outstanding)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Paid until</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{s.paidUntil ? monthLabel(s.paidUntil) : "—"}</p>
              </div>
            </div>
            {s.overdueMonths.length > 0 && (
              <Tip tone="warning">
                Late months: <b>{s.overdueMonths.map(monthLabel).join(", ")}</b>. The restaurant owner sees a reminder when they sign in.
              </Tip>
            )}
            {s.months.length === 0 ? (
              <p className="text-slate-500">Billing starts in {monthLabel(restaurant.billingStart)}.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {s.months.slice(0, 18).map((m) => (
                  <li key={m.month} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                    <span className="font-medium text-slate-800">{monthLabel(m.month)}</span>
                    <span className="flex items-center gap-3">
                      {m.paid > 0 && <span className="text-sm text-slate-500">{money(m.paid)} received</span>}
                      {m.due > 0 && <span className="text-sm font-semibold text-red-700">{money(m.due)} due</span>}
                      <MonthStatusBadge status={m.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Usage" description="Is the restaurant actually using the software?" />
          <CardContent>
            <Row label="Tables set up">{restaurant.usage.tables}</Row>
            <Row label="Dishes on the menu">{restaurant.usage.menuItems}</Row>
            <Row label="Bills (last 30 days)">{restaurant.usage.bills30d}</Row>
            <Row label="Sales (last 30 days)">{money(restaurant.usage.sales30d)}</Row>
            <Row label="Bills (all time)">{restaurant.usage.billsAll}</Row>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Payment history" description="Every payment you recorded from this restaurant." />
        <CardContent>
          {restaurant.payments.length === 0 ? (
            <p className="text-slate-500">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {restaurant.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[15px]">
                  <span className="min-w-0">
                    <b>{money(p.amount)}</b> for {monthLabel(p.month)}
                    {!p.clearsMonth && <Badge variant="warning" className="ml-2">Part payment</Badge>}
                    <span className="block text-sm text-slate-500">
                      {PAYMENT_METHOD_LABELS[p.method] ?? p.method} on {formatDate(p.paidOn)}
                      {p.reference && ` · Ref ${p.reference}`}
                      {p.notes && ` · ${p.notes}`}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Delete payment"
                    onClick={() => setDialog({ kind: "deletePayment", paymentId: p.id, text: `${money(p.amount)} for ${monthLabel(p.month)}` })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Sign-in accounts" description="The owner adds front-desk staff from their own Settings. You can give anyone a new password here." />
        <CardContent>
          <ul className="divide-y divide-slate-100">
            {restaurant.staff.map((st) => (
              <li key={st.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-semibold text-slate-900">{st.name}</span>{" "}
                  <Badge variant={st.role === "admin" ? "purple" : "default"}>{st.role === "admin" ? "Owner / manager" : "Front desk"}</Badge>
                  {!st.active && <Badge variant="danger" className="ml-1">Switched off</Badge>}
                  <span className="block break-all text-sm text-slate-500">
                    {st.email} · {st.lastLoginAt ? `last signed in ${formatDateTime(st.lastLoginAt)}` : "never signed in"}
                  </span>
                </span>
                <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "password", staffId: st.id, name: st.name })}>
                  <KeyRound className="h-4 w-4" /> New password
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-slate-500">
            Staff sign in at <b className="break-all">{origin}/login</b>
          </p>
        </CardContent>
      </Card>

      <DetailsForm restaurant={restaurant} onSaved={setRestaurant} />

      <Card>
        <CardHeader title="Pause or remove" />
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {restaurant.status === "active"
              ? "Pausing stops everyone at this restaurant from signing in (for example, when payment is very late). Their data is kept."
              : "Switching the restaurant back on lets its staff sign in again straight away."}
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            {restaurant.status === "active" ? (
              <Button variant="warning" onClick={() => setDialog({ kind: "pause" })}>
                <Pause className="h-4 w-4" /> Pause restaurant
              </Button>
            ) : (
              <Button
                variant="success"
                onClick={async () => setRestaurant(await api<RestaurantDetail>(`/api/platform/restaurants/${id}`, { method: "PATCH", body: { status: "active" } }))}
              >
                <Play className="h-4 w-4" /> Switch back on
              </Button>
            )}
            <Button variant="outline" className="text-red-700" onClick={() => setDialog({ kind: "delete" })}>
              <Trash2 className="h-4 w-4" /> Delete restaurant
            </Button>
          </div>
        </CardContent>
      </Card>

      {dialog?.kind === "payment" && <PaymentDialog restaurant={restaurant} onClose={close} onSaved={setRestaurant} />}
      {dialog?.kind === "password" && (
        <ConfirmDialog
          title={`New password for ${dialog.name}?`}
          body="Their old password stops working straight away. You will see the new one on the next screen to send to them."
          confirmText="Create new password"
          onClose={close}
          onConfirm={async () => {
            const r = await api<{ name: string; email: string; password: string }>(`/api/platform/restaurants/${id}/reset-password`, { body: { staffId: dialog.staffId } });
            setDialog({ kind: "newPassword", ...r });
            setRestaurant(await api<RestaurantDetail>(`/api/platform/restaurants/${id}`));
          }}
        />
      )}
      {dialog?.kind === "newPassword" && (
        <Modal open onClose={close} title={`New password for ${dialog.name}`}>
          <CredentialsCard restaurantName={restaurant.name} name={dialog.name} email={dialog.email} password={dialog.password} phone={restaurant.contactPhone} />
        </Modal>
      )}
      {dialog?.kind === "pause" && (
        <ConfirmDialog
          title={`Pause ${restaurant.name}?`}
          body="Everyone at this restaurant is signed out and cannot sign in. All their data is kept, and you can switch them back on at any time."
          confirmText="Pause restaurant"
          danger
          onClose={close}
          onConfirm={async () => {
            setRestaurant(await api<RestaurantDetail>(`/api/platform/restaurants/${id}`, { method: "PATCH", body: { status: "suspended" } }));
            close();
          }}
        />
      )}
      {dialog?.kind === "deletePayment" && (
        <ConfirmDialog
          title="Delete this payment?"
          body={`${dialog.text} will be removed, and that month will show as not paid again.`}
          confirmText="Delete payment"
          danger
          onClose={close}
          onConfirm={async () => {
            setRestaurant(await api<RestaurantDetail>(`/api/platform/payments/${dialog.paymentId}`, { method: "DELETE" }));
            close();
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteDialog
          restaurantName={restaurant.name}
          onClose={close}
          onConfirm={async (confirmName) => {
            await api(`/api/platform/restaurants/${id}`, { method: "DELETE", body: { confirmName } });
            router.push("/platform");
          }}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmText,
  danger,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmText: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                // onConfirm closes this dialog or replaces it with the next screen.
                await onConfirm();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-slate-700">{body}</p>
      {error && <div className="mt-3"><Tip tone="danger">{error}</Tip></div>}
    </Modal>
  );
}

function DeleteDialog({ restaurantName, onClose, onConfirm }: { restaurantName: string; onClose: () => void; onConfirm: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete ${restaurantName} for ever?`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={name.trim().toLowerCase() !== restaurantName.trim().toLowerCase()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(name);
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            Delete everything
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Tip tone="danger">
          This removes the restaurant, all its bills, menu, tables, staff sign-ins and payments. It cannot be undone. If you only want to stop them using the software, pause the restaurant instead.
        </Tip>
        <Field label={`Type "${restaurantName}" to confirm`}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        {error && <Tip tone="danger">{error}</Tip>}
      </div>
    </Modal>
  );
}

function PaymentDialog({ restaurant, onClose, onSaved }: { restaurant: RestaurantDetail; onClose: () => void; onSaved: (h: RestaurantDetail) => void }) {
  const s = restaurant.subscription;
  const firstOpen = [...s.months].reverse().find((m) => m.status === "unpaid" || m.status === "part_paid")?.month;
  const nextAfterPaid = s.paidUntil ? addMonths(s.paidUntil, 1) : null;
  const defaultMonth = firstOpen ?? nextAfterPaid ?? (restaurant.billingStart > s.currentMonth ? restaurant.billingStart : s.currentMonth);
  const from = restaurant.billingStart > addMonths(s.currentMonth, -24) ? restaurant.billingStart : addMonths(s.currentMonth, -24);
  const to = addMonths(restaurant.billingStart > s.currentMonth ? restaurant.billingStart : s.currentMonth, 12);

  const [month, setMonth] = useState(defaultMonth);
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(restaurant.monthlyFee > 0 ? String(restaurant.monthlyFee) : "");
  const [method, setMethod] = useState("upi");
  const [paidOn, setPaidOn] = useState(restaurant.today);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [clearsTouched, setClearsTouched] = useState(false);
  const [clearsChoice, setClearsChoice] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const expected = restaurant.monthlyFee * months;
  const clearsMonth = clearsTouched ? clearsChoice : Number(amount) >= expected;

  async function save() {
    setSaving(true);
    setError("");
    try {
      const updated = await api<RestaurantDetail>(`/api/platform/restaurants/${restaurant.id}/payments`, {
        body: { month, months, amount: Number(amount), method, paidOn, reference, notes, clearsMonth },
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record a payment"
      description={`Money received from ${restaurant.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!(Number(amount) > 0)} onClick={save}>Save payment</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="For the month of">
          <Select value={month} onChange={(e) => setMonth(e.target.value)}>
            {monthRange(from, to).reverse().map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Number of months" hint={months > 1 ? `${monthLabel(month)} to ${monthLabel(addMonths(month, months - 1))}` : undefined}>
          <Select
            value={months}
            onChange={(e) => {
              const n = Number(e.target.value);
              setMonths(n);
              if (restaurant.monthlyFee > 0) setAmount(String(restaurant.monthlyFee * n));
            }}
          >
            {[1, 2, 3, 6, 12].map((n) => (
              <option key={n} value={n}>{n === 1 ? "1 month" : `${n} months`}</option>
            ))}
          </Select>
        </Field>
        <Field label="Amount received (₹)" hint={restaurant.monthlyFee > 0 ? `Fee for ${months === 1 ? "1 month" : `${months} months`}: ${money(expected)}` : undefined}>
          <Input type="number" min={1} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Paid by">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date received">
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
        <Field label="Reference" optional hint="UPI / bank transaction number">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Note" optional className="sm:col-span-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Toggle
            checked={clearsMonth}
            onChange={(v) => {
              setClearsTouched(true);
              setClearsChoice(v);
            }}
            label={months > 1 ? "Mark these months as fully paid" : "Mark this month as fully paid"}
            description="Turn off for a part payment. The rest will still show as due."
          />
        </div>
        {error && <div className="sm:col-span-2"><Tip tone="danger">{error}</Tip></div>}
      </div>
    </Modal>
  );
}

function DetailsForm({ restaurant, onSaved }: { restaurant: RestaurantDetail; onSaved: (h: RestaurantDetail) => void }) {
  const initial = {
    name: restaurant.name,
    city: restaurant.city ?? "",
    contactName: restaurant.contactName ?? "",
    contactPhone: restaurant.contactPhone ?? "",
    contactEmail: restaurant.contactEmail ?? "",
    monthlyFee: String(restaurant.monthlyFee),
    billingStart: restaurant.billingStart,
    notes: restaurant.notes ?? "",
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const changed = JSON.stringify(form) !== JSON.stringify(initial);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api<RestaurantDetail>(`/api/platform/restaurants/${restaurant.id}`, {
        method: "PATCH",
        body: { ...form, monthlyFee: Number(form.monthlyFee || 0) },
      });
      onSaved(updated);
      setMessage({ tone: "success", text: "Saved" });
    } catch (err) {
      setMessage({ tone: "danger", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Restaurant details" description="Contact details and what they pay you." />
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Restaurant name">
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </Field>
          <Field label="City" optional>
            <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="Contact person" optional>
            <Input value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
          </Field>
          <Field label="Contact phone" optional>
            <Input type="tel" value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
          </Field>
          <Field label="Contact email" optional>
            <Input type="email" value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
          </Field>
          <Field label="Monthly fee (₹)">
            <Input type="number" min={0} step="1" inputMode="numeric" value={form.monthlyFee} onChange={(e) => set({ monthlyFee: e.target.value })} required />
          </Field>
          <Field label="First month to charge" hint="Months before this are free.">
            <Input type="month" value={form.billingStart} onChange={(e) => set({ billingStart: e.target.value })} required />
          </Field>
          <Field label="Notes" optional className="sm:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" loading={saving} disabled={!changed}>Save details</Button>
            {message && <span className={message.tone === "success" ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>{message.text}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
