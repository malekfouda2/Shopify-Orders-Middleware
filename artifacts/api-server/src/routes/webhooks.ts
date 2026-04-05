import { Router } from "express";
import type { Request, Response } from "express";
import { verifyShopifyHmac } from "../utils/shopifyHmac.js";
import { db } from "../db/connection.js";
import { webhookEventsTable } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { enqueueOrderJob } from "../services/sync/queue.js";
import { logger } from "../lib/logger.js";

const router = Router();

// We need raw body for HMAC verification, so we use express.raw() on this router
import express from "express";
router.use(express.raw({ type: "*/*", limit: "5mb" }));

async function handleShopifyWebhook(
  req: Request,
  res: Response,
  topic: string
): Promise<void> {
  const rawBody = req.body as Buffer;
  const hmacHeader = (req.headers["x-shopify-hmac-sha256"] as string) ?? "";
  const shopDomain = (req.headers["x-shopify-shop-domain"] as string) ?? "";
  const webhookId = (req.headers["x-shopify-webhook-id"] as string) ?? "";

  const signatureValid = verifyShopifyHmac(rawBody, hmacHeader);

  if (!signatureValid) {
    logger.warn({ topic, shopDomain }, "Invalid Shopify webhook signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let parsedBody: Record<string, unknown> | null = null;
  try {
    parsedBody = JSON.parse(rawBody.toString("utf8"));
  } catch {
    logger.error({ topic }, "Failed to parse webhook body");
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const shopifyOrderId = String(parsedBody?.id ?? "");

  // Check for duplicate delivery (idempotency)
  if (webhookId) {
    const [dup] = await db
      .select({ id: webhookEventsTable.id })
      .from(webhookEventsTable)
      .where(eq(webhookEventsTable.webhookId, webhookId))
      .limit(1);

    if (dup) {
      logger.info({ webhookId, topic }, "Duplicate webhook delivery — skipping");
      res.status(200).json({ received: true, duplicate: true });
      return;
    }
  }

  // Store raw event
  const [event] = await db
    .insert(webhookEventsTable)
    .values({
      source: "shopify",
      topic,
      shopDomain,
      webhookId: webhookId || null,
      shopifyOrderId: shopifyOrderId || null,
      rawHeaders: req.headers as Record<string, unknown>,
      rawBody: rawBody.toString("utf8"),
      parsedBody: parsedBody as Record<string, unknown>,
      signatureValid,
      processingStatus: "pending",
      receivedAt: new Date(),
    })
    .returning();

  // Map topic to job type
  const topicToJob: Record<string, string> = {
    "orders/create": "process-shopify-order-created",
    "orders/updated": "process-shopify-order-updated",
    "orders/cancelled": "process-shopify-order-cancelled",
    "orders/paid": "process-shopify-order-updated",
    "orders/fulfilled": "process-shopify-order-updated",
    "orders/partially_fulfilled": "process-shopify-order-updated",
    "orders/edited": "process-shopify-order-updated",
    "orders/refunded": "process-shopify-order-updated",
  };

  const jobType = topicToJob[topic];
  if (jobType && shopifyOrderId) {
    try {
      await enqueueOrderJob(jobType as import("../types/index.js").JobType, {
        webhookEventId: event.id,
        shopifyOrderId,
        topic,
        orderPayload: parsedBody as Record<string, unknown>,
      });
    } catch (queueErr) {
      logger.warn({ queueErr, topic }, "Failed to enqueue job — will require manual replay");
    }
  }

  // Always return 200 quickly to Shopify
  res.status(200).json({ received: true });
}

router.post("/shopify/orders/create", (req, res) =>
  handleShopifyWebhook(req, res, "orders/create")
);

router.post("/shopify/orders/update", (req, res) =>
  handleShopifyWebhook(req, res, "orders/updated")
);

router.post("/shopify/orders/cancel", (req, res) =>
  handleShopifyWebhook(req, res, "orders/cancelled")
);

router.post("/shopify/orders/paid", (req, res) =>
  handleShopifyWebhook(req, res, "orders/paid")
);

router.post("/shopify/orders/fulfilled", (req, res) =>
  handleShopifyWebhook(req, res, "orders/fulfilled")
);

router.post("/shopify/orders/edited", (req, res) =>
  handleShopifyWebhook(req, res, "orders/edited")
);

export default router;
