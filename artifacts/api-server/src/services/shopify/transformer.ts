import type {
  ShopifyOrder,
  TabliyaOrderPayload,
  TabliyaOrderUpdatePayload,
  PaymentStatus,
} from "../../types/index.js";
import { parseAddress } from "../../utils/address.js";
import { toDateString, computeDeliveryDate, extractDeliveryDateFromOrder } from "../../utils/date.js";
import { db } from "@workspace/db";
import {
  productMappingsTable,
  paymentMethodMappingsTable,
} from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export interface TransformResult {
  success: boolean;
  payload?: TabliyaOrderPayload;
  unmappedItems?: Array<{ variantId: number | null; sku: string | null; title: string }>;
  missingPaymentMethod?: boolean;
  paymentMethodUsed?: string;
  error?: string;
}

/**
 * Map Shopify financial_status -> Tabliya payment_status
 */
export function mapPaymentStatus(financialStatus: string): PaymentStatus {
  const status = financialStatus?.toLowerCase() ?? "";
  if (status === "paid") return "paid";
  if (status === "partially_paid" || status === "partial") return "partial";
  return "unpaid";
}

/**
 * Compute amount_paid_partial from Shopify order totals.
 */
export function computeAmountPaidPartial(order: ShopifyOrder): number | undefined {
  const financial = order.financial_status?.toLowerCase() ?? "";
  if (financial === "partially_paid") {
    // Shopify doesn't expose partial paid amount directly in webhooks,
    // so we use total_price - current_total_price as a best estimate.
    const total = parseFloat(order.total_price || "0");
    const current = parseFloat(order.current_total_price || order.total_price || "0");
    const paid = total - current;
    return paid > 0 ? paid : undefined;
  }
  return undefined;
}

/**
 * Get buyer name from Shopify order.
 */
export function getBuyerName(order: ShopifyOrder): string {
  const shipping = order.shipping_address;
  if (shipping?.name && shipping.name.trim()) return shipping.name.trim();
  if (shipping?.first_name || shipping?.last_name) {
    return `${shipping.first_name ?? ""} ${shipping.last_name ?? ""}`.trim();
  }
  const billing = order.billing_address;
  if (billing?.name && billing.name.trim()) return billing.name.trim();
  if (billing?.first_name || billing?.last_name) {
    return `${billing.first_name ?? ""} ${billing.last_name ?? ""}`.trim();
  }
  if (order.customer?.first_name || order.customer?.last_name) {
    return `${order.customer.first_name ?? ""} ${order.customer.last_name ?? ""}`.trim();
  }
  return order.email ?? "Unknown Customer";
}

/**
 * Build Tabliya order notes from Shopify order.
 */
export function buildNotes(order: ShopifyOrder, extra?: string): string {
  const parts: string[] = [];
  parts.push(`Shopify Order: ${order.name} (#${order.id})`);
  if (order.note) parts.push(`Customer Note: ${order.note}`);
  if (order.gateway) parts.push(`Payment Gateway: ${order.gateway}`);
  if (parseFloat(order.total_discounts || "0") > 0) {
    parts.push(`Total Discounts: ${order.total_discounts}`);
  }
  if (extra) parts.push(extra);
  return parts.join("\n");
}

/**
 * Transform a Shopify order into a Tabliya order payload.
 * Returns errors if product/payment mappings are missing.
 */
