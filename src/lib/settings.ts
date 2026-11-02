import { currentRestaurantId, prisma } from "./db";
import { parseBillTemplate } from "./bill-template";
import { todayKey } from "./dates";
import { parseAlertRules } from "./alert-rules";

/** The current restaurant's profile and preferences (created with defaults on first use). */
export async function getSettings() {
  const restaurantId = currentRestaurantId();
  return prisma.restaurantSettings.upsert({
    where: { restaurantId },
    update: {},
    create: { restaurantId },
  });
}

export type SettingsRecord = Awaited<ReturnType<typeof getSettings>>;

/** Settings as sent to the browser: the bill template is parsed and the logo becomes a URL. */
export function publicSettings(s: SettingsRecord) {
  // Keys for Razorpay / UrbanPiper never leave the server; the screens only learn whether they are set.
  const { billTemplate, logoPath, razorpayKeySecret, razorpayWebhookSecret, urbanpiperApiKey, aggregatorToken, alertRules, ...rest } = s;
  return {
    ...rest,
    alertRules: parseAlertRules(alertRules),
    razorpayConnected: Boolean(s.razorpayKeyId && razorpayKeySecret),
    razorpayWebhookSet: Boolean(razorpayWebhookSecret),
    urbanpiperConnected: Boolean(s.urbanpiperUser && urbanpiperApiKey),
    aggregatorWebhookPath: aggregatorToken ? `/api/public/aggregator/${aggregatorToken}` : null,
    billTemplate: parseBillTemplate(billTemplate),
    logoUrl: logoUrl(s),
    today: todayKey(s.timezone),
  };
}

export type PublicSettings = ReturnType<typeof publicSettings>;

export function logoUrl(s: Pick<SettingsRecord, "logoPath" | "updatedAt">) {
  return s.logoPath ? `/api/settings/logo?v=${new Date(s.updatedAt).getTime()}` : null;
}

/** The logo URL for pages guests open without signing in. */
export function publicLogoUrl(slug: string, s: Pick<SettingsRecord, "logoPath" | "updatedAt">) {
  return s.logoPath ? `/api/public/logo/${slug}?v=${new Date(s.updatedAt).getTime()}` : null;
}
