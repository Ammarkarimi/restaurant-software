import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { prisma, runForRestaurant } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateKey } from "@/lib/dates";
import { formatCurrency, label } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payslip" };

type Props = { params: Promise<{ id: string }> };

/** A month's salary slip on A4 / A5, to give the employee or keep in the file. */
export default async function PayslipPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");
  if (session.role !== "admin") notFound();
  const { id } = await params;
  const data = await runForRestaurant(session.restaurantId, async () => {
    const slip = await prisma.payslip.findFirst({ where: { id }, include: { employee: true } });
    return slip ? { slip, settings: await getSettings() } : null;
  });
  if (!data) notFound();
  const { slip, settings } = data;
  const c = (n: number) => formatCurrency(n, settings.currency);
  const [y, m] = slip.month.split("-").map(Number);
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const Row = ({ l, v, bold }: { l: string; v: string; bold?: boolean }) => (
    <tr className={bold ? "font-bold" : ""}>
      <td className="border border-slate-300 px-3 py-1.5">{l}</td>
      <td className="border border-slate-300 px-3 py-1.5 text-right">{v}</td>
    </tr>
  );
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{"@page { size: A5; margin: 12mm; }"}</style>
      <PrintButton title={`Payslip · ${slip.employeeName} · ${monthName}`} />
      <div className="py-6 print:py-0">
        <div className="print-sheet mx-auto max-w-xl bg-white p-8 text-[14px] text-black shadow print:p-0 print:shadow-none">
          <p className="text-lg font-bold">{settings.legalName || settings.restaurantName}</p>
          {settings.address && <p className="text-slate-700">{settings.address}</p>}
          <p className="mt-4 text-center text-base font-bold tracking-wide">SALARY SLIP · {monthName.toUpperCase()}</p>
          <table className="mt-4 w-full border-collapse">
            <tbody>
              <Row l="Name" v={slip.employeeName} />
              {slip.employee.job && <Row l="Work" v={slip.employee.job} />}
              <Row l={slip.payType === "daily" ? "Wage per day" : "Salary per month"} v={c(slip.rate)} />
              <Row l="Days worked" v={String(slip.daysWorked)} />
              {slip.paidLeaves > 0 && <Row l="Paid days off" v={String(slip.paidLeaves)} />}
              <Row l="Days paid" v={String(slip.payDays)} />
            </tbody>
          </table>
          <table className="mt-4 w-full border-collapse">
            <tbody>
              <Row l="Salary for the days" v={c(slip.gross)} />
              {slip.bonus > 0 && <Row l="Bonus / overtime" v={c(slip.bonus)} />}
              {slip.deductions > 0 && <Row l="Deductions" v={`− ${c(slip.deductions)}`} />}
              {slip.advances > 0 && <Row l="Advance taken back" v={`− ${c(slip.advances)}`} />}
              <Row l="PAID" v={c(slip.net)} bold />
            </tbody>
          </table>
          <p className="mt-3">Paid by {label(slip.method)} on {formatDateKey(slip.paidOn)}.{slip.note ? ` ${slip.note}` : ""}</p>
          <div className="mt-16 flex justify-between">
            <span className="border-t border-black px-6 pt-1">Employee</span>
            <span className="border-t border-black px-6 pt-1">For {settings.restaurantName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
