import { Worker } from "bullmq";
import { getRedisConnection } from "../services/sync/queue.js";
import { processJob } from "./orderProcessor.js";
import { logger } from "../lib/logger.js";

let worker: Worker | null = null;

export function startWorker(): Worker {
  if (worker) return worker;

  worker = new Worker("shopify-orders", processJob, {
    connection: getRedisConnection(),
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err: err.message }, "Job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err: err.message }, "Worker error");
  });

  logger.info("BullMQ worker started");
  return worker;
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
