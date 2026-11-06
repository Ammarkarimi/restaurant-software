import { STATUS_LABEL, type BanquetStatus } from "@/lib/banquet";
import { cn } from "@/lib/utils";

export const STATUS_TONE: Record<BanquetStatus, string> = {
  enquiry: "bg-slate-100 text-slate-700",
  tentative: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-sky-100 text-sky-800",
  cancelled: "bg-red-100 text-red-700",
};

export function StatusChip({ status }: { status: BanquetStatus }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

