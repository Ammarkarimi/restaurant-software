// Delivery riders, kept in settings as JSON [{ name, phone }].

export interface Rider {
  name: string;
  phone: string;
}

export function parseRiders(json: string | null | undefined): Rider[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed)
      ? parsed.flatMap((r) => (r && typeof r.name === "string" && r.name.trim() ? [{ name: r.name.trim(), phone: typeof r.phone === "string" ? r.phone : "" }] : []))
      : [];
  } catch {
    return [];
  }
}
