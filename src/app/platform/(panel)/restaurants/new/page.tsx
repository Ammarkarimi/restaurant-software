"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, PageHeader, Select, Textarea, Tip, Toggle } from "@/components/ui";
import { CredentialsCard } from "@/components/platform-ui";
import { api, localToday } from "@/lib/client";
import { addMonths, monthLabel, monthOf } from "@/lib/subscription";

interface Created {
  restaurant: { id: string; name: string; contactName: string | null; contactPhone: string | null };
  login: { email: string; password: string } | null;
  linkedOwners?: Array<{ name: string; email: string }>;
}

export default function NewRestaurantPage() {
  const thisMonth = monthOf(localToday());
  const [form, setForm] = useState({
    name: "",
    city: "",
    ownerName: "",
    ownerEmail: "",
    contactPhone: "",
    monthlyFee: "",
    billingStart: thisMonth,
    password: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [sameOwner, setSameOwner] = useState(false);
  const [sameOwnerAs, setSameOwnerAs] = useState("");
  const [existing, setExisting] = useState<Array<{ id: string; name: string; city: string | null }>>([]);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (sameOwner && existing.length === 0) {
      api<{ restaurants: Array<{ id: string; name: string; city: string | null }> }>("/api/platform/restaurants").then((r) => setExisting(r.restaurants));
    }
  }, [sameOwner, existing.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = await api<Created>("/api/platform/restaurants", {
        body: sameOwner
          ? { ...form, ownerName: undefined, ownerEmail: undefined, password: undefined, monthlyFee: Number(form.monthlyFee || 0), sameOwnerAs }
          : { ...form, monthlyFee: Number(form.monthlyFee || 0), password: form.password || undefined },
      });
      setCreated(result);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title="Restaurant added" description={`${created.restaurant.name} can start using the software now.`} />
        {created.login ? (
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Send these sign-in details to the owner</span>} />
            <CardContent>
              <CredentialsCard
                restaurantName={created.restaurant.name}
                name={created.restaurant.contactName ?? undefined}
                email={created.login.email}
                password={created.login.password}
                phone={created.restaurant.contactPhone}
              />
            </CardContent>
          </Card>
        ) : (
          <Tip tone="success">
            {created.linkedOwners?.map((o) => `${o.name} (${o.email})`).join(", ")} can manage this outlet with their existing sign-in. They pick it from the
            “Outlet” list at the top of their menu.
          </Tip>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={`/platform/restaurants/${created.restaurant.id}`}>
            <Button>Open this restaurant</Button>
          </Link>
          <Link href="/platform">
            <Button variant="outline">Back to all restaurants</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={
          <Link href="/platform" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> All restaurants
          </Link>
        }
        title="Add a restaurant"
        description="Creates the restaurant and a sign-in for its owner. The owner can then add tables, the menu and staff themselves."
      />
      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader title="Restaurant" />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Restaurant name" className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Restaurant Sea View" required />
            </Field>
            <Field label="City" optional>
              <Input value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="e.g. Goa" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Owner" description="The person who will sign in and run the restaurant." />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Toggle
                checked={sameOwner}
                onChange={setSameOwner}
                label="This owner already has a restaurant with you"
                description="Another outlet of the same owner: no new sign-in. They switch between outlets and see the sales of all of them."
              />
            </div>
            {sameOwner ? (
              <Field label="Their existing restaurant" className="sm:col-span-2">
                <Select value={sameOwnerAs} onChange={(e) => setSameOwnerAs(e.target.value)} required>
                  <option value="">Choose…</option>
                  {existing.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.city ? ` · ${r.city}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Owner's name">
                  <Input value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} required />
                </Field>
                <Field label="Owner's phone" optional hint="Used to send the sign-in on WhatsApp.">
                  <Input type="tel" value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="98765 43210" />
                </Field>
                <Field label="Owner's email" hint="They sign in with this email." className="sm:col-span-2">
                  <Input type="email" value={form.ownerEmail} onChange={(e) => set({ ownerEmail: e.target.value })} required />
                </Field>
                <Field label="Password" optional hint="Leave empty and we'll create an easy-to-type one." className="sm:col-span-2">
                  <Input value={form.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" />
                </Field>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Subscription" description="What this restaurant pays you." />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Monthly fee (₹)" hint="Put 0 for a free account.">
              <Input type="number" min={0} step="1" inputMode="numeric" value={form.monthlyFee} onChange={(e) => set({ monthlyFee: e.target.value })} placeholder="e.g. 999" required />
            </Field>
            <Field label="First month to charge" hint="Choose a later month to give free months.">
              <Select value={form.billingStart} onChange={(e) => set({ billingStart: e.target.value })}>
                {[0, 1, 2, 3, 6].map((n) => {
                  const m = addMonths(thisMonth, n);
                  return (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                      {n === 0 ? " (this month)" : ` (${n} free month${n > 1 ? "s" : ""})`}
                    </option>
                  );
                })}
              </Select>
            </Field>
            <Field label="Notes" optional className="sm:col-span-2">
              <Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything you want to remember about this restaurant" />
            </Field>
          </CardContent>
        </Card>

        {error && <Tip tone="danger">{error}</Tip>}
        <Button type="submit" size="lg" loading={saving} className="w-full bg-slate-900 hover:bg-slate-800 sm:w-auto">
          {sameOwner ? "Create outlet" : "Create restaurant and sign-in"}
        </Button>
      </form>
    </div>
  );
}
