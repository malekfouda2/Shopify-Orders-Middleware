import crypto from "crypto";
import { config } from "../config/index.js";

/**
 * Verify a Shopify webhook HMAC-SHA256 signature.
 * Shopify sends the HMAC in X-Shopify-Hmac-Sha256 as base64.
 */
export function verifyShopifyHmac(rawBody: Buffer, hmacHeader: string): boolean {
  if (!config.SHOPIFY_WEBHOOK_SECRET) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", config.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("base64");

  // Use timingSafeEqual to prevent timing attacks
  try {
    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(hmacHeader, "utf8");
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}
