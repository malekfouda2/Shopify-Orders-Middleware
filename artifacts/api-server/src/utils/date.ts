import { config } from "../config/index.js";

/**
 * Format a Date or ISO string as YYYY-MM-DD
 */
export function toDateString(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

/**
 * Compute a delivery date from an order date + offset days.
 * Falls back to config.DEFAULT_DELIVERY_OFFSET_DAYS.
 */
export function computeDeliveryDate(createdAt: string, offsetDays?: number): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + (offsetDays ?? config.DEFAULT_DELIVERY_OFFSET_DAYS));
  return toDateString(d);
}

/**
 * Try to extract delivery date from Shopify note_attributes / tags.
 * Returns null if not found.
 */
export function extractDeliveryDateFromOrder(
  noteAttributes: Array<{ name: string; value: string }>,
  tags: string
): string | null {
  // Look in note_attributes
  const keys = ["delivery_date", "deliverydate", "deliver_date", "requested_delivery_date", "leverdatum"];
  for (const attr of noteAttributes) {
    if (keys.some((k) => attr.name.toLowerCase().includes(k))) {
      const parsed = new Date(attr.value);
      if (!isNaN(parsed.getTime())) {
        return toDateString(parsed);
      }
    }
  }

  // Look in tags like "delivery_date:2024-01-20"
  if (tags) {
    for (const tag of tags.split(",")) {
      const t = tag.trim();
      for (const k of keys) {
        if (t.toLowerCase().startsWith(k + ":")) {
          const val = t.split(":").slice(1).join(":");
          const parsed = new Date(val);
          if (!isNaN(parsed.getTime())) {
            return toDateString(parsed);
          }
        }
      }
    }
  }

  return null;
}
