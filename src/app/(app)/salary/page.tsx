"use client";

import { useCallback, useEffect, useState } from "react";
import { HandCoins, Pencil, Plus, Printer, Undo2, Users, Wallet } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, StatCard, Tabs, Textarea, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, localToday } from "@/lib/client";
import { PAY_METHODS, daysInMonth, salaryFor } from "@/lib/payroll";
import { formatCurrency, formatDate, label } from "@/lib/utils";

interface Employee {
  id: string;
  name: string;
  phone: string | null;
  job: string | null;
  staffId: string | null;
  payType: string;
  salary: number;
  paidLeaves: number;
  joinedOn: string | null;
  active: boolean;
  notes: string | null;
}

interface Payslip {
  id: string;
  employeeId: string;
  month: string;
  daysWorked: number;
  paidLeaves: number;
  payDays: number;
  gross: number;
  bonus: number;
  deductions: number;
  advances: number;
  net: number;
  method: string;
  paidOn: string;
}

interface SheetRow {
  employee: Employee;
  shiftDays: number | null;
  advancesOwed: number;
  paid: Payslip | null;
  suggestion: { payDays: number; net: number };
}

interface Advance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
  method: string;
  note: string | null;
  payslipId: string | null;
}

interface PayrollResponse {
  month: string;
  sheet: SheetRow[];
  advances: Advance[];
  staff: Array<{ id: string; name: string; role: string }>;
  totals: { paid: number; advancesOwed: number };
}

type View = "sheet" | "people" | "advances";

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

