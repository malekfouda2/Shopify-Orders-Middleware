import { Worker } from "bullmq";
import { getRedisConnection } from "../services/sync/queue.js";
import { processJob } from "./orderProcessor.js";
import { logger } from "../lib/logger.js";

let worker: Worker | null = null;
let redisErrorLogged = false;

export function startWorker(): void {
  if (worker) return;

  try {
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
      // Only log the first Redis error to avoid log spam
      if (!redisErrorLogged) {
        logger.warn(
          { err: err.message },
          "BullMQ worker cannot connect to Redis — jobs will be processed in-process as fallback"
        );
        redisErrorLogged = true;
      }
    });

    logger.info("BullMQ worker started (will fall back to in-process if Redis is unavailable)");
  } catch (err) {
    logger.warn({ err }, "Could not create BullMQ worker — Redis may not be available");
  }
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
