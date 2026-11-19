// Staff salaries: who is paid what, advances taken before payday, and the month's salary sheet.
// Shared by the server and the screens, so the sheet always matches what gets paid.
import { z } from "zod";

export const PAY_TYPES = ["monthly", "daily"] as const;
export type PayType = (typeof PAY_TYPES)[number];
export const PAY_METHODS = ["cash", "upi", "bank"] as const;
export const SALARY_EXPENSE_CATEGORY = "Staff salary / advance";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Days in a month given as "YYYY-MM". */
export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export interface SalaryInput {
  payType: string;
  /** Per month for monthly staff, per day for daily wages. */
  rate: number;
  month: string;
  daysWorked: number;
  paidLeaves: number;
  bonus?: number;
  deductions?: number;
  /** Advances not yet taken back. */
  advances?: number;
}

export interface SalaryLine {
  payDays: number;
  gross: number;
  bonus: number;
  deductions: number;
  advances: number;
  /** What is paid out; never below zero (a bigger advance carries over). */
  net: number;
  /** Advance left to take back next month, when this month's pay was not enough. */
  advanceLeft: number;
}

/**
 * One month's pay. Monthly staff get salary ÷ days in the month for each day worked or on paid
 * leave (never more than the full salary); daily staff get the day's wage per day. Advances are
 * taken back as far as the pay allows.
 */
export function salaryFor(s: SalaryInput): SalaryLine {
  const days = daysInMonth(s.month);
  const worked = Math.max(0, s.daysWorked);
  const leaves = Math.max(0, s.paidLeaves);
  const payDays = s.payType === "daily" ? worked + leaves : Math.min(days, worked + leaves);
  const gross = s.payType === "daily" ? r2(s.rate * payDays) : r2((s.rate / days) * payDays);
  const bonus = r2(Math.max(0, s.bonus ?? 0));
  const deductions = r2(Math.max(0, s.deductions ?? 0));
  const before = r2(gross + bonus - deductions);
  const owed = r2(Math.max(0, s.advances ?? 0));
  const advances = r2(Math.min(owed, Math.max(0, before)));
  return { payDays, gross, bonus, deductions, advances, net: r2(Math.max(0, before - advances)), advanceLeft: r2(owed - advances) };
}

export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Enter the name").max(80),
  phone: z.string().trim().max(20).nullable().optional(),
  job: z.string().trim().max(40).nullable().optional(),
  staffId: z.string().max(40).nullable().optional(),
  payType: z.enum(PAY_TYPES),
  salary: z.coerce.number().min(0).max(10_000_000),
  paidLeaves: z.coerce.number().min(0).max(31).default(0),
  joinedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
  active: z.boolean().default(true),
  notes: z.string().trim().max(300).nullable().optional(),
});

export const advanceSchema = z.object({
  employeeId: z.string().min(1).max(40),
  amount: z.coerce.number().positive("Enter the amount").max(10_000_000),
  method: z.enum(PAY_METHODS).default("cash"),
  note: z.string().trim().max(200).nullable().optional(),
});

export const payslipSchema = z.object({
  employeeId: z.string().min(1).max(40),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Choose the month"),
  daysWorked: z.coerce.number().min(0).max(31),
  paidLeaves: z.coerce.number().min(0).max(31).default(0),
  bonus: z.coerce.number().min(0).max(10_000_000).default(0),
  deductions: z.coerce.number().min(0).max(10_000_000).default(0),
  method: z.enum(PAY_METHODS).default("cash"),
  note: z.string().trim().max(200).nullable().optional(),
});