function EmployeeDialog({ employee, staff, onClose, onSaved }: { employee: Employee | null; staff: PayrollResponse["staff"]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({
    name: employee?.name ?? "",
    phone: employee?.phone ?? "",
    job: employee?.job ?? "",
    staffId: employee?.staffId ?? "",
    payType: employee?.payType ?? "monthly",
    salary: employee ? String(employee.salary) : "",
    paidLeaves: employee ? String(employee.paidLeaves) : "4",
    joinedOn: employee?.joinedOn ?? "",
    active: employee?.active ?? true,
    notes: employee?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  async function save() {
    setSaving(true);
    try {
      const body = { ...f, salary: Number(f.salary) || 0, paidLeaves: f.payType === "daily" ? 0 : Number(f.paidLeaves) || 0, staffId: f.staffId || null };
      await api(employee ? `/api/payroll/employees/${employee.id}` : "/api/payroll/employees", { method: employee ? "PUT" : "POST", body });
      toast(employee ? "Saved" : `${f.name} added`);
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={employee ? `Edit ${employee.name}` : "Add employee"}
      description="Anyone you pay: cooks, waiters, helpers, cleaners. They don't need a sign-in."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!f.name.trim()} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </Field>
        <Field label="Work" optional>
          <Input value={f.job} onChange={(e) => set({ job: e.target.value })} placeholder="Cook, Waiter, Helper…" />
        </Field>
        <Field label="Phone" optional>
          <Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" />
        </Field>
        <Field label="Joined on" optional>
          <Input type="date" value={f.joinedOn} onChange={(e) => set({ joinedOn: e.target.value })} />
        </Field>
        <Field label="Paid">
          <Select value={f.payType} onChange={(e) => set({ payType: e.target.value })}>
            <option value="monthly">Monthly salary</option>
            <option value="daily">Daily wage</option>
          </Select>
        </Field>
        <Field label={f.payType === "daily" ? "Wage per day" : "Salary per month"}>
          <Input type="number" min={0} value={f.salary} onChange={(e) => set({ salary: e.target.value })} />
        </Field>
        {f.payType === "monthly" && (
          <Field label="Paid days off a month" hint="Weekly offs that are still paid, e.g. 4">
            <Input type="number" min={0} max={31} step="0.5" value={f.paidLeaves} onChange={(e) => set({ paidLeaves: e.target.value })} />
          </Field>
        )}
        <Field label="Their sign-in" optional hint="With a sign-in, their shifts fill in the days worked">
          <Select value={f.staffId} onChange={(e) => set({ staffId: e.target.value })}>
            <option value="">No sign-in</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" optional className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
        </Field>
        {employee && <Toggle checked={f.active} onChange={(v) => set({ active: v })} label="Still working here" description="Turn off when they leave. Their past salaries are kept." />}
      </div>
    </Modal>
  );
}

function PayDialog({ row, month, onClose, onSaved }: { row: SheetRow; month: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const e = row.employee;
  const daily = e.payType === "daily";
  const [days, setDays] = useState(String(row.shiftDays ?? (daily ? "" : Math.max(0, daysInMonth(month) - e.paidLeaves))));
  const [leaves, setLeaves] = useState(String(daily ? 0 : e.paidLeaves));
  const [bonus, setBonus] = useState("");
  const [deductions, setDeductions] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const pay = salaryFor({ payType: e.payType, rate: e.salary, month, daysWorked: Number(days) || 0, paidLeaves: Number(leaves) || 0, bonus: Number(bonus) || 0, deductions: Number(deductions) || 0, advances: row.advancesOwed });
  async function save() {
    setSaving(true);
    try {
      await api("/api/payroll/payslips", { body: { employeeId: e.id, month, daysWorked: Number(days) || 0, paidLeaves: Number(leaves) || 0, bonus: Number(bonus) || 0, deductions: Number(deductions) || 0, method, note: note || null } });
      toast(`${e.name}'s salary is paid`);
      onSaved();
    } catch (err) {
      toast((err as Error).message, "error");
      setSaving(false);
    }
  }
  const Line = ({ l, v, strong }: { l: string; v: string; strong?: boolean }) => (
    <div className={`flex justify-between py-1 ${strong ? "border-t border-slate-200 pt-2 text-lg font-semibold" : "text-slate-700"}`}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={`Pay ${e.name}`}
      description={`${monthLabel(month)} · ${daily ? `${formatCurrency(e.salary)} a day` : `${formatCurrency(e.salary)} a month`}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Pay {formatCurrency(pay.net)}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Days worked" hint={row.shiftDays !== null ? `Their shifts show ${row.shiftDays} day(s)` : daily ? undefined : `${daysInMonth(month)} days this month`}>
            <Input type="number" min={0} max={31} step="0.5" value={days} onChange={(ev) => setDays(ev.target.value)} autoFocus />
          </Field>
          {!daily && (
            <Field label="Paid days off">
              <Input type="number" min={0} max={31} step="0.5" value={leaves} onChange={(ev) => setLeaves(ev.target.value)} />
            </Field>
          )}
          <Field label="Bonus / overtime" optional>
            <Input type="number" min={0} value={bonus} onChange={(ev) => setBonus(ev.target.value)} />
          </Field>
          <Field label="Deductions" optional hint="Breakage, fines…">
            <Input type="number" min={0} value={deductions} onChange={(ev) => setDeductions(ev.target.value)} />
          </Field>
          <Field label="Paid by">
            <Select value={method} onChange={(ev) => setMethod(ev.target.value)}>
              {PAY_METHODS.map((m) => (
                <option key={m} value={m}>{label(m)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Note" optional>
            <Input value={note} onChange={(ev) => setNote(ev.target.value)} />
          </Field>
        </div>
        <div className="rounded-md bg-slate-50 px-4 py-3 text-sm">
          <Line l={`Salary for ${pay.payDays} day(s)`} v={formatCurrency(pay.gross)} />
          {pay.bonus > 0 && <Line l="+ Bonus / overtime" v={formatCurrency(pay.bonus)} />}
          {pay.deductions > 0 && <Line l="− Deductions" v={formatCurrency(pay.deductions)} />}
          {pay.advances > 0 && <Line l="− Advance taken back" v={formatCurrency(pay.advances)} />}
          <Line l="To pay" v={formatCurrency(pay.net)} strong />
          {pay.advanceLeft > 0 && <p className="mt-1 text-sm text-amber-700">{formatCurrency(pay.advanceLeft)} of the advance is taken back next month.</p>}
        </div>
        <p className="text-sm text-slate-500">Saved as today&apos;s expense under “Staff salary / advance”{method === "cash" ? ", paid from the till" : ""}.</p>
      </div>
    </Modal>
  );
}

function AdvanceDialog({ employees, onClose, onSaved }: { employees: Employee[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api("/api/payroll/advances", { body: { employeeId, amount: Number(amount), method, note: note || null } });
      toast("Advance saved. It is taken back from the next salary.");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Give an advance"
      description="Money before payday. It is taken back from their next salary."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!employeeId || !(Number(amount) > 0)} onClick={save}>Save advance</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Employee">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Amount">
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Paid by">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAY_METHODS.map((m) => (
              <option key={m} value={m}>{label(m)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Note" optional>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Festival, medical…" />
        </Field>
      </div>
    </Modal>
  );
}

export default function SalaryPage() {
  const { isAdmin, toast, confirm } = useApp();
  const [view, setView] = useState<View>("sheet");
  const [month, setMonth] = useState(localToday().slice(0, 7));
  const [data, setData] = useState<PayrollResponse | null>(null);
  const [editing, setEditing] = useState<Employee | null | "new">(null);
  const [paying, setPaying] = useState<SheetRow | null>(null);
  const [advance, setAdvance] = useState(false);

  const load = useCallback(() => {
    api<PayrollResponse>(`/api/payroll?month=${month}`).then(setData, (e) => toast((e as Error).message, "error"));
  }, [month, toast]);
  useEffect(() => {
    if (isAdmin) load();
  }, [load, isAdmin]);

  if (!isAdmin) return <Tip tone="warning">Only the owner / manager can see salaries.</Tip>;
  if (!data) return <Loading />;
  const active = data.sheet.map((r) => r.employee).filter((e) => e.active);
  const toPay = data.sheet.filter((r) => !r.paid && r.employee.active);

  async function undo(slip: Payslip, name: string) {
    const ok = await confirm({ title: `Undo ${name}'s salary?`, message: "The expense is removed and any advance taken back is owed again.", confirmText: "Undo salary", danger: true });
    if (!ok) return;
    try {
      await api(`/api/payroll/payslips/${slip.id}`, { method: "DELETE" });
      toast("Salary undone");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function removeAdvance(a: Advance) {
    const ok = await confirm({ title: "Remove this advance?", message: `${a.employeeName}, ${formatCurrency(a.amount)} on ${formatDate(a.date)}. Its expense is removed too.`, confirmText: "Remove", danger: true });
    if (!ok) return;
    try {
      await api(`/api/payroll/advances?id=${a.id}`, { method: "DELETE" });
      toast("Advance removed");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff salary"
        description="Monthly salaries and daily wages, advances before payday and payslips. Days worked come from staff shifts."
        actions={
          <>
            <Button variant="outline" onClick={() => setAdvance(true)} disabled={!active.length}><HandCoins className="h-5 w-5" /> Give advance</Button>
            <Button onClick={() => setEditing("new")}><Plus className="h-5 w-5" /> Add employee</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="People on payroll" value={active.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title={`Paid for ${monthLabel(month)}`} value={formatCurrency(data.totals.paid)} icon={<Wallet className="h-5 w-5" />} tone="green" />
        <StatCard title="Still to pay" value={`${toPay.length} people`} subtitle={`About ${formatCurrency(toPay.reduce((s, r) => s + r.suggestion.net, 0))}`} tone="amber" />
        <StatCard title="Advances to take back" value={formatCurrency(data.totals.advancesOwed)} icon={<HandCoins className="h-5 w-5" />} tone="sky" />
      </div>
      <Tabs<View>
        value={view}
        onChange={setView}
        tabs={[
          { value: "sheet", label: "Salary sheet" },
          { value: "people", label: "Employees", count: active.length },
          { value: "advances", label: "Advances" },
        ]}
      />

      {view === "sheet" && (
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
            <Field label="Month" className="w-48">
              <Input type="month" value={month} max={localToday().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </Field>
            <p className="text-sm text-slate-500">Monthly salary is paid per day: salary ÷ {daysInMonth(month)} days × (days worked + paid days off).</p>
          </div>
          {data.sheet.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Users className="h-6 w-6" />} title="No one on the payroll yet" description="Add your cooks, waiters and helpers with their salary. They don't need a sign-in." action={<Button onClick={() => setEditing("new")}>Add employee</Button>} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-4 py-2">Employee</th>
                    <th className="px-4 py-2 text-right">Pay</th>
                    <th className="px-4 py-2 text-right">Days</th>
                    <th className="px-4 py-2 text-right">Advance owed</th>
                    <th className="px-4 py-2 text-right">Salary</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.sheet.map((r) => (
                    <tr key={r.employee.id} className="border-b border-slate-50">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-900">{r.employee.name}</p>
                        <p className="text-xs text-slate-500">{r.employee.job || "—"}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(r.employee.salary)}<span className="text-slate-500">{r.employee.payType === "daily" ? " /day" : " /month"}</span></td>
                      <td className="px-4 py-2.5 text-right">{r.paid ? r.paid.payDays : r.shiftDays !== null ? `${r.shiftDays} on shift` : "—"}</td>
                      <td className="px-4 py-2.5 text-right">{r.advancesOwed ? formatCurrency(r.advancesOwed) : "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {r.paid ? (
                          <span className="inline-flex items-center gap-2">{formatCurrency(r.paid.net)} <Badge variant="success">Paid {formatDate(r.paid.paidOn).replace(/ \d{4}$/, "")}</Badge></span>
                        ) : (
                          <span className="text-slate-500">about {formatCurrency(r.suggestion.net)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.paid ? (
                          <span className="inline-flex gap-1">
                            <a href={`/print/payslip/${r.paid.id}`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" aria-label={`Print ${r.employee.name}'s payslip`}><Printer className="h-4 w-4" /> Payslip</Button>
                            </a>
                            <Button size="sm" variant="ghost" onClick={() => undo(r.paid!, r.employee.name)} aria-label={`Undo ${r.employee.name}'s salary`}><Undo2 className="h-4 w-4" /></Button>
                          </span>
                        ) : r.employee.active ? (
                          <Button size="sm" onClick={() => setPaying(r)}>Pay salary</Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {view === "people" && (
        <Card>
          {data.sheet.length === 0 && !data.sheet.some((r) => !r.employee.active) ? (
            <div className="p-5">
              <EmptyState icon={<Users className="h-6 w-6" />} title="No employees yet" action={<Button onClick={() => setEditing("new")}>Add employee</Button>} />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.sheet.map(({ employee: e }) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {e.name} {!e.active && <Badge>Left</Badge>}
                    </p>
                    <p className="text-sm text-slate-500">
                      {[e.job, e.phone, e.payType === "daily" ? `${formatCurrency(e.salary)} a day` : `${formatCurrency(e.salary)} a month`, e.staffId ? `signs in as ${data.staff.find((s) => s.id === e.staffId)?.name ?? "—"}` : "no sign-in"].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /> Edit</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {view === "advances" && (
        <Card>
          {data.advances.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<HandCoins className="h-6 w-6" />} title="No advances" description="Money given before payday is listed here and taken back from the next salary." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.advances.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{a.employeeName} · {formatCurrency(a.amount)}</p>
                    <p className="text-sm text-slate-500">{formatDate(a.date)} · {label(a.method)}{a.note ? ` · ${a.note}` : ""}</p>
                  </div>
                  {a.payslipId ? <Badge variant="success">Taken back</Badge> : <Badge variant="warning">To take back</Badge>}
                  {!a.payslipId && (
                    <Button size="sm" variant="ghost" onClick={() => removeAdvance(a)}>Remove</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {editing && <EmployeeDialog employee={editing === "new" ? null : editing} staff={data.staff} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {paying && <PayDialog row={paying} month={month} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); load(); }} />}
      {advance && <AdvanceDialog employees={active} onClose={() => setAdvance(false)} onSaved={() => { setAdvance(false); load(); }} />}
    </div>
  );
}
