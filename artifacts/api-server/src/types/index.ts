export interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  email: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  financial_status: string;
  fulfillment_status: string | null;
  note: string | null;
  tags: string;
  gateway: string;
  payment_gateway_names: string[];
  shipping_address: ShopifyAddress | null;
  billing_address: ShopifyAddress | null;
  customer: ShopifyCustomer | null;
  line_items: ShopifyLineItem[];
  note_attributes: Array<{ name: string; value: string }>;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  current_total_price: string;
  total_discounts: string;
  refunds: ShopifyRefund[];
}

export interface ShopifyAddress {
  first_name: string | null;
  last_name: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  zip: string | null;
  country: string | null;
  phone: string | null;
  name?: string | null;
}

export interface ShopifyCustomer {
  id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface ShopifyLineItem {
  id: number;
  variant_id: number | null;
  product_id: number | null;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: string;
  total_discount: string;
  fulfillment_status: string | null;
}

export interface ShopifyRefund {
  id: number;
  created_at: string;
  note: string | null;
  refund_line_items: Array<{
    id: number;
    quantity: number;
    line_item_id: number;
    subtotal: string;
  }>;
}

export interface TabliyaOrderPayload {
  order_number: string;
  order_date: string;
  delivery_date: string;
  buyer_name: string;
  payment_status: "paid" | "unpaid" | "partial";
  amount_paid_partial?: number;
  street_name: string;
  house_number: string;
  zip_code: string;
  notes: string;
  payment_method: string;
  items: TabliyaOrderItem[];
}

export interface TabliyaOrderItem {
  product_id: number;
  quantity: number;
  discount_percent: number;
  notes?: string;
}

export interface TabliyaOrderUpdatePayload {
  status?: string;
  notes?: string;
  buyer_name?: string;
  order_date?: string;
  delivery_date?: string;
  payment_status?: "paid" | "unpaid" | "partial";
  payment_method?: string;
  amount_paid_partial?: number;
  street_name?: string;
  house_number?: string;
  zip_code?: string;
}

export interface TabliyaProduct {
  id: number;
  name: string;
  price: number;
  quantity_available: number;
  recipe_id: number | null;
  tax_enabled: boolean;
  tax_percentage: number;
}

export interface TabliyaPaymentMethod {
  id: number;
  name: string;
  sort_order: number;
}

export interface TabliyaOrder {
  id: number;
  order_number: string;
  order_date: string;
  delivery_date: string;
  buyer_name: string;
  payment_status: string;
  amount_paid_partial: number | null;
  street_name: string;
  house_number: string;
  zip_code: string;
  notes: string | null;
  payment_method: string | null;
  status: string;
  items: TabliyaOrderItemResponse[];
  created_at?: string;
  updated_at?: string;
}

export interface TabliyaOrderItemResponse {
  id: number;
  product_id: number;
  quantity: number;
  discount_percent: number;
  notes: string | null;
}

export interface TabliyaInvoice {
  id: number;
  order_id: number;
  invoice_number: string;
  payment_status: string;
  amount_paid: number;
  amount_remaining: number;
  buyer_name: string;
  street_name: string;
  house_number: string;
  zip_code: string;
  notes: string | null;
}

export interface AddressParts {
  streetName: string;
  houseNumber: string;
}

export type SyncAction = "create" | "update" | "cancel" | "replay";
export type SyncStatus = "pending" | "synced" | "failed" | "cancelled" | "skipped";
export type ProcessingStatus = "pending" | "processed" | "failed" | "duplicate" | "skipped";
export type PaymentStatus = "paid" | "unpaid" | "partial";
export type JobType =
  | "process-shopify-order-created"
  | "process-shopify-order-updated"
  | "process-shopify-order-cancelled"
  | "replay-sync"
  | "reconcile-failed-syncs"
  | "sync-tabliya-products"
  | "sync-tabliya-payment-methods";
