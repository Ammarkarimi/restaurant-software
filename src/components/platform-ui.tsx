"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, LogOut, MessageCircle } from "lucide-react";
import { Badge, Button, Tip } from "@/components/ui";
import { whatsappLink } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";

export const money = (n: number) => formatCurrency(n, "INR");

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  cheque: "Cheque",
  other: "Other",
};

const MONTH_STATUS: Record<string, { text: string; variant: string }> = {
  paid: { text: "Paid", variant: "success" },
  part_paid: { text: "Part paid", variant: "warning" },
  unpaid: { text: "Not paid", variant: "danger" },
  free: { text: "Free", variant: "info" },
  not_started: { text: "Billing not started", variant: "default" },
};

export function MonthStatusBadge({ status }: { status: string }) {
  const s = MONTH_STATUS[status] ?? { text: status, variant: "default" };
  return <Badge variant={s.variant}>{s.text}</Badge>;
}

export function RestaurantStatusBadge({ status }: { status: string }) {
  return status === "active" ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Paused</Badge>;
}

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/platform/logout", { method: "POST" }).catch(() => null);
    router.push("/platform/login");
    router.refresh();
  }
  return (
    <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out" className="text-slate-200 hover:bg-slate-800 hover:text-white">
      <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}

/** Sign-in details for a restaurant, shown once, with copy and WhatsApp buttons. */
export function CredentialsCard({
  restaurantName,
  name,
  email,
  password,
  phone,
}: {
  restaurantName: string;
  name?: string;
  email: string;
  password: string;
  phone?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const message = [
    `Hello${name ? ` ${name}` : ""}, your restaurant billing software for ${restaurantName} is ready.`,
    "",
    `Sign in: ${origin}/login`,
    `Email: ${email}`,
    `Password: ${password}`,
    "",
    "Please change the password after you sign in (My account → Change password).",
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <Tip tone="warning">
        Save or send these details now. For safety the password is not shown again. You can always create a new one later.
      </Tip>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[15px]">
        <p>
          <span className="text-slate-500">Sign-in page:</span> <b className="break-all">{origin}/login</b>
        </p>
        <p>
          <span className="text-slate-500">Email:</span> <b className="break-all">{email}</b>
        </p>
        <p>
          <span className="text-slate-500">Password:</span> <b className="font-mono text-lg">{password}</b>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy message"}
        </Button>
        <a href={whatsappLink(phone, message)} target="_blank" rel="noopener noreferrer">
          <Button variant="success">
            <MessageCircle className="h-4 w-4" /> Send on WhatsApp
          </Button>
        </a>
      </div>
    </div>
  );
}

export interface RestaurantRow {
  id: string;
  name: string;
  city: string | null;
  status: string;
  contactName: string | null;
  contactPhone: string | null;
  monthlyFee: number;
  billingStart: string;
  createdAt: string;
  tables: number;
  menuItems: number;
  staff: number;
  lastLoginAt: string | null;
  bills30d: number;
  subscription: { currentStatus: string; overdueMonths: string[]; outstanding: number; paidUntil: string | null };
}

export interface Overview {
  month: string;
  restaurants: RestaurantRow[];
  recentPayments: Array<{ id: string; month: string; amount: number; method: string; paidOn: string; restaurant: { id: string; name: string } }>;
  totals: {
    restaurants: number;
    active: number;
    suspended: number;
    expectedMonthly: number;
    collectedThisMonth: number;
    outstanding: number;
    unpaidThisMonth: number;
    overdueRestaurants: number;
  };
}

export interface RestaurantDetail {
  id: string;
  name: string;
  status: string;
  city: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  monthlyFee: number;
  billingStart: string;
  notes: string | null;
  createdAt: string;
  today: string;
  staff: Array<{ id: string; name: string; email: string; role: string; active: boolean; lastLoginAt: string | null }>;
  payments: Array<{ id: string; month: string; amount: number; clearsMonth: boolean; method: string; reference: string | null; notes: string | null; paidOn: string }>;
  usage: { tables: number; menuItems: number; bills30d: number; billsAll: number; sales30d: number };
  subscription: {
    months: Array<{ month: string; status: string; paid: number; due: number }>;
    currentMonth: string;
    currentStatus: string;
    overdueMonths: string[];
    outstanding: number;
    paidUntil: string | null;
  };
}