export async function transformShopifyOrder(
  order: ShopifyOrder
): Promise<TransformResult> {
  // 1. Resolve product mappings
  const unmappedItems: Array<{ variantId: number | null; sku: string | null; title: string }> = [];
  const items: TabliyaOrderPayload["items"] = [];

  for (const lineItem of order.line_items) {
    const variantId = lineItem.variant_id;

    let mapping = null;
    if (variantId) {
      [mapping] = await db
        .select()
        .from(productMappingsTable)
        .where(
          and(
            eq(productMappingsTable.shopifyVariantId, String(variantId)),
            eq(productMappingsTable.active, true)
          )
        )
        .limit(1);
    }

    if (!mapping) {
      unmappedItems.push({
        variantId: variantId ?? null,
        sku: lineItem.sku ?? null,
        title: lineItem.title,
      });
      continue;
    }

    const itemPrice = parseFloat(lineItem.price || "0");
    const itemDiscount = parseFloat(lineItem.total_discount || "0");
    const discountPercent =
      itemPrice > 0 && itemDiscount > 0
        ? Math.round((itemDiscount / (itemPrice * lineItem.quantity)) * 100)
        : 0;

    items.push({
      product_id: parseInt(mapping.tabliyaProductId, 10),
      quantity: lineItem.quantity,
      discount_percent: discountPercent,
      notes: lineItem.sku ? `SKU: ${lineItem.sku}` : undefined,
    });
  }

  if (unmappedItems.length > 0) {
    return {
      success: false,
      unmappedItems,
      error: `Unmapped products: ${unmappedItems.map((i) => i.title).join(", ")}`,
    };
  }

  // 2. Resolve payment method
  const gateway = order.payment_gateway_names?.[0] ?? order.gateway ?? "";
  let [paymentMethodMapping] = await db
    .select()
    .from(paymentMethodMappingsTable)
    .where(
      and(
        eq(paymentMethodMappingsTable.shopifyPaymentLabel, gateway),
        eq(paymentMethodMappingsTable.active, true)
      )
    )
    .limit(1);

  if (!paymentMethodMapping) {
    // Try case-insensitive by fetching all active and matching
    const allMappings = await db
      .select()
      .from(paymentMethodMappingsTable)
      .where(eq(paymentMethodMappingsTable.active, true));
    paymentMethodMapping = allMappings.find(
      (m) => m.shopifyPaymentLabel.toLowerCase() === gateway.toLowerCase()
    ) ?? null as unknown as typeof paymentMethodMapping;
  }

  const tabliyaPaymentMethod = paymentMethodMapping?.tabliyaPaymentMethod ?? null;
  if (!tabliyaPaymentMethod) {
    logger.warn({ gateway }, "No payment method mapping found");
  }

  // 3. Address
  const addr = parseAddress(order.shipping_address?.address1 ?? order.billing_address?.address1);
  const zip = order.shipping_address?.zip ?? order.billing_address?.zip ?? "";

  // 4. Delivery date
  const deliveryDate =
    extractDeliveryDateFromOrder(order.note_attributes ?? [], order.tags ?? "") ??
    computeDeliveryDate(order.created_at);

  // 5. Payment status
  const paymentStatus = mapPaymentStatus(order.financial_status);
  const amountPaidPartial = computeAmountPaidPartial(order);

  const payload: TabliyaOrderPayload = {
    order_number: `SHOPIFY-${order.id}`,
    order_date: toDateString(order.created_at),
    delivery_date: deliveryDate,
    buyer_name: getBuyerName(order),
    payment_status: paymentStatus,
    ...(paymentStatus === "partial" && amountPaidPartial !== undefined
      ? { amount_paid_partial: amountPaidPartial }
      : {}),
    street_name: addr.streetName,
    house_number: addr.houseNumber,
    zip_code: zip,
    notes: buildNotes(order),
    payment_method: tabliyaPaymentMethod ?? "",
    items,
  };

  return { success: true, payload, paymentMethodUsed: tabliyaPaymentMethod ?? undefined };
}

/**
 * Build a Tabliya update payload from an updated Shopify order.
 */
export async function buildUpdatePayload(
  order: ShopifyOrder
): Promise<TabliyaOrderUpdatePayload> {
  const addr = parseAddress(order.shipping_address?.address1 ?? order.billing_address?.address1);
  const zip = order.shipping_address?.zip ?? order.billing_address?.zip ?? "";
  const deliveryDate =
    extractDeliveryDateFromOrder(order.note_attributes ?? [], order.tags ?? "") ??
    computeDeliveryDate(order.created_at);

  const gateway = order.payment_gateway_names?.[0] ?? order.gateway ?? "";
  const [paymentMethodMapping] = await db
    .select()
    .from(paymentMethodMappingsTable)
    .where(
      and(
        eq(paymentMethodMappingsTable.shopifyPaymentLabel, gateway),
        eq(paymentMethodMappingsTable.active, true)
      )
    )
    .limit(1);

  const paymentStatus = mapPaymentStatus(order.financial_status);
  const amountPaidPartial = computeAmountPaidPartial(order);

  return {
    buyer_name: getBuyerName(order),
    order_date: toDateString(order.created_at),
    delivery_date: deliveryDate,
    payment_status: paymentStatus,
    payment_method: paymentMethodMapping?.tabliyaPaymentMethod ?? undefined,
    ...(paymentStatus === "partial" && amountPaidPartial !== undefined
      ? { amount_paid_partial: amountPaidPartial }
      : {}),
    street_name: addr.streetName,
    house_number: addr.houseNumber,
    zip_code: zip,
    notes: buildNotes(order),
  };
}
