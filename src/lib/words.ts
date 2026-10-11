// Amount in words using the Indian numbering system (lakh, crore), as printed on invoices.
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

export function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

export function amountInWords(amount: number, currency = "INR"): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  const [major, minor] = currency === "INR" ? ["Rupees", "Paise"] : [currency, "cents"];
  return `${major} ${numberToWords(rupees)}${paise ? ` and ${numberToWords(paise)} ${minor}` : ""} Only`;
}
