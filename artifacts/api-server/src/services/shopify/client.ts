import axios from "axios";
import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";
import type { ShopifyOrder } from "../../types/index.js";

/**
 * Fetch a fresh order from the Shopify Admin REST API.
 */
export async function fetchShopifyOrder(orderId: number | string): Promise<ShopifyOrder | null> {
  if (!config.SHOPIFY_STORE_DOMAIN || !config.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    logger.warn("Shopify Admin API not configured — cannot fetch order from API");
    return null;
  }

  try {
    const res = await axios.get<{ order: ShopifyOrder }>(
      `https://${config.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${orderId}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": config.SHOPIFY_ADMIN_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    return res.data.order;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      logger.error(
        { orderId, status: err.response?.status },
        "Failed to fetch Shopify order from Admin API"
      );
    }
    return null;
  }
}
