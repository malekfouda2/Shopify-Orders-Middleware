/**
 * Direct (in-process) job processor — used when Redis is not available.
 * Processes jobs synchronously in the same request lifecycle.
 */
import { processJob } from "../../workers/orderProcessor.js";
import { logger } from "../../lib/logger.js";
import type { Job } from "bullmq";

export interface DirectJobData {
  webhookEventId?: number;
  shopifyOrderId?: string;
  topic?: string;
  orderPayload?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Simulate a BullMQ Job object just enough for our processor to use.
 */
function makeFakeJob(name: string, data: unknown): Job {
  return {
    id: `direct-${Date.now()}`,
    name,
    data,
    opts: {},
    attemptsMade: 0,
    log: async () => {},
    updateProgress: async () => {},
    moveToFailed: async () => {},
    isCompleted: async () => false,
    isFailed: async () => false,
  } as unknown as Job;
}

export async function processDirectly(
  jobName: string,
  data: unknown
): Promise<void> {
  const fakeJob = makeFakeJob(jobName, data);
  try {
    await processJob(fakeJob);
    logger.info({ jobName, shopifyOrderId: (data as DirectJobData).shopifyOrderId }, "Direct job completed");
  } catch (err) {
    logger.error({ err, jobName }, "Direct job failed");
    throw err;
  }
}
