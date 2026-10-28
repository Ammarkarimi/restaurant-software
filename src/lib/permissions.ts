// What a cashier / captain may do. Owners / managers may do everything; kitchen accounts only use
// the kitchen screen. The defaults match how the app worked before rights could be changed.

export interface Permissions {
  /** Most a cashier may take off by hand, in % of the items (offers set by the owner always work). 0 = no discounts. */
  discountMax: number;
  cancelItems: boolean;
  cancelOrders: boolean;
  reprint: boolean;
  complimentary: boolean;
  payLater: boolean;
  changePayment: boolean;
  seeSales: boolean;
  expenses: boolean;
}

export type Right = Exclude<keyof Permissions, "discountMax">;

export const DEFAULT_PERMISSIONS: Permissions = {
  discountMax: 100,
  cancelItems: true,
  cancelOrders: false,
  reprint: true,
  complimentary: false,
  payLater: false,
  changePayment: false,
  seeSales: true,
  expenses: true,
};

export const RIGHTS: Array<{ key: Right; label: string; hint: string }> = [
  { key: "cancelItems", label: "Remove dishes the kitchen already has", hint: "Always with a reason, kept in the activity history" },
  { key: "cancelOrders", label: "Cancel orders after they went to the kitchen or were billed", hint: "A common way money goes missing — keep it for trusted staff" },
  { key: "reprint", label: "Print a bill again", hint: "Reprints are kept in the activity history" },
  { key: "complimentary", label: "Make a bill complimentary (on the house)", hint: "Nothing is charged; reports show it separately" },
  { key: "payLater", label: "Let any customer pay later", hint: "Without this, only customers with a credit limit (set by you) can pay later" },
  { key: "changePayment", label: "Change how a paid bill was paid", hint: "e.g. cash to UPI" },
  { key: "seeSales", label: "See today's sales on the Tables screen", hint: "" },
  { key: "expenses", label: "Add expenses (money out of the till)", hint: "" },
];

export function parsePermissions(json: string | null | undefined): Permissions {
  try {
    const raw = JSON.parse(json || "{}") as Partial<Permissions>;
    const out = { ...DEFAULT_PERMISSIONS };
    for (const k of Object.keys(DEFAULT_PERMISSIONS) as Array<keyof Permissions>) {
      const v = raw?.[k];
      if (k === "discountMax") {
        if (typeof v === "number" && v >= 0 && v <= 100) out.discountMax = v;
      } else if (typeof v === "boolean") out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

type Who = { role: string; permissions?: Permissions | null };

export function can(user: Who | null | undefined, right: Right): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "staff") return false;
  return (user.permissions ?? DEFAULT_PERMISSIONS)[right];
}

/** The biggest discount (in %) this person may give by hand. */
export function discountLimit(user: Who | null | undefined): number {
  if (!user) return 0;
  if (user.role === "admin") return 100;
  return (user.permissions ?? DEFAULT_PERMISSIONS).discountMax;
}
