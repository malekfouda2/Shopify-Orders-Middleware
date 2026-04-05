import { Queue, type Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";
import type { JobType } from "../../types/index.js";

let connection: IORedis | null = null;
let orderQueue: Queue | null = null;
let redisAvailable = true;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 500, 2000);
      },
    });
    connection.on("error", () => {
      redisAvailable = false;
    });
    connection.on("connect", () => {
      redisAvailable = true;
    });
  }
  return connection;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export function getOrderQueue(): Queue {
  if (!orderQueue) {
    orderQueue = new Queue("shopify-orders", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return orderQueue;
}

export interface OrderJobData {
  webhookEventId: number;
  shopifyOrderId: string;
  topic: string;
  orderPayload: Record<string, unknown>;
}

export interface ReplaySyncJobData {
  shopifyOrderId: string;
  webhookEventId?: number;
  forcedAction?: "create" | "update" | "cancel";
}

export interface ReconcileJobData {
  limit?: number;
}

export interface SyncProductsJobData {}
export interface SyncPaymentMethodsJobData {}

export type AnyJobData =
  | OrderJobData
  | ReplaySyncJobData
  | ReconcileJobData
  | SyncProductsJobData
  | SyncPaymentMethodsJobData;

/**
 * Enqueue an order job — falls back to in-process direct execution if Redis is unavailable.
 */
export async function enqueueOrderJob(
  topic: JobType,
  data: OrderJobData
): Promise<void> {
  if (!redisAvailable) {
    logger.info({ topic, shopifyOrderId: data.shopifyOrderId }, "Redis unavailable — processing job directly");
    const { processDirectly } = await import("./directProcessor.js");
    await processDirectly(topic, data);
    return;
  }
  try {
    const queue = getOrderQueue();
    await queue.add(topic, data, {
      jobId: `${topic}-${data.shopifyOrderId}-${data.webhookEventId}`,
    });
    logger.info({ topic, shopifyOrderId: data.shopifyOrderId }, "Job enqueued");
  } catch (err) {
    logger.warn({ err, topic }, "Failed to enqueue to Redis — processing directly");
    const { processDirectly } = await import("./directProcessor.js");
    await processDirectly(topic, data);
  }
}

/**
 * Replay a sync job — falls back to direct processing if Redis is unavailable.
 */
export async function enqueueReplayJob(data: ReplaySyncJobData): Promise<void> {
  if (!redisAvailable) {
    const { processDirectly } = await import("./directProcessor.js");
    await processDirectly("replay-sync", data);
    return;
  }
  try {
    const queue = getOrderQueue();
    const jobId = `replay-${data.shopifyOrderId}-${Date.now()}`;
    await queue.add("replay-sync", data, { jobId });
    logger.info({ shopifyOrderId: data.shopifyOrderId }, "Replay job enqueued");
  } catch (err) {
    logger.warn({ err }, "Failed to enqueue replay — processing directly");
    const { processDirectly } = await import("./directProcessor.js");
    await processDirectly("replay-sync", data);
  }
}

export async function enqueueReconcileJob(): Promise<void> {
  if (!redisAvailable) {
    const { processDirectly } = await import("./directProcessor.js");
    await processDirectly("reconcile-failed-syncs", {});
    return;
  }
  try {
    const queue = getOrderQueue();
    await queue.add("reconcile-failed-syncs", {} as ReconcileJobData, {
      jobId: `reconcile-${Date.now()}`,
    });
    logger.info("Reconcile job enqueued");
  } catch (err) {
    logger.warn({ err }, "Reconcile enqueue failed — processing directly");
    const { processDirectly } = await import("./directProcessor.js");
    await processDirectly("reconcile-failed-syncs", {});
  }
}

export async function enqueueSyncProductsJob(): Promise<void> {
  if (!redisAvailable) {
    const { processDirectly } = await import("./directProcessor.js");
    await processDirectly("sync-tabliya-products", {});
    return;
  }
  try {
    const queue = getOrderQueue();
    await queue.add("sync-tabliya-products", {} as SyncProductsJobData, {
      jobId: `sync-products-${Date.now()}`,
    });
    logger.info("Sync Tabliya products job enqueued");
  } catch (err) {
    logger.warn({ err }, "Failed to enqueue sync products — processing directly");
    const { processDirectly } = await import("./directProcessor.js");
    await processDirectly("sync-tabliya-products", {});
  }
}

export async function enqueueSyncPaymentMethodsJob(): Promise<void> {
  if (!redisAvailable) {
    const { processDirectly } = await import("./directProcessor.js");
    await processDirectly("sync-tabliya-payment-methods", {});
    return;
  }
  try {
    const queue = getOrderQueue();
    await queue.add("sync-tabliya-payment-methods", {} as SyncPaymentMethodsJobData, {
      jobId: `sync-payment-methods-${Date.now()}`,
    });
    logger.info("Sync Tabliya payment methods job enqueued");
  } catch (err) {
    logger.warn({ err }, "Failed to enqueue sync payment methods — processing directly");
    const { processDirectly } = await import("./directProcessor.js");
    await processDirectly("sync-tabliya-payment-methods", {});
  }
}
