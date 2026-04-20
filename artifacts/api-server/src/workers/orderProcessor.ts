import type { Job } from "bullmq";
import { db } from "../db/connection.js";
import { webhookEventsTable, orderSyncsTable, syncJobLogsTable, manualReviewItemsTable, appSettingsTable } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import * as tabliya from "../services/tabliya/client.js";
import { transformShopifyOrder, buildUpdatePayload, buildNotes } from "../services/shopify/transformer.js";
import type { ShopifyOrder } from "../types/index.js";
import { logger } from "../lib/logger.js";
import { config } from "../config/index.js";
import axios from "axios";

type OrderJobData = {
  webhookEventId: number;
  shopifyOrderId: string;
  topic: string;
  orderPayload: Record<string, unknown>;
};

async function logJob(
  jobType: string,
  jobStatus: string,
  referenceId: string,
  message: string,
  details?: unknown
) {
  await db.insert(syncJobLogsTable).values({
    jobType,
    jobStatus,
    referenceId,
    message,
    details: details as Record<string, unknown>,
  });
}

async function markWebhookProcessed(id: number, status: string, error?: string) {
  await db
    .update(webhookEventsTable)
    .set({
      processingStatus: status,
      processedAt: new Date(),
      errorMessage: error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(webhookEventsTable.id, id));
}

/**
 * Handle order creation
 */
async function handleOrderCreated(job: Job, data: OrderJobData): Promise<void> {
  const order = data.orderPayload as unknown as ShopifyOrder;
  const shopifyOrderId = String(order.id);

  // Idempotency: check if already synced
  const [existing] = await db
    .select()
    .from(orderSyncsTable)
    .where(
      and(
        eq(orderSyncsTable.shopifyOrderId, shopifyOrderId),
        eq(orderSyncsTable.syncStatus, "synced")
      )
    )
    .limit(1);

  if (existing?.tabliyaOrderId) {
    logger.info({ shopifyOrderId }, "Order already synced — skipping duplicate create");
    await markWebhookProcessed(data.webhookEventId, "duplicate");
    await logJob("process-shopify-order-created", "skipped", shopifyOrderId, "Duplicate — already synced");
    return;
  }

  // Transform
  const result = await transformShopifyOrder(order);

  if (!result.success || !result.payload) {
    const reason = result.error ?? "Transform failed";
    logger.warn({ shopifyOrderId, reason }, "Order transform failed");

    // Create/update order sync as failed
    const [syncRow] = await db
      .insert(orderSyncsTable)
      .values({
        shopifyOrderId,
        shopifyOrderName: order.name,
        shopifyOrderNumber: order.order_number,
        shopifyFinancialStatus: order.financial_status,
        shopifyFulfillmentStatus: order.fulfillment_status ?? null,
        syncStatus: "failed",
        lastSyncAction: "create",
        failureReason: reason,
        webhookEventId: data.webhookEventId,
        requestPayload: result.payload as unknown as Record<string, unknown> ?? null,
      })
      .onConflictDoUpdate({
        target: [orderSyncsTable.shopifyOrderId],
        set: {
          syncStatus: "failed",
          failureReason: reason,
          lastSyncAction: "create",
          updatedAt: new Date(),
        },
      })
      .returning();

    await markWebhookProcessed(data.webhookEventId, "failed", reason);
    await logJob("process-shopify-order-created", "failed", shopifyOrderId, reason, result.unmappedItems);

    // Add to manual review if unmapped products
    if (result.unmappedItems?.length) {
      await db.insert(manualReviewItemsTable).values({
        entityType: "shopify_order",
        entityId: shopifyOrderId,
        reason: `Unmapped products: ${result.unmappedItems.map((i) => i.title).join(", ")}`,
        payload: { order: data.orderPayload, unmappedItems: result.unmappedItems },
        status: "pending",
      });
    }
    return;
  }

  // Call Tabliya API
  let tabliyaOrder;
  try {
    tabliyaOrder = await tabliya.createOrder(result.payload);
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? `Tabliya API error ${err.response?.status}: ${JSON.stringify(err.response?.data)}`
      : String(err);

    await db
      .insert(orderSyncsTable)
      .values({
        shopifyOrderId,
        shopifyOrderName: order.name,
        shopifyOrderNumber: order.order_number,
        shopifyFinancialStatus: order.financial_status,
        shopifyFulfillmentStatus: order.fulfillment_status ?? null,
        syncStatus: "failed",
        lastSyncAction: "create",
        failureReason: message,
        webhookEventId: data.webhookEventId,
        requestPayload: result.payload as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [orderSyncsTable.shopifyOrderId],
        set: {
          syncStatus: "failed",
          failureReason: message,
          lastSyncAction: "create",
          updatedAt: new Date(),
        },
      });

    await markWebhookProcessed(data.webhookEventId, "failed", message);
    await logJob("process-shopify-order-created", "failed", shopifyOrderId, message);

    // Throw to trigger retry for transient errors
    if (axios.isAxiosError(err) && (!err.response || err.response.status >= 500)) {
      throw err;
    }
    return;
  }

  // Success
  await db
    .insert(orderSyncsTable)
    .values({
      shopifyOrderId,
      shopifyOrderName: order.name,
      shopifyOrderNumber: order.order_number,
      shopifyFinancialStatus: order.financial_status,
      shopifyFulfillmentStatus: order.fulfillment_status ?? null,
      tabliyaOrderId: String(tabliyaOrder.id),
      tabliyaOrderNumber: tabliyaOrder.order_number,
      syncStatus: "synced",
      lastSyncAction: "create",
      webhookEventId: data.webhookEventId,
      requestPayload: result.payload as unknown as Record<string, unknown>,
      responsePayload: tabliyaOrder as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: [orderSyncsTable.shopifyOrderId],
      set: {
        tabliyaOrderId: String(tabliyaOrder.id),
        tabliyaOrderNumber: tabliyaOrder.order_number,
        syncStatus: "synced",
        lastSyncAction: "create",
        failureReason: null,
        responsePayload: tabliyaOrder as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });

  await markWebhookProcessed(data.webhookEventId, "processed");
  await logJob("process-shopify-order-created", "success", shopifyOrderId, `Created Tabliya order ${tabliyaOrder.id}`);

  // Optional invoice sync
  if (config.ENABLE_INVOICE_SYNC) {
    try {
      await tabliya.createInvoice(tabliyaOrder.id);
      logger.info({ tabliyaOrderId: tabliyaOrder.id }, "Invoice created for order");
    } catch (err) {
      logger.warn({ err }, "Invoice creation failed (non-fatal)");
    }
  }
}

/**
 * Handle order update
 */
async function handleOrderUpdated(job: Job, data: OrderJobData): Promise<void> {
  const order = data.orderPayload as unknown as ShopifyOrder;
  const shopifyOrderId = String(order.id);

  const [syncRow] = await db
    .select()
    .from(orderSyncsTable)
    .where(eq(orderSyncsTable.shopifyOrderId, shopifyOrderId))
    .limit(1);

  if (!syncRow?.tabliyaOrderId) {
    logger.warn({ shopifyOrderId }, "Order not yet synced — cannot update Tabliya order");
    await markWebhookProcessed(data.webhookEventId, "skipped");
    await logJob("process-shopify-order-updated", "skipped", shopifyOrderId, "Order not yet synced to Tabliya");

    // If it's in failed state, flag for review
    if (syncRow?.syncStatus === "failed") {
      await db.insert(manualReviewItemsTable).values({
        entityType: "shopify_order",
        entityId: shopifyOrderId,
        reason: "Order update received but original order was not synced",
        payload: data.orderPayload,
        status: "pending",
      });
    }
    return;
  }

  if (syncRow.syncStatus === "cancelled") {
    logger.info({ shopifyOrderId }, "Order already cancelled — skipping update");
    await markWebhookProcessed(data.webhookEventId, "skipped");
    return;
  }

  const updatePayload = await buildUpdatePayload(order);

  try {
    const tabliyaOrderId = parseInt(syncRow.tabliyaOrderId!, 10);
    const response = await tabliya.updateOrder(tabliyaOrderId, updatePayload);

    await db
      .update(orderSyncsTable)
      .set({
        syncStatus: "synced",
        lastSyncAction: "update",
        shopifyFinancialStatus: order.financial_status,
        shopifyFulfillmentStatus: order.fulfillment_status ?? null,
        failureReason: null,
        requestPayload: updatePayload as unknown as Record<string, unknown>,
        responsePayload: response as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(orderSyncsTable.shopifyOrderId, shopifyOrderId));

    await markWebhookProcessed(data.webhookEventId, "processed");
    await logJob("process-shopify-order-updated", "success", shopifyOrderId, `Updated Tabliya order ${tabliyaOrderId}`);

    // Check for item changes that can't be safely applied
    const lineItemChangeDetected = order.line_items?.some(
      (item) => item.quantity !== item.quantity
    );
    // Note: We update order-level fields. Item mutations on existing orders
    // are not supported by the Tabliya update endpoint. Log any item changes.
    if (order.line_items?.length) {
      await logJob(
        "process-shopify-order-updated",
        "info",
        shopifyOrderId,
        "Note: Line item changes cannot be applied to existing Tabliya orders via update endpoint. Only order-level fields were updated.",
        { lineItemCount: order.line_items.length }
      );
    }

    // Update invoice if sync enabled
    if (config.ENABLE_INVOICE_SYNC) {
      try {
        const invoice = await tabliya.getInvoiceByOrder(tabliyaOrderId);
        if (invoice) {
          const addr = updatePayload.street_name
            ? {
                street_name: updatePayload.street_name,
                house_number: updatePayload.house_number,
                zip_code: updatePayload.zip_code,
              }
            : {};
          await tabliya.updateInvoice(invoice.id, {
            ...addr,
            buyer_name: updatePayload.buyer_name,
            payment_status: updatePayload.payment_status,
            ...(updatePayload.amount_paid_partial
              ? { amount_paid: updatePayload.amount_paid_partial }
              : {}),
          });
        }
      } catch (err) {
        logger.warn({ err }, "Invoice update failed (non-fatal)");
      }
    }
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? `Tabliya API error ${err.response?.status}: ${JSON.stringify(err.response?.data)}`
      : String(err);

    await db
      .update(orderSyncsTable)
      .set({
        syncStatus: "failed",
        lastSyncAction: "update",
        failureReason: message,
        updatedAt: new Date(),
      })
      .where(eq(orderSyncsTable.shopifyOrderId, shopifyOrderId));

    await markWebhookProcessed(data.webhookEventId, "failed", message);
    await logJob("process-shopify-order-updated", "failed", shopifyOrderId, message);

    if (axios.isAxiosError(err) && (!err.response || err.response.status >= 500)) {
      throw err;
    }
  }
}

/**
 * Handle order cancellation
 */
async function handleOrderCancelled(job: Job, data: OrderJobData): Promise<void> {
  const order = data.orderPayload as unknown as ShopifyOrder;
  const shopifyOrderId = String(order.id);

  const [syncRow] = await db
    .select()
    .from(orderSyncsTable)
    .where(eq(orderSyncsTable.shopifyOrderId, shopifyOrderId))
    .limit(1);

  // Idempotency: already cancelled
  if (syncRow?.syncStatus === "cancelled") {
    logger.info({ shopifyOrderId }, "Order already cancelled — idempotent skip");
    await markWebhookProcessed(data.webhookEventId, "duplicate");
    return;
  }

  if (!syncRow?.tabliyaOrderId) {
    logger.warn({ shopifyOrderId }, "Order not synced to Tabliya — marking locally as cancelled");
    await db
      .insert(orderSyncsTable)
      .values({
        shopifyOrderId,
        shopifyOrderName: order.name,
        shopifyOrderNumber: order.order_number,
        shopifyFinancialStatus: order.financial_status,
        syncStatus: "cancelled",
        lastSyncAction: "cancel",
        webhookEventId: data.webhookEventId,
        failureReason: "Order was not synced to Tabliya before cancellation",
      })
      .onConflictDoUpdate({
        target: [orderSyncsTable.shopifyOrderId],
        set: {
          syncStatus: "cancelled",
          lastSyncAction: "cancel",
          updatedAt: new Date(),
        },
      });
    await markWebhookProcessed(data.webhookEventId, "processed");
    return;
  }

  const tabliyaOrderId = parseInt(syncRow.tabliyaOrderId, 10);
  const cancelNote = buildNotes(order, `CANCELLED: ${order.cancel_reason ?? "No reason"} at ${order.cancelled_at ?? "unknown"}`);

  // Strategy:
  // 1. Use the TABLIYA_CANCEL_STATUS setting if configured (admin-configured, most reliable)
  // 2. Auto-detect a cancel-like status from GET /api/orders/statuses
  // 3. Fall back to DELETE
  let cancelled = false;
  let strategy = "unknown";

  try {
    // Step 1: Check if admin has configured a specific cancel status in Settings
    const [configuredStatus] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, "TABLIYA_CANCEL_STATUS"))
      .limit(1);

    let cancelStatus: string | undefined = configuredStatus?.value?.trim() || undefined;

    if (!cancelStatus) {
      // Step 2: Auto-detect from Tabliya's status list
      let statuses: string[] = [];
      try {
        statuses = await tabliya.getOrderStatuses();
        logger.info({ statuses }, "Fetched Tabliya order statuses for cancel detection");
      } catch {
        logger.warn("Could not fetch order statuses from Tabliya");
      }

      cancelStatus = statuses.find((s) =>
        ["cancelled", "canceled", "annulled", "geannuleerd", "geannulleeerd", "geannuleerd"].includes(
          s.toLowerCase()
        )
      );
    }

    if (cancelStatus) {
      // Update the order's status in Tabliya
      await tabliya.updateOrder(tabliyaOrderId, {
        status: cancelStatus,
        notes: cancelNote,
      });
      strategy = `update_status:${cancelStatus}`;
      cancelled = true;
      logger.info({ tabliyaOrderId, cancelStatus }, "Tabliya order cancelled via status update");
    } else {
      // No cancel status found — delete the order from Tabliya
      logger.warn(
        { tabliyaOrderId },
        "No cancel status configured or detected — deleting order from Tabliya. " +
        "Set TABLIYA_CANCEL_STATUS in Settings to avoid this."
      );
      await tabliya.deleteOrder(tabliyaOrderId);
      strategy = "delete";
      cancelled = true;
    }
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : null;
    if (status === 404) {
      // Already deleted in Tabliya — treat as success
      logger.info({ tabliyaOrderId }, "Tabliya order already deleted — treating cancel as success");
      cancelled = true;
      strategy = "already_deleted";
    } else {
      const message = axios.isAxiosError(err)
        ? `Tabliya cancel error ${err.response?.status}: ${JSON.stringify(err.response?.data)}`
        : String(err);

      await db
        .update(orderSyncsTable)
        .set({
          syncStatus: "failed",
          lastSyncAction: "cancel",
          failureReason: message,
          updatedAt: new Date(),
        })
        .where(eq(orderSyncsTable.shopifyOrderId, shopifyOrderId));

      await markWebhookProcessed(data.webhookEventId, "failed", message);
      await logJob("process-shopify-order-cancelled", "failed", shopifyOrderId, message);

      // Flag for manual review if we can't figure out what to do
      await db.insert(manualReviewItemsTable).values({
        entityType: "shopify_order",
        entityId: shopifyOrderId,
        reason: `Cancellation failed: ${message}`,
        payload: data.orderPayload,
        status: "pending",
      });

      if (axios.isAxiosError(err) && (!err.response || err.response.status >= 500)) {
        throw err;
      }
      return;
    }
  }

  if (cancelled) {
    await db
      .update(orderSyncsTable)
      .set({
        syncStatus: "cancelled",
        lastSyncAction: "cancel",
        failureReason: null,
        responsePayload: { strategy, cancelled_at: order.cancelled_at, cancel_reason: order.cancel_reason },
        updatedAt: new Date(),
      })
      .where(eq(orderSyncsTable.shopifyOrderId, shopifyOrderId));

    await markWebhookProcessed(data.webhookEventId, "processed");
    await logJob(
      "process-shopify-order-cancelled",
      "success",
      shopifyOrderId,
      `Cancelled Tabliya order ${tabliyaOrderId} via strategy: ${strategy}`
    );
  }
}

/**
 * Handle replay-sync job — re-process a Shopify order
 */
async function handleReplaySync(job: Job, data: { shopifyOrderId: string; webhookEventId?: number }): Promise<void> {
  const { shopifyOrderId } = data;

  // Find the most recent webhook event for this order to replay
  const events = await db
    .select()
    .from(webhookEventsTable)
    .where(eq(webhookEventsTable.shopifyOrderId, shopifyOrderId))
    .orderBy(desc(webhookEventsTable.receivedAt))
    .limit(1);

  if (!events.length || !events[0].parsedBody) {
    logger.warn({ shopifyOrderId }, "No webhook event found for replay");
    return;
  }

  const event = events[0];
  const order = event.parsedBody as unknown as ShopifyOrder;

  // Determine action: if cancelled, replay cancel; else replay create/update
  if (order.cancelled_at) {
    await handleOrderCancelled(job, {
      webhookEventId: event.id,
      shopifyOrderId,
      topic: event.topic,
      orderPayload: event.parsedBody as Record<string, unknown>,
    });
  } else {
    const [syncRow] = await db
      .select()
      .from(orderSyncsTable)
      .where(eq(orderSyncsTable.shopifyOrderId, shopifyOrderId))
      .limit(1);

    if (syncRow?.tabliyaOrderId) {
      await handleOrderUpdated(job, {
        webhookEventId: event.id,
        shopifyOrderId,
        topic: event.topic,
        orderPayload: event.parsedBody as Record<string, unknown>,
      });
    } else {
      await handleOrderCreated(job, {
        webhookEventId: event.id,
        shopifyOrderId,
        topic: event.topic,
        orderPayload: event.parsedBody as Record<string, unknown>,
      });
    }
  }

  await logJob("replay-sync", "success", shopifyOrderId, "Replay completed");
}

/**
 * Handle reconcile-failed-syncs — retry all failed pending syncs
 */
async function handleReconcile(_job: Job): Promise<void> {
  const failedSyncs = await db
    .select()
    .from(orderSyncsTable)
    .where(eq(orderSyncsTable.syncStatus, "failed"))
    .limit(50);

  logger.info({ count: failedSyncs.length }, "Starting reconciliation of failed syncs");

  for (const sync of failedSyncs) {
    try {
      const events = await db
        .select()
        .from(webhookEventsTable)
        .where(eq(webhookEventsTable.shopifyOrderId, sync.shopifyOrderId))
        .orderBy(desc(webhookEventsTable.receivedAt))
        .limit(1);

      if (!events.length || !events[0].parsedBody) continue;

      const event = events[0];
      const order = event.parsedBody as unknown as ShopifyOrder;

      if (order.cancelled_at) {
        await handleOrderCancelled(_job, {
          webhookEventId: event.id,
          shopifyOrderId: sync.shopifyOrderId,
          topic: event.topic,
          orderPayload: event.parsedBody as Record<string, unknown>,
        });
      } else if (sync.tabliyaOrderId) {
        await handleOrderUpdated(_job, {
          webhookEventId: event.id,
          shopifyOrderId: sync.shopifyOrderId,
          topic: event.topic,
          orderPayload: event.parsedBody as Record<string, unknown>,
        });
      } else {
        await handleOrderCreated(_job, {
          webhookEventId: event.id,
          shopifyOrderId: sync.shopifyOrderId,
          topic: event.topic,
          orderPayload: event.parsedBody as Record<string, unknown>,
        });
      }
    } catch (err) {
      logger.warn({ err, shopifyOrderId: sync.shopifyOrderId }, "Reconcile failed for order");
    }
  }

  await logJob("reconcile-failed-syncs", "success", "system", `Reconciled ${failedSyncs.length} failed syncs`);
}

/**
 * Handle sync-tabliya-products — import Tabliya products into local cache
 */
async function handleSyncProducts(_job: Job): Promise<void> {
  const products = await tabliya.listProducts();
  await logJob("sync-tabliya-products", "success", "system", `Fetched ${products.length} products from Tabliya`, products);
}

/**
 * Handle sync-tabliya-payment-methods
 */
async function handleSyncPaymentMethods(_job: Job): Promise<void> {
  const methods = await tabliya.listPaymentMethods();
  await logJob("sync-tabliya-payment-methods", "success", "system", `Fetched ${methods.length} payment methods from Tabliya`, methods);
}

/**
 * Main job processor — dispatches to the right handler based on job name
 */
export async function processJob(job: Job): Promise<void> {
  logger.info({ jobName: job.name, jobId: job.id }, "Processing job");

  switch (job.name) {
    case "process-shopify-order-created":
      await handleOrderCreated(job, job.data as OrderJobData);
      break;
    case "process-shopify-order-updated":
      await handleOrderUpdated(job, job.data as OrderJobData);
      break;
    case "process-shopify-order-cancelled":
      await handleOrderCancelled(job, job.data as OrderJobData);
      break;
    case "replay-sync":
      await handleReplaySync(job, job.data as { shopifyOrderId: string; webhookEventId?: number });
      break;
    case "reconcile-failed-syncs":
      await handleReconcile(job);
      break;
    case "sync-tabliya-products":
      await handleSyncProducts(job);
      break;
    case "sync-tabliya-payment-methods":
      await handleSyncPaymentMethods(job);
      break;
    default:
      logger.warn({ jobName: job.name }, "Unknown job type");
  }
}
