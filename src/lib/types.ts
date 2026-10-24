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
}

export interface CategoryDTO {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  items: MenuItemDTO[];
}

export interface TableDTO {
  id: string;
  name: string;
  area: string;
  seats: number;
  sortOrder: number;
  active: boolean;
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
  items: Array<{ id: string; name: string; variant: string | null; quantity: number; note: string | null; cancelled: boolean; kitchenStatus: string }>;
}
