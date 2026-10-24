// Shared by the server and the browser.

/** Digits only, and Indian mobiles without the +91 / 0 in front, so one guest is one customer. */
export function normalizePhone(phone: string | null | undefined): string | null {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
