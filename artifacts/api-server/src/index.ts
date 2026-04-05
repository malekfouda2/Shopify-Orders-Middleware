import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startWorker } from "./workers/index.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Start the BullMQ worker (gracefully skip if Redis is not available)
try {
  startWorker();
} catch (err) {
  logger.warn({ err }, "Could not start BullMQ worker — Redis may not be available");
}

app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  logger.info(`Admin UI available at http://localhost:${port}/api/admin`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down gracefully");
  process.exit(0);
});
