import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";
import type { JobType } from "../../types/index.js";

let connection: IORedis | null = null;
let orderQueue: Queue | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on("error", (err) => {
      logger.warn({ err: err.message }, "Redis connection error");
    });
  }
  return connection;
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

export async function enqueueOrderJob(
  topic: JobType,
  data: OrderJobData
): Promise<void> {
  const queue = getOrderQueue();
  await queue.add(topic, data, {
    jobId: `${topic}-${data.shopifyOrderId}-${data.webhookEventId}`,
  });
  logger.info({ topic, shopifyOrderId: data.shopifyOrderId }, "Job enqueued");
}

export async function enqueueReplayJob(data: ReplaySyncJobData): Promise<void> {
  const queue = getOrderQueue();
  const jobId = `replay-${data.shopifyOrderId}-${Date.now()}`;
  await queue.add("replay-sync", data, { jobId });
  logger.info({ shopifyOrderId: data.shopifyOrderId }, "Replay job enqueued");
}

export async function enqueueReconcileJob(): Promise<void> {
  const queue = getOrderQueue();
  await queue.add("reconcile-failed-syncs", {} as ReconcileJobData, {
    jobId: `reconcile-${Date.now()}`,
  });
  logger.info("Reconcile job enqueued");
}

export async function enqueueSyncProductsJob(): Promise<void> {
  const queue = getOrderQueue();
  await queue.add("sync-tabliya-products", {} as SyncProductsJobData, {
    jobId: `sync-products-${Date.now()}`,
  });
  logger.info("Sync Tabliya products job enqueued");
}

export async function enqueueSyncPaymentMethodsJob(): Promise<void> {
  const queue = getOrderQueue();
  await queue.add("sync-tabliya-payment-methods", {} as SyncPaymentMethodsJobData, {
    jobId: `sync-payment-methods-${Date.now()}`,
  });
  logger.info("Sync Tabliya payment methods job enqueued");
}
