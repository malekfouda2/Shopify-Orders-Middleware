import type { AddressParts } from "../types/index.js";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";

/**
 * Parse a Dutch-style address line into street name and house number.
 * Examples:
 *   "Hoofdstraat 123"      -> { streetName: "Hoofdstraat", houseNumber: "123" }
 *   "Keizersgracht 122-A"  -> { streetName: "Keizersgracht", houseNumber: "122-A" }
 *   "Jan van Eijckstraat 5" -> { streetName: "Jan van Eijckstraat", houseNumber: "5" }
 */
export function parseAddress(addressLine1: string | null | undefined): AddressParts {
  if (!addressLine1 || !addressLine1.trim()) {
    return {
      streetName: "",
      houseNumber: config.DEFAULT_HOUSE_NUMBER,
    };
  }

  const trimmed = addressLine1.trim();

  // Pattern: street name (may contain spaces), followed by a number (with optional suffix)
  // Matches: "Hoofdstraat 123", "Jan van Eijckstraat 5A", "Keizersgracht 122-II"
  const pattern = /^(.+?)\s+(\d+[\w\-\/]*)$/;
  const match = trimmed.match(pattern);

  if (match) {
    return {
      streetName: match[1].trim(),
      houseNumber: match[2].trim(),
    };
  }

  // Fallback: the whole address goes into street_name
  logger.warn(
    { address: trimmed },
    "Could not parse house number from address line, using fallback"
  );

  return {
    streetName: trimmed,
    houseNumber: config.DEFAULT_HOUSE_NUMBER,
  };
}
