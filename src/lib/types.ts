// Shapes of the JSON the API sends to the browser (dates arrive as strings).
import type { BillTemplate } from "./bill-template";
import type { BillTotals } from "./billing";

export interface MenuItemDTO {
  id: string;
  categoryId: string;
  name: string;
  shortCode: string | null;
  description: string | null;
  price: number;
  variants: string;
  foodType: string;
  taxRate: number | null;
  available: boolean;
  sortOrder: number;
  /** JSON ids of the add-on groups offered with the dish. */
  addonGroupIds: string;
  showOnline: boolean;
  imageUrl: string | null;
}

export interface CategoryDTO {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  /** Kitchen station that cooks this category; null = the main kitchen. */
  station: string | null;
  items: MenuItemDTO[];
}

export interface AddonGroupDTO {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  /** JSON [{ name, price }] */
  options: string;
  sortOrder: number;
}

export interface PriceListDTO {
  id: string;
  name: string;
  active: boolean;
  adjustPercent: number;
  roundTo: number;
  areas: string;
  orderTypes: string;
  sources: string;
  days: string;
  startTime: string | null;
  endTime: string | null;
  categoryIds: string;
  overrides: string;
  sortOrder: number;
}

/** What GET /api/menu returns. */
export interface MenuResponse {
  categories: CategoryDTO[];
  addonGroups: AddonGroupDTO[];
  priceLists: PriceListDTO[];
}

export interface TableDTO {
  id: string;
  name: string;
  area: string;
  seats: number;
  sortOrder: number;
  active: boolean;
  qrToken: string;
  /** A guest pressed "Call waiter" (waiter) or "Ask for the bill" (bill) on the table QR menu. */
  callType: string | null;
  callAt: string | null;
}

export interface OrderSummary {
  id: string;
  number: number;
  type: string;
  source: string;
  sourceRef: string | null;
  status: string;
  tableId: string | null;
  splitOf: string | null;
  customerName: string | null;
  guests: number;
  createdAt: string;
  billNumber: string | null;
  total: number;
  itemCount: number;
  unsent: number;
  guestNew: number;
  ready: number;
}

export interface OrderItemDTO {
  id: string;
  menuItemId: string | null;
  name: string;
  variant: string | null;
  categoryName: string | null;
  foodType: string;
  price: number;
  quantity: number;
  taxRate: number;
  note: string | null;
  /** JSON [{ group, name, price }]; already part of `price`. */
  addons: string;
  station: string | null;
  byGuest: boolean;
  kotNumber: number | null;
  sentAt: string | null;
  kitchenStatus: string;
  status: string;
  cancelReason: string | null;
  createdAt: string;
}

export interface PaymentDTO {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  receivedBy: string | null;
  paidAt: string;
}

export interface OrderDTO {
  id: string;
  number: number;
  type: string;
  source: string;
  sourceRef: string | null;
  status: string;
  tableId: string | null;
  /** Set while the order is the table's running order (null for a separate bill). */
  activeTableId: string | null;
  table: { id: string; name: string; area: string } | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  guests: number;
  notes: string | null;
  discountType: string;
  discountValue: number;
  discountReason: string | null;
  discountMax: number | null;
  offerId: string | null;
  complimentary: boolean;
  taxMode: string;
  taxName: string;
  pricesIncludeTax: boolean;
  serviceChargePercent: number;
  roundOff: boolean;
  packingCharge: number;
  deliveryCharge: number;
  chargeTaxRate: number;
  billNumber: string | null;
  createdAt: string;
  billedAt: string | null;
  settledAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdByName: string | null;
  items: OrderItemDTO[];
  payments: PaymentDTO[];
  totals: BillTotals;
  paid: number;
  balance: number;
  unsentCount: number;
  customerId: string | null;
  pointsRedeemed: number;
  pointsEarned: number;
  shareToken: string | null;
}

export interface CustomerLookup {
  id: string;
  name: string | null;
  phone: string;
  address: string | null;
  points: number;
  visits: number;
  lastVisitAt: string | null;
  /** More than 0 = money paid in advance, less than 0 = they owe. */
  balance: number;
  creditLimit: number | null;
}

export interface SettingsDTO {
  id: string;
  restaurantName: string;
  legalName: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  fssai: string | null;
  currency: string;
  timezone: string;
  taxMode: string;
  taxName: string;
  defaultTaxRate: number;
  pricesIncludeTax: boolean;
  serviceChargePercent: number;
  packingCharge: number;
  deliveryCharge: number;
  roundOff: boolean;
  billPrefix: string;
  upiId: string | null;
  loyaltyEnabled: boolean;
  loyaltyEarnPercent: number;
  loyaltyMinRedeem: number;
  qrMenuEnabled: boolean;
  qrOrderingEnabled: boolean;
  /** JSON names of kitchen stations. */
  kitchenStations: string;
  billTemplate: BillTemplate;
  logoUrl: string | null;
  today: string;
}

/** A kitchen order ticket on the kitchen screen. */
export interface KitchenTicket {
  key: string;
  kotNumber: number;
  orderId: string;
  orderNumber: number;
  type: string;
  source: string;
  sourceRef: string | null;
  table: string | null;
  customerName: string | null;
  notes: string | null;
  sentAt: string;
  status: "new" | "ready";
  items: Array<{ id: string; name: string; variant: string | null; quantity: number; note: string | null; addons: string; station: string | null; cancelled: boolean; kitchenStatus: string }>;
}

export interface OfferDTO {
  id: string;
  name: string;
  code: string | null;
  type: string;
  value: number;
  maxDiscount: number | null;
  minBill: number;
  orderTypes: string;
  days: string;
  startTime: string | null;
  endTime: string | null;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  timesUsed: number;
}
